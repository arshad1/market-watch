const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { RSI, MACD, EMA, BollingerBands, Stochastic, ATR, ADX, WilliamsR, OBV } = require('technicalindicators');

const BASE = 'https://api.binance.com/api/v3';

/**
 * Fetch rich OHLCV data for a symbol across multiple timeframes
 */
async function fetchMultiTimeframeData(symbol = 'BTCUSDT') {
  const cleanSymbol = symbol.replace(/[^A-Z0-9]/g, '').toUpperCase();
  const [ticker, k5m, k15m, k1h, k4h] = await Promise.all([
    axios.get(`${BASE}/ticker/24hr?symbol=${cleanSymbol}`),
    axios.get(`${BASE}/klines?symbol=${cleanSymbol}&interval=5m&limit=200`),
    axios.get(`${BASE}/klines?symbol=${cleanSymbol}&interval=15m&limit=200`),
    axios.get(`${BASE}/klines?symbol=${cleanSymbol}&interval=1h&limit=200`),
    axios.get(`${BASE}/klines?symbol=${cleanSymbol}&interval=4h&limit=100`),
  ]);

  return {
    ticker: ticker.data,
    k5m: k5m.data,
    k15m: k15m.data,
    k1h: k1h.data,
    k4h: k4h.data,
  };
}

/** Parse candles into float arrays */
function parseCandles(klines) {
  return {
    opens:   klines.map(c => parseFloat(c[1])),
    highs:   klines.map(c => parseFloat(c[2])),
    lows:    klines.map(c => parseFloat(c[3])),
    closes:  klines.map(c => parseFloat(c[4])),
    volumes: klines.map(c => parseFloat(c[5])),
  };
}

/** Round to 2 decimal places */
const r2 = v => Math.round(v * 100) / 100;

function formatLevel(value) {
  return Number.isFinite(value) ? r2(value) : '—';
}

function formatRange(low, high) {
  if (!Number.isFinite(low) || !Number.isFinite(high)) return '—';
  return `${r2(low)} - ${r2(high)}`;
}

async function fetchCryptoCompareNews(assetCode, apiKey, logPrefix) {
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[${logPrefix}] CryptoCompare request attempt ${attempt}/${maxAttempts} for ${assetCode}`);
      const res = await axios.get('https://min-api.cryptocompare.com/data/v2/news/', {
        params: {
          lang: 'EN',
          categories: assetCode,
          excludeCategories: 'Sponsored',
        },
        headers: {
          authorization: `Apikey ${apiKey}`
        },
        timeout: 12000
      });

      return res.data?.Data || [];
    } catch (err) {
      const isLastAttempt = attempt === maxAttempts;
      console.error(`[${logPrefix}] CryptoCompare attempt ${attempt} failed: ${err.message}`);
      if (isLastAttempt) throw err;
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }

  return [];
}

/**
 * Compute all indicators for a given candle set
 */
function computeAllIndicators(candles) {
  const { opens, highs, lows, closes, volumes } = candles;
  const n = closes.length;

  // EMAs
  const ema9   = EMA.calculate({ values: closes, period: 9 });
  const ema21  = EMA.calculate({ values: closes, period: 21 });
  const ema50  = EMA.calculate({ values: closes, period: 50 });
  const ema200 = EMA.calculate({ values: closes, period: 200 });

  // RSI
  const rsiArr = RSI.calculate({ values: closes, period: 14 });

  // MACD
  const macdArr = MACD.calculate({
    values: closes, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9,
    SimpleMAOscillator: false, SimpleMASignal: false
  });
  const lastMacd = macdArr[macdArr.length - 1] || {};
  const prevMacd = macdArr[macdArr.length - 2] || {};

  // Bollinger Bands
  const bbArr = BollingerBands.calculate({ values: closes, period: 20, stdDev: 2 });
  const lastBB = bbArr[bbArr.length - 1] || { upper: 0, middle: 0, lower: 0 };

  // ATR
  const atrArr = ATR.calculate({ high: highs, low: lows, close: closes, period: 14 });

  // ADX
  const adxArr = ADX.calculate({ high: highs, low: lows, close: closes, period: 14 });
  const lastADX = adxArr[adxArr.length - 1] || { adx: 0, pdi: 0, mdi: 0 };

  // Stochastic RSI (use Stochastic on RSI values)
  const stochArr = Stochastic.calculate({
    high: highs, low: lows, close: closes, period: 14, signalPeriod: 3
  });
  const lastStoch = stochArr[stochArr.length - 1] || { k: 50, d: 50 };

  // Williams %R
  const wrArr = WilliamsR.calculate({ high: highs, low: lows, close: closes, period: 14 });

  // OBV
  const obvArr = OBV.calculate({ close: closes, volume: volumes });
  const obvLen = obvArr.length;
  const obvTrend = obvLen > 5
    ? (obvArr[obvLen - 1] > obvArr[obvLen - 5] ? 'Rising' : 'Falling')
    : 'Neutral';

  // VWAP (simplified — cumulative for available candles)
  let cumTPV = 0, cumVol = 0;
  for (let i = Math.max(0, n - 78); i < n; i++) {
    const tp = (highs[i] + lows[i] + closes[i]) / 3;
    cumTPV += tp * volumes[i];
    cumVol += volumes[i];
  }
  const vwap = cumVol > 0 ? cumTPV / cumVol : closes[n - 1];

  // Supertrend (simplified ATR-based)
  const atrVal = atrArr[atrArr.length - 1] || 1;
  const multiplier = 3;
  const lastClose = closes[n - 1];
  const prevClose = closes[n - 2];
  const basicUpper = ((highs[n - 1] + lows[n - 1]) / 2) + multiplier * atrVal;
  const basicLower = ((highs[n - 1] + lows[n - 1]) / 2) - multiplier * atrVal;
  const supertrendBull = lastClose > basicLower;
  const supertrendDir = supertrendBull ? 'Bullish' : 'Bearish';

  const price = closes[n - 1];

  return {
    price,
    ema9:    r2(ema9[ema9.length - 1] || price),
    ema21:   r2(ema21[ema21.length - 1] || price),
    ema50:   r2(ema50[ema50.length - 1] || price),
    ema200:  r2(ema200[ema200.length - 1] || price),
    rsi:     r2(rsiArr[rsiArr.length - 1] || 50),
    macd:    r2(lastMacd.MACD || 0),
    macdSignal: r2(lastMacd.signal || 0),
    macdHist:   r2(lastMacd.histogram || 0),
    macdPrevHist: r2(prevMacd.histogram || 0),
    bbUpper:  r2(lastBB.upper),
    bbMid:    r2(lastBB.middle),
    bbLower:  r2(lastBB.lower),
    atr:      r2(atrVal),
    adx:      r2(lastADX.adx),
    pdi:      r2(lastADX.pdi),
    mdi:      r2(lastADX.mdi),
    stochK:   r2(lastStoch.k),
    stochD:   r2(lastStoch.d),
    williamsR:r2(wrArr[wrArr.length - 1] || -50),
    obvTrend,
    vwap:     r2(vwap),
    supertrend: r2(basicLower),
    supertrendDir,
  };
}

function detectMarketStructure(primaryCandles, higherTimeframeCandles) {
  const { opens, highs, lows, closes, volumes } = primaryCandles;
  const srcHighs = higherTimeframeCandles?.highs?.length ? higherTimeframeCandles.highs : highs;
  const srcLows = higherTimeframeCandles?.lows?.length ? higherTimeframeCandles.lows : lows;
  const n = closes.length;
  const lookback = Math.min(60, n);
  const recentHigh = Math.max(...srcHighs.slice(-lookback));
  const recentLow = Math.min(...srcLows.slice(-lookback));
  const range = Math.max(recentHigh - recentLow, 1e-9);
  const lastClose = closes[n - 1];
  const prevClose = closes[n - 2] ?? lastClose;
  const premiumThreshold = recentLow + range * 0.5;
  const dealingZone = lastClose >= premiumThreshold ? 'Premium' : 'Discount';

  let swingHigh = null;
  let swingLow = null;
  for (let i = n - 3; i >= Math.max(2, n - 40); i--) {
    if (swingHigh === null && highs[i] > highs[i - 1] && highs[i] > highs[i + 1]) {
      swingHigh = highs[i];
    }
    if (swingLow === null && lows[i] < lows[i - 1] && lows[i] < lows[i + 1]) {
      swingLow = lows[i];
    }
    if (swingHigh !== null && swingLow !== null) break;
  }
  swingHigh = swingHigh ?? recentHigh;
  swingLow = swingLow ?? recentLow;

  let structureState = 'Range';
  if (lastClose > swingHigh && prevClose <= swingHigh) structureState = 'Bullish BOS';
  else if (lastClose < swingLow && prevClose >= swingLow) structureState = 'Bearish BOS';
  else if (lastClose > prevClose && lastClose > (recentLow + range * 0.6)) structureState = 'Bullish Continuation';
  else if (lastClose < prevClose && lastClose < (recentLow + range * 0.4)) structureState = 'Bearish Continuation';

  let orderBlock = null;
  for (let i = n - 3; i >= Math.max(1, n - 25); i--) {
    const isBearCandle = closes[i] < opens[i];
    const isBullCandle = closes[i] > opens[i];
    const impulseUp = closes[i + 1] > highs[i];
    const impulseDown = closes[i + 1] < lows[i];
    if (!orderBlock && impulseUp && isBearCandle) {
      orderBlock = { type: 'Bullish Order Block', low: lows[i], high: highs[i] };
      break;
    }
    if (!orderBlock && impulseDown && isBullCandle) {
      orderBlock = { type: 'Bearish Order Block', low: lows[i], high: highs[i] };
      break;
    }
  }

  let fairValueGap = null;
  for (let i = n - 3; i >= Math.max(2, n - 25); i--) {
    if (lows[i] > highs[i - 2]) {
      fairValueGap = { type: 'Bullish FVG', low: highs[i - 2], high: lows[i] };
      break;
    }
    if (highs[i] < lows[i - 2]) {
      fairValueGap = { type: 'Bearish FVG', low: highs[i], high: lows[i - 2] };
      break;
    }
  }

  const tolerance = lastClose * 0.0015;
  const liquidityHighs = highs
    .slice(-30)
    .filter(h => Math.abs(h - recentHigh) <= tolerance);
  const liquidityLows = lows
    .slice(-30)
    .filter(l => Math.abs(l - recentLow) <= tolerance);

  const avgVolume = volumes.slice(-20).reduce((sum, v) => sum + v, 0) / Math.min(20, volumes.length);
  const displacement = Math.abs(lastClose - prevClose);
  const displacementState = displacement > ((highs[n - 1] - lows[n - 1]) * 0.8) && volumes[n - 1] > avgVolume
    ? (lastClose > prevClose ? 'Bullish displacement' : 'Bearish displacement')
    : 'Normal expansion';

  return {
    structureState,
    recentHigh: formatLevel(recentHigh),
    recentLow: formatLevel(recentLow),
    swingHigh: formatLevel(swingHigh),
    swingLow: formatLevel(swingLow),
    dealingZone,
    orderBlockType: orderBlock?.type || 'None',
    orderBlockRange: formatRange(orderBlock?.low, orderBlock?.high),
    fairValueGapType: fairValueGap?.type || 'None',
    fairValueGapRange: formatRange(fairValueGap?.low, fairValueGap?.high),
    liquidityPools: `${liquidityHighs.length >= 2 ? 'Buy-side near ' + r2(recentHigh) : 'No clustered buy-side pool'} | ${liquidityLows.length >= 2 ? 'Sell-side near ' + r2(recentLow) : 'No clustered sell-side pool'}`,
    displacementState,
  };
}

function normalizeAssetForNews(asset) {
  return asset
    .replace('/USDT', '')
    .replace('/USD', '')
    .replace(/[^A-Z0-9]/gi, '')
    .toUpperCase();
}

/**
 * Fetch news context via CryptoCompare
 */
async function fetchNewsContext(asset) {
  const apiKey = process.env.CRYPTOCOMPARE_API_KEY;
  if (!apiKey || apiKey === 'your_cryptocompare_api_key_here') {
    console.warn('[spotFuturesEngine] CryptoCompare API key missing. Skipping news fetch.');
    return 'No news context available.';
  }

  try {
    const assetCode = normalizeAssetForNews(asset);
    console.log(`[spotFuturesEngine] Fetching CryptoCompare news for ${asset} (category: ${assetCode})`);
    const results = await fetchCryptoCompareNews(assetCode, apiKey, 'spotFuturesEngine');
    const headlines = results
      .filter(item => Array.isArray(item.categories?.split?.('|'))
        ? item.categories.split('|').includes(assetCode)
        : true)
      .slice(0, 5)
      .map(item => `- ${item.title}`);

    console.log(`[spotFuturesEngine] CryptoCompare news fetch succeeded for ${assetCode}. Headlines: ${headlines.length}`);
    return headlines.length > 0 ? headlines.join('\n') : 'No news found.';
  } catch (err) {
    console.error('[spotFuturesEngine] CryptoCompare news fetch failed:', err.message);
    return 'News fetch unavailable.';
  }
}

/**
 * Main function: run full multi-strategy analysis with AI verdict
 */
async function runSpotFuturesAnalysis(asset = 'BTC/USDT', timeframe = '15m') {
  if (!process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY === 'your_deepseek_api_key_here') {
    throw new Error('DeepSeek API Key not configured.');
  }

  const client = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: process.env.DEEPSEEK_API_KEY
  });

  const symbol = asset.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  console.log(`[spotFuturesEngine] Fetching data for ${symbol}...`);

  // Fetch real market data from Binance
  const { ticker, k5m, k15m, k1h, k4h } = await fetchMultiTimeframeData(symbol);

  // Use 15m as primary timeframe for analysis
  const candleMap = { '5m': k5m, '15m': k15m, '1h': k1h, '4h': k4h };
  const primaryCandles = parseCandles(candleMap[timeframe] || k15m);
  const indicators = computeAllIndicators(primaryCandles);
  const htfCandles = parseCandles(k1h);
  const marketStructure = detectMarketStructure(primaryCandles, htfCandles);

  const price = parseFloat(ticker.lastPrice);
  const open  = parseFloat(ticker.openPrice);
  const high  = parseFloat(ticker.highPrice);
  const low   = parseFloat(ticker.lowPrice);
  const vol   = parseFloat(ticker.volume);
  const chPct = parseFloat(ticker.priceChangePercent);

  // Get session
  const h = new Date().getUTCHours();
  const session = h >= 13 && h < 21 ? 'NY / US Session'
                : h >= 8  && h < 16 ? 'London / EU Session'
                : 'Asia Session';

  const newsContext = await fetchNewsContext(asset);

  // Build prompt
  const templatePath = path.join(__dirname, '..', 'prompts', 'spot_futures_analysis.txt');
  let prompt = fs.readFileSync(templatePath, 'utf8');

  prompt = prompt
    .replace(/{{ASSET}}/g, asset)
    .replace('{{PRICE}}', price)
    .replace('{{OPEN}}', open)
    .replace('{{HIGH}}', high)
    .replace('{{LOW}}', low)
    .replace('{{VOLUME}}', vol.toLocaleString())
    .replace('{{CHANGE_PCT}}', chPct.toFixed(2))
    .replace('{{TIMESTAMP}}', new Date().toISOString())
    .replace('{{SESSION}}', session)
    .replace('{{RSI}}', indicators.rsi)
    .replace('{{MACD_VAL}}', indicators.macd)
    .replace('{{MACD_SIGNAL}}', indicators.macdSignal)
    .replace('{{MACD_HIST}}', indicators.macdHist)
    .replace('{{EMA9}}',  indicators.ema9)
    .replace('{{EMA21}}', indicators.ema21)
    .replace('{{EMA50}}', indicators.ema50)
    .replace('{{EMA200}}', indicators.ema200)
    .replace('{{SUPERTREND}}', indicators.supertrend)
    .replace('{{SUPERTREND_DIR}}', indicators.supertrendDir)
    .replace('{{ATR}}', indicators.atr)
    .replace('{{VWAP}}', indicators.vwap)
    .replace('{{BB_UPPER}}', indicators.bbUpper)
    .replace('{{BB_MID}}', indicators.bbMid)
    .replace('{{BB_LOWER}}', indicators.bbLower)
    .replace('{{STOCH_K}}', indicators.stochK)
    .replace('{{STOCH_D}}', indicators.stochD)
    .replace('{{WILLIAMS_R}}', indicators.williamsR)
    .replace('{{ADX}}', indicators.adx)
    .replace('{{OBV_TREND}}', indicators.obvTrend)
    .replace('{{MARKET_STRUCTURE}}', marketStructure.structureState)
    .replace('{{RECENT_SWING_HIGH}}', marketStructure.swingHigh)
    .replace('{{RECENT_SWING_LOW}}', marketStructure.swingLow)
    .replace('{{DEALING_RANGE_HIGH}}', marketStructure.recentHigh)
    .replace('{{DEALING_RANGE_LOW}}', marketStructure.recentLow)
    .replace('{{PREMIUM_DISCOUNT}}', marketStructure.dealingZone)
    .replace('{{ORDER_BLOCK_TYPE}}', marketStructure.orderBlockType)
    .replace('{{ORDER_BLOCK_RANGE}}', marketStructure.orderBlockRange)
    .replace('{{FVG_TYPE}}', marketStructure.fairValueGapType)
    .replace('{{FVG_RANGE}}', marketStructure.fairValueGapRange)
    .replace('{{LIQUIDITY_POOLS}}', marketStructure.liquidityPools)
    .replace('{{DISPLACEMENT}}', marketStructure.displacementState)
    .replace('{{FG_VALUE}}', '—')
    .replace('{{FG_LABEL}}', '(not fetched)')
    .replace('{{DXY}}', '—')
    .replace('{{NEWS_HEADLINES}}', newsContext);

  const useModel = process.env.AI_MODEL || 'deepseek-chat';
  console.log(`[spotFuturesEngine] Calling ${useModel} for analysis...`);

  const response = await client.chat.completions.create({
    model: useModel,
    max_tokens: 2000,
    temperature: 0.15,
    messages: [{ role: 'user', content: prompt }]
  });

  const raw = response.choices[0].message.content;

  // Extract JSON
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('AI did not return valid JSON');

  const analysis = JSON.parse(jsonMatch[0]);

  // Enrich with raw indicator data for charting
  return {
    ...analysis,
    live_indicators: {
      price, open, high, low, volume: vol, changePct: chPct,
      ...indicators,
      marketStructure,
      session,
      asset,
      timeframe,
      timestamp: new Date().toISOString()
    }
  };
}

module.exports = { runSpotFuturesAnalysis };
