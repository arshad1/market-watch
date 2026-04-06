const OpenAI = require('openai');
const axios = require('axios');
const {
  RSI,
  MACD,
  EMA,
  BollingerBands,
  Stochastic,
  ATR,
  ADX,
  WilliamsR,
  OBV
} = require('technicalindicators');

const BASE = 'https://api.binance.com/api/v3';
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';

async function fetchMultiTimeframeData(symbol = 'BTCUSDT') {
  const cleanSymbol = symbol.replace(/[^A-Z0-9]/g, '').toUpperCase();

  console.log(`[spotFuturesEngine] Fetching data for ${cleanSymbol}...`);
  const [ticker, k5m, k15m, k1h, k4h, depthRes, aggTradesRes] = await Promise.all([
    axios.get(`${BASE}/ticker/24hr?symbol=${cleanSymbol}`),
    axios.get(`${BASE}/klines?symbol=${cleanSymbol}&interval=5m&limit=200`),
    axios.get(`${BASE}/klines?symbol=${cleanSymbol}&interval=15m&limit=200`),
    axios.get(`${BASE}/klines?symbol=${cleanSymbol}&interval=1h&limit=200`),
    axios.get(`${BASE}/klines?symbol=${cleanSymbol}&interval=4h&limit=100`),
    axios.get(`https://fapi.binance.com/fapi/v1/depth?symbol=${cleanSymbol}&limit=100`).catch(() => ({ data: { bids: [], asks: [] } })),
    axios.get(`https://fapi.binance.com/fapi/v1/aggTrades?symbol=${cleanSymbol}&limit=1000`).catch(() => ({ data: [] }))
  ]);

  const forceRes = { data: [] };

  const depth = depthRes.data;
  let totalBids = 0;
  let totalAsks = 0;
  if (depth.bids && depth.asks) {
    depth.bids.forEach((b) => { totalBids += parseFloat(b[1]); });
    depth.asks.forEach((a) => { totalAsks += parseFloat(a[1]); });
  }
  const imbalance = (totalBids + totalAsks) > 0
    ? ((totalBids - totalAsks) / (totalBids + totalAsks)).toFixed(2)
    : '0.00';

  const trades = aggTradesRes.data;
  let cvd = 0;
  if (Array.isArray(trades)) {
    trades.forEach((t) => {
      const qty = parseFloat(t.q);
      if (t.m) cvd -= qty;
      else cvd += qty;
    });
  }

  const forceOrders = forceRes.data;
  let longsLiquidated = 0;
  let shortsLiquidated = 0;
  if (Array.isArray(forceOrders)) {
    forceOrders.forEach((o) => {
      const valUSD = parseFloat(o.q) * parseFloat(o.p);
      if (o.S === 'SELL') longsLiquidated += valUSD;
      else shortsLiquidated += valUSD;
    });
  }

  return {
    ticker: ticker.data,
    k5m: k5m.data,
    k15m: k15m.data,
    k1h: k1h.data,
    k4h: k4h.data,
    orderFlow: {
      imbalance,
      cvd,
      liquidations: { longs: longsLiquidated, shorts: shortsLiquidated }
    }
  };
}

function parseCandles(klines) {
  return {
    opens: klines.map((c) => parseFloat(c[1])),
    highs: klines.map((c) => parseFloat(c[2])),
    lows: klines.map((c) => parseFloat(c[3])),
    closes: klines.map((c) => parseFloat(c[4])),
    volumes: klines.map((c) => parseFloat(c[5])),
  };
}

const r2 = (v) => Math.round(v * 100) / 100;

function formatLevel(value) {
  return Number.isFinite(value) ? r2(value) : '—';
}

function formatRange(low, high) {
  if (!Number.isFinite(low) || !Number.isFinite(high)) return '—';
  return `${r2(low)} - ${r2(high)}`;
}

async function fetchCryptoCompareNews(assetCode, apiKey, logPrefix) {
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
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
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  return [];
}

function computeAllIndicators(candles) {
  const { opens, highs, lows, closes, volumes } = candles;
  const n = closes.length;

  const ema9 = EMA.calculate({ values: closes, period: 9 });
  const ema21 = EMA.calculate({ values: closes, period: 21 });
  const ema50 = EMA.calculate({ values: closes, period: 50 });
  const ema200 = EMA.calculate({ values: closes, period: 200 });

  const rsiArr = RSI.calculate({ values: closes, period: 14 });

  const macdArr = MACD.calculate({
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false
  });
  const lastMacd = macdArr[macdArr.length - 1] || {};
  const prevMacd = macdArr[macdArr.length - 2] || {};

  const bbArr = BollingerBands.calculate({ values: closes, period: 20, stdDev: 2 });
  const lastBB = bbArr[bbArr.length - 1] || { upper: 0, middle: 0, lower: 0 };

  const atrArr = ATR.calculate({ high: highs, low: lows, close: closes, period: 14 });

  const adxArr = ADX.calculate({ high: highs, low: lows, close: closes, period: 14 });
  const lastADX = adxArr[adxArr.length - 1] || { adx: 0, pdi: 0, mdi: 0 };

  const stochArr = Stochastic.calculate({
    high: highs,
    low: lows,
    close: closes,
    period: 14,
    signalPeriod: 3
  });
  const lastStoch = stochArr[stochArr.length - 1] || { k: 50, d: 50 };

  const wrArr = WilliamsR.calculate({ high: highs, low: lows, close: closes, period: 14 });

  const obvArr = OBV.calculate({ close: closes, volume: volumes });
  const obvLen = obvArr.length;
  const obvTrend = obvLen > 5
    ? (obvArr[obvLen - 1] > obvArr[obvLen - 5] ? 'Rising' : 'Falling')
    : 'Neutral';

  let cumTPV = 0;
  let cumVol = 0;
  for (let i = Math.max(0, n - 78); i < n; i += 1) {
    const tp = (highs[i] + lows[i] + closes[i]) / 3;
    cumTPV += tp * volumes[i];
    cumVol += volumes[i];
  }
  const vwap = cumVol > 0 ? cumTPV / cumVol : closes[n - 1];

  const atrVal = atrArr[atrArr.length - 1] || 1;
  const multiplier = 3;
  const lastClose = closes[n - 1];
  const basicLower = ((highs[n - 1] + lows[n - 1]) / 2) - multiplier * atrVal;
  const supertrendBull = lastClose > basicLower;
  const supertrendDir = supertrendBull ? 'Bullish' : 'Bearish';

  const price = closes[n - 1];

  return {
    price,
    ema9: r2(ema9[ema9.length - 1] || price),
    ema21: r2(ema21[ema21.length - 1] || price),
    ema50: r2(ema50[ema50.length - 1] || price),
    ema200: r2(ema200[ema200.length - 1] || price),
    rsi: r2(rsiArr[rsiArr.length - 1] || 50),
    macd: r2(lastMacd.MACD || 0),
    macdSignal: r2(lastMacd.signal || 0),
    macdHist: r2(lastMacd.histogram || 0),
    macdPrevHist: r2(prevMacd.histogram || 0),
    bbUpper: r2(lastBB.upper),
    bbMid: r2(lastBB.middle),
    bbLower: r2(lastBB.lower),
    atr: r2(atrVal),
    adx: r2(lastADX.adx),
    pdi: r2(lastADX.pdi),
    mdi: r2(lastADX.mdi),
    stochK: r2(lastStoch.k),
    stochD: r2(lastStoch.d),
    williamsR: r2(wrArr[wrArr.length - 1] || -50),
    obvTrend,
    vwap: r2(vwap),
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
  for (let i = n - 3; i >= Math.max(2, n - 40); i -= 1) {
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
  for (let i = n - 3; i >= Math.max(1, n - 25); i -= 1) {
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
  for (let i = n - 3; i >= Math.max(2, n - 25); i -= 1) {
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
  const liquidityHighs = highs.slice(-30).filter((h) => Math.abs(h - recentHigh) <= tolerance);
  const liquidityLows = lows.slice(-30).filter((l) => Math.abs(l - recentLow) <= tolerance);

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
    liquidityPools: `${liquidityHighs.length >= 2 ? `Buy-side near ${r2(recentHigh)}` : 'No clustered buy-side pool'} | ${liquidityLows.length >= 2 ? `Sell-side near ${r2(recentLow)}` : 'No clustered sell-side pool'}`,
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

async function fetchNewsItems(asset, limit = 5) {
  const apiKey = process.env.CRYPTOCOMPARE_API_KEY;
  if (!apiKey || apiKey === 'your_cryptocompare_api_key_here') {
    console.warn('[spotFuturesEngine] CryptoCompare API key missing. Skipping news fetch.');
    return [];
  }

  try {
    const assetCode = normalizeAssetForNews(asset);
    console.log(`[spotFuturesEngine] Fetching CryptoCompare news for ${asset} (category: ${assetCode})`);
    const results = await fetchCryptoCompareNews(assetCode, apiKey, 'spotFuturesEngine');

    return results
      .filter((item) => {
        const categories = typeof item.categories === 'string' ? item.categories.split('|') : [];
        return categories.length === 0 || categories.includes(assetCode);
      })
      .slice(0, limit)
      .map((item) => ({
        title: item.title,
        source: item.source_info?.name || item.source || 'Unknown',
        published_at: item.published_on ? new Date(item.published_on * 1000).toISOString() : null,
        summary: item.body ? item.body.slice(0, 280) : '',
        url: item.url || null
      }));
  } catch (err) {
    console.error('[spotFuturesEngine] CryptoCompare news fetch failed:', err.message);
    return [];
  }
}

function formatNewsContext(newsItems) {
  if (!newsItems.length) return 'No news context available.';
  return newsItems.map((item) => `- ${item.title} (${item.source})`).join('\n');
}

async function fetchShockContext(symbol) {
  try {
    const oneMinute = await axios.get(`${BASE}/klines?symbol=${symbol}&interval=1m&limit=60`);
    const candles = parseCandles(oneMinute.data);
    const closes = candles.closes;
    const last = closes[closes.length - 1];
    const first = closes[0];
    const high = Math.max(...candles.highs);
    const low = Math.min(...candles.lows);
    const movePct = first ? (((last - first) / first) * 100) : 0;

    return {
      interval: '1m',
      candles: 60,
      movePct: r2(movePct),
      rangePct: r2((((high - low) / last) || 0) * 100),
      high: r2(high),
      low: r2(low),
      last: r2(last)
    };
  } catch (err) {
    console.error('[spotFuturesEngine] Shock context fetch failed:', err.message);
    return null;
  }
}

function createClient() {
  if (!process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY === 'your_deepseek_api_key_here') {
    throw new Error('DeepSeek API Key not configured.');
  }

  return new OpenAI({
    baseURL: DEEPSEEK_BASE_URL,
    apiKey: process.env.DEEPSEEK_API_KEY
  });
}

function extractJson(raw) {
  if (typeof raw !== 'string') {
    throw new Error('Agent did not return a string response.');
  }

  const fenced = raw.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const objectMatch = raw.match(/\{[\s\S]*\}/);
  if (objectMatch) return objectMatch[0];

  throw new Error('Agent did not return valid JSON.');
}

async function repairStructuredJson(client, model, agentName, raw) {
  console.warn(`[spotFuturesEngine] ${agentName} returned malformed JSON. Attempting repair pass.`);
  const response = await client.chat.completions.create({
    model,
    temperature: 0,
    max_tokens: 1200,
    messages: [
      {
        role: 'system',
        content: 'You repair malformed JSON. Return only valid JSON with the same structure and intent as the input. Do not add markdown.'
      },
      {
        role: 'user',
        content: `Repair this malformed JSON into strict valid JSON:\n\n${raw}`
      }
    ]
  });

  return response.choices?.[0]?.message?.content || '';
}

async function callStructuredAgent(client, {
  agentName,
  model,
  system,
  user,
  temperature = 0.15,
  maxTokens = 1200
}) {
  console.log(`[spotFuturesEngine] Running ${agentName} with model ${model}`);
  const response = await client.chat.completions.create({
    model,
    temperature,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ]
  });

  const raw = response.choices?.[0]?.message?.content || '';

  try {
    return JSON.parse(extractJson(raw));
  } catch (error) {
    const repairedRaw = await repairStructuredJson(client, model, agentName, raw);
    try {
      return JSON.parse(extractJson(repairedRaw));
    } catch (repairError) {
      const preview = String(raw).slice(0, 400).replace(/\s+/g, ' ');
      throw new Error(`${agentName} returned invalid JSON after repair attempt: ${repairError.message}. Raw preview: ${preview}`);
    }
  }
}

function buildBaseContext({
  asset,
  timeframe,
  price,
  open,
  high,
  low,
  vol,
  chPct,
  session,
  indicators,
  marketStructure,
  orderFlow,
  newsItems,
  shockContext
}) {
  return {
    asset,
    timeframe,
    timestamp: new Date().toISOString(),
    session,
    market: {
      price: r2(price),
      open: r2(open),
      high_24h: r2(high),
      low_24h: r2(low),
      volume_24h: r2(vol),
      change_pct_24h: r2(chPct)
    },
    indicators,
    market_structure: marketStructure,
    order_flow: {
      imbalance: Number(orderFlow.imbalance),
      cvd: r2(orderFlow.cvd),
      liquidations: {
        longs: r2(orderFlow.liquidations.longs),
        shorts: r2(orderFlow.liquidations.shorts)
      }
    },
    news: newsItems,
    adaptive_context: shockContext
  };
}

function buildShockFlags(chPct, orderFlow, indicators) {
  const absChange = Math.abs(chPct);
  const imbalance = Math.abs(Number(orderFlow.imbalance));
  const atrPct = indicators.price ? (indicators.atr / indicators.price) * 100 : 0;

  return {
    priceShock: absChange >= 4,
    orderFlowShock: imbalance >= 0.18 || Math.abs(orderFlow.cvd) >= 2500,
    volatilityShock: atrPct >= 1.8,
    summary: {
      change_pct_24h: r2(absChange),
      imbalance_abs: r2(imbalance),
      atr_pct: r2(atrPct),
      cvd_abs: r2(Math.abs(orderFlow.cvd))
    }
  };
}

const EXPECTED_STRATEGIES = [
  'EMA Ribbon Trend-Follow',
  'RSI + MACD Confluence',
  'Supertrend + ADX Filter',
  'Bollinger Band Mean Reversion',
  'VWAP Institutional Strategy',
  'Stochastic RSI Divergence',
  'Fear & Greed Contrarian + Trend',
  'SMC Continuation/Reversal',
  'ICT Liquidity + Imbalance Execution'
];

function normalizeStrategyName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function buildStrategySignalMap(signals) {
  if (!Array.isArray(signals)) return new Map();

  const entries = signals.map((signal) => [normalizeStrategyName(signal.strategy), signal]);
  return new Map(entries);
}

function sanitizeStrategySignal(strategyName, signal) {
  const rawScore = Number(signal?.score);
  const clampedScore = Number.isFinite(rawScore) ? Math.max(0, Math.min(10, rawScore)) : 5;

  return {
    strategy: strategyName,
    win_rate: signal?.win_rate || 'N/A',
    signal: ['BUY', 'SELL', 'NEUTRAL'].includes(signal?.signal) ? signal.signal : 'NEUTRAL',
    score: clampedScore,
    reason: signal?.reason || 'No rationale provided.'
  };
}

function normalizeStrategySignals(signals, fallbackSignals = []) {
  const primaryMap = buildStrategySignalMap(signals);
  const fallbackMap = buildStrategySignalMap(fallbackSignals);

  return EXPECTED_STRATEGIES.map((strategyName) => {
    const key = normalizeStrategyName(strategyName);
    return sanitizeStrategySignal(
      strategyName,
      primaryMap.get(key) || fallbackMap.get(key) || null
    );
  });
}

function deriveFallbackAnalysis(context) {
  const { market, indicators } = context;
  const bullishTrend = indicators.ema9 >= indicators.ema21 && indicators.ema21 >= indicators.ema50;
  const bearishTrend = indicators.ema9 <= indicators.ema21 && indicators.ema21 <= indicators.ema50;
  const verdict = bullishTrend ? 'BUY' : bearishTrend ? 'SELL' : 'HOLD';
  const stopDistance = Math.max(indicators.atr * 1.2, market.price * 0.01);
  const tp1 = verdict === 'SELL' ? market.price - stopDistance : market.price + stopDistance;
  const tp2 = verdict === 'SELL' ? market.price - stopDistance * 2 : market.price + stopDistance * 2;
  const tp3 = verdict === 'SELL' ? market.price - stopDistance * 3 : market.price + stopDistance * 3;

  return {
    final_verdict: verdict,
    verdict_strength: 'Weak',
    confidence_score: 45,
    price: market.price,
    asset: context.asset,
    trade_type: verdict === 'BUY' ? 'Spot' : verdict === 'SELL' ? 'Futures Short' : 'Hold Cash',
    entry_zone: { low: r2(market.price - indicators.atr * 0.5), high: r2(market.price + indicators.atr * 0.5) },
    stop_loss: r2(verdict === 'SELL' ? market.price + stopDistance : market.price - stopDistance),
    trailing_stop_activation: r2(verdict === 'SELL' ? market.price - indicators.atr : market.price + indicators.atr),
    take_profit_1: r2(tp1),
    take_profit_2: r2(tp2),
    take_profit_3: r2(tp3),
    risk_reward_ratio: '1:2.0',
    suggested_leverage: verdict === 'HOLD' ? 'N/A' : '1x-2x',
    hold_duration: context.timeframe === '5m' ? '30-90 minutes' : context.timeframe === '15m' ? '4-12 hours' : '1-3 days',
    strategy_signals: [],
    market_summary: 'Fallback summary generated because the orchestration pipeline did not produce a full consensus payload.',
    key_support_levels: [r2(indicators.bbLower), r2(indicators.ema21), r2(indicators.ema50)],
    key_resistance_levels: [r2(indicators.bbUpper), r2(indicators.ema9), r2(market.high_24h)],
    trend: bullishTrend ? 'Uptrend' : bearishTrend ? 'Downtrend' : 'Sideways',
    momentum: indicators.macdHist > 0 ? 'Bullish' : indicators.macdHist < 0 ? 'Bearish' : 'Neutral',
    volatility: indicators.atr > market.price * 0.02 ? 'High' : 'Medium',
    best_timeframe: context.timeframe,
    key_risks: ['AI consensus unavailable, using indicator fallback.', 'Order flow can shift quickly.', 'Trade sizing should stay conservative.'],
    analyst_opinion: 'I would wait for cleaner confirmation before increasing size because this fallback view is not the full multi-agent consensus.',
    news_impact: 'News context was limited or unavailable.',
    disclaimer: 'This is AI-generated analysis for educational purposes only. Not financial advice.'
  };
}

function normalizeFinalAnalysis(analysis, context, technicalAnalysis, sentimentAnalysis, orderFlowAnalysis, riskReview) {
  const fallback = deriveFallbackAnalysis(context);
  const merged = { ...fallback, ...(analysis || {}) };

  return {
    ...merged,
    final_verdict: ['BUY', 'SELL', 'HOLD'].includes(merged.final_verdict) ? merged.final_verdict : fallback.final_verdict,
    verdict_strength: ['Strong', 'Moderate', 'Weak'].includes(merged.verdict_strength) ? merged.verdict_strength : fallback.verdict_strength,
    confidence_score: Math.max(0, Math.min(100, Number(merged.confidence_score ?? fallback.confidence_score))),
    price: Number.isFinite(Number(merged.price)) ? Number(merged.price) : context.market.price,
    asset: merged.asset || context.asset,
    trade_type: merged.trade_type || fallback.trade_type,
    entry_zone: {
      low: Number.isFinite(Number(merged.entry_zone?.low)) ? Number(merged.entry_zone.low) : fallback.entry_zone.low,
      high: Number.isFinite(Number(merged.entry_zone?.high)) ? Number(merged.entry_zone.high) : fallback.entry_zone.high
    },
    stop_loss: Number.isFinite(Number(merged.stop_loss)) ? Number(merged.stop_loss) : fallback.stop_loss,
    trailing_stop_activation: Number.isFinite(Number(merged.trailing_stop_activation))
      ? Number(merged.trailing_stop_activation)
      : fallback.trailing_stop_activation,
    take_profit_1: Number.isFinite(Number(merged.take_profit_1)) ? Number(merged.take_profit_1) : fallback.take_profit_1,
    take_profit_2: Number.isFinite(Number(merged.take_profit_2)) ? Number(merged.take_profit_2) : fallback.take_profit_2,
    take_profit_3: Number.isFinite(Number(merged.take_profit_3)) ? Number(merged.take_profit_3) : fallback.take_profit_3,
    risk_reward_ratio: merged.risk_reward_ratio || fallback.risk_reward_ratio,
    suggested_leverage: merged.suggested_leverage || riskReview?.leverage_cap || fallback.suggested_leverage,
    hold_duration: merged.hold_duration || fallback.hold_duration,
    strategy_signals: normalizeStrategySignals(merged.strategy_signals, technicalAnalysis?.strategy_signals),
    market_summary: merged.market_summary || sentimentAnalysis?.market_summary || fallback.market_summary,
    key_support_levels: Array.isArray(merged.key_support_levels) && merged.key_support_levels.length
      ? merged.key_support_levels.map(Number).filter(Number.isFinite)
      : fallback.key_support_levels,
    key_resistance_levels: Array.isArray(merged.key_resistance_levels) && merged.key_resistance_levels.length
      ? merged.key_resistance_levels.map(Number).filter(Number.isFinite)
      : fallback.key_resistance_levels,
    trend: merged.trend || technicalAnalysis?.trend || fallback.trend,
    momentum: merged.momentum || technicalAnalysis?.momentum || fallback.momentum,
    volatility: merged.volatility || technicalAnalysis?.volatility || fallback.volatility,
    best_timeframe: merged.best_timeframe || context.timeframe,
    key_risks: Array.isArray(merged.key_risks) && merged.key_risks.length
      ? merged.key_risks
      : Array.isArray(sentimentAnalysis?.key_risks) && sentimentAnalysis.key_risks.length
        ? sentimentAnalysis.key_risks
        : Array.isArray(orderFlowAnalysis?.key_risks) && orderFlowAnalysis.key_risks.length
          ? orderFlowAnalysis.key_risks
        : fallback.key_risks,
    analyst_opinion: merged.analyst_opinion || fallback.analyst_opinion,
    news_impact: merged.news_impact || sentimentAnalysis?.news_impact || fallback.news_impact,
    disclaimer: merged.disclaimer || fallback.disclaimer
  };
}

async function runSpotFuturesAnalysis(asset = 'BTC/USDT', timeframe = '15m', onProgress = null) {
  const reportProgress = (progress, stage, detail) => {
    if (typeof onProgress === 'function') {
      onProgress({
        progress,
        stage,
        detail,
        timestamp: new Date().toISOString()
      });
    }
  };

  reportProgress(5, 'initializing', 'Preparing agentic workflow');
  const client = createClient();
  const analysisModel = process.env.AI_MODEL || 'deepseek-chat';
  const screeningModel = process.env.AI_SCREENING_MODEL || analysisModel;

  const symbol = asset.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  reportProgress(12, 'market-data', `Fetching Binance data for ${symbol}`);
  const { ticker, k5m, k15m, k1h, k4h, orderFlow } = await fetchMultiTimeframeData(symbol);

  const candleMap = { '5m': k5m, '15m': k15m, '1h': k1h, '4h': k4h };
  const primaryCandles = parseCandles(candleMap[timeframe] || k15m);
  const indicators = computeAllIndicators(primaryCandles);
  const htfCandles = parseCandles(k1h);
  const marketStructure = detectMarketStructure(primaryCandles, htfCandles);

  const price = parseFloat(ticker.lastPrice);
  const open = parseFloat(ticker.openPrice);
  const high = parseFloat(ticker.highPrice);
  const low = parseFloat(ticker.lowPrice);
  const vol = parseFloat(ticker.volume);
  const chPct = parseFloat(ticker.priceChangePercent);

  const h = new Date().getUTCHours();
  const session = h >= 13 && h < 21
    ? 'NY / US Session'
    : h >= 8 && h < 16
      ? 'London / EU Session'
      : 'Asia Session';

  reportProgress(20, 'news-context', 'Fetching catalyst context');
  const initialNewsItems = await fetchNewsItems(asset, 5);
  const shockFlags = buildShockFlags(chPct, orderFlow, indicators);

  const baseContext = buildBaseContext({
    asset,
    timeframe,
    price,
    open,
    high,
    low,
    vol,
    chPct,
    session,
    indicators,
    marketStructure,
    orderFlow,
    newsItems: initialNewsItems,
    shockContext: null
  });

  reportProgress(30, 'screening-agent', 'Running market screening agent');
  const screening = await callStructuredAgent(client, {
    agentName: 'screening-agent',
    model: screeningModel,
    maxTokens: 500,
    temperature: 0.1,
    system: 'You are a crypto market screener. You only decide regime, urgency, and whether more context is required. Return strict JSON only.',
    user: [
      'Review this market snapshot and decide if the system should request additional context before deep analysis.',
      'Return JSON with keys: bias, market_regime, urgency, should_expand_context, preferred_trade_type, why.',
      'Bias must be BUY, SELL, or HOLD.',
      'Urgency must be LOW, MEDIUM, or HIGH.',
      '',
      JSON.stringify({ context: baseContext, shock_flags: shockFlags }, null, 2)
    ].join('\n')
  });

  let adaptiveNewsItems = initialNewsItems;
  let shockContext = null;
  const shouldExpandContext = Boolean(
    screening?.should_expand_context
    || shockFlags.priceShock
    || shockFlags.orderFlowShock
    || shockFlags.volatilityShock
  );

  if (shouldExpandContext) {
    reportProgress(40, 'dynamic-context', 'Expanding context with microstructure and extra news');
    const [extraNews, microstructure] = await Promise.all([
      fetchNewsItems(asset, 8),
      fetchShockContext(symbol)
    ]);
    adaptiveNewsItems = extraNews.length ? extraNews : initialNewsItems;
    shockContext = microstructure;
  }

  const agentContext = buildBaseContext({
    asset,
    timeframe,
    price,
    open,
    high,
    low,
    vol,
    chPct,
    session,
    indicators,
    marketStructure,
    orderFlow,
    newsItems: adaptiveNewsItems,
    shockContext
  });

  reportProgress(55, 'parallel-agents', 'Running technical, sentiment, and order flow agents in parallel');
  const [technicalAnalysis, sentimentAnalysis, orderFlowAnalysis] = await Promise.all([
    callStructuredAgent(client, {
      agentName: 'technical-analyst',
      model: analysisModel,
      maxTokens: 1200,
      temperature: 0.15,
      system: 'You are a technical crypto analyst. Focus only on price structure, indicators, strategy confluence, and execution levels. Return strict JSON only.',
      user: [
        'Analyze the following crypto market context.',
        'Return JSON with keys:',
        'trend, momentum, volatility, best_timeframe, trade_bias, trade_type, confidence_score, entry_zone, stop_loss, trailing_stop_activation, take_profit_1, take_profit_2, take_profit_3, risk_reward_ratio, suggested_leverage, hold_duration, key_support_levels, key_resistance_levels, strategy_signals, analyst_note.',
        'strategy_signals must be an array covering the nine named strategies with fields strategy, win_rate, signal, score, reason.',
        '',
        JSON.stringify(agentContext, null, 2)
      ].join('\n')
    }),
    callStructuredAgent(client, {
      agentName: 'sentiment-analyst',
      model: analysisModel,
      maxTokens: 900,
      temperature: 0.2,
      system: 'You are a crypto sentiment and catalyst analyst. Focus on news, session context, and whether external catalysts strengthen or weaken the setup. Return strict JSON only.',
      user: [
        'Analyze only sentiment, catalyst risk, and headline impact.',
        'Return JSON with keys: sentiment_bias, conviction, market_summary, news_impact, key_risks, catalyst_watchlist, analyst_note.',
        '',
        JSON.stringify({
          asset: agentContext.asset,
          timeframe: agentContext.timeframe,
          timestamp: agentContext.timestamp,
          session: agentContext.session,
          market: agentContext.market,
          order_flow: agentContext.order_flow,
          news: agentContext.news,
          adaptive_context: agentContext.adaptive_context
        }, null, 2)
      ].join('\n')
    }),
    callStructuredAgent(client, {
      agentName: 'orderflow-analyst',
      model: analysisModel,
      maxTokens: 900,
      temperature: 0.1,
      system: 'You are a crypto order flow and execution analyst. Focus only on imbalance, CVD, liquidation skew, short-term microstructure, and whether flows confirm or reject the setup. Return strict JSON only.',
      user: [
        'Analyze only order flow and execution quality.',
        'Return JSON with keys: flow_bias, conviction, execution_quality, liquidity_state, liquidation_read, newsless_verdict, key_risks, analyst_note.',
        '',
        JSON.stringify({
          asset: agentContext.asset,
          timeframe: agentContext.timeframe,
          timestamp: agentContext.timestamp,
          market: agentContext.market,
          order_flow: agentContext.order_flow,
          market_structure: agentContext.market_structure,
          adaptive_context: agentContext.adaptive_context
        }, null, 2)
      ].join('\n')
    })
  ]);

  reportProgress(78, 'risk-manager', 'Running risk review');
  const riskReview = await callStructuredAgent(client, {
    agentName: 'risk-manager',
    model: analysisModel,
    maxTokens: 900,
    temperature: 0.1,
    system: 'You are a strict crypto risk manager. Your job is to challenge weak setups, reduce leverage, cap confidence, and veto trades when risk is mispriced. Return strict JSON only.',
    user: [
      'Review the market context, the technical proposal, and the sentiment assessment.',
      'Return JSON with keys: approved, adjusted_verdict, adjusted_trade_type, confidence_cap, leverage_cap, blocking_reasons, risk_overrides, execution_guidance.',
      '',
      JSON.stringify({
        context: agentContext,
        screening,
        technical_analysis: technicalAnalysis,
        sentiment_analysis: sentimentAnalysis,
        orderflow_analysis: orderFlowAnalysis
      }, null, 2)
    ].join('\n')
  });

  reportProgress(90, 'consensus', 'Synthesizing final consensus');
  const finalAnalysisRaw = await callStructuredAgent(client, {
    agentName: 'consensus-synthesizer',
    model: analysisModel,
    maxTokens: 1500,
    temperature: 0.12,
    system: 'You are the portfolio lead synthesizing specialized agent outputs into one final market decision. Resolve disagreements explicitly, honor valid risk vetoes, and return strict JSON only.',
    user: [
      'Produce the final trade analysis JSON with exactly these keys:',
      'final_verdict, verdict_strength, confidence_score, price, asset, trade_type, entry_zone, stop_loss, trailing_stop_activation, take_profit_1, take_profit_2, take_profit_3, risk_reward_ratio, suggested_leverage, hold_duration, strategy_signals, market_summary, key_support_levels, key_resistance_levels, trend, momentum, volatility, best_timeframe, key_risks, analyst_opinion, news_impact, disclaimer.',
      'If the risk manager rejects the trade, downgrade to HOLD unless the blocking reasons are clearly addressed.',
      'Keep analyst_opinion in first person.',
      '',
      JSON.stringify({
        context: {
          ...agentContext,
          news_context_text: formatNewsContext(agentContext.news)
        },
        screening,
        technical_analysis: technicalAnalysis,
        sentiment_analysis: sentimentAnalysis,
        orderflow_analysis: orderFlowAnalysis,
        risk_review: riskReview
      }, null, 2)
    ].join('\n')
  });

  const analysis = normalizeFinalAnalysis(
    finalAnalysisRaw,
    agentContext,
    technicalAnalysis,
    sentimentAnalysis,
    orderFlowAnalysis,
    riskReview
  );

  reportProgress(100, 'complete', 'Analysis complete');

  return {
    ...analysis,
    live_indicators: {
      price,
      open,
      high,
      low,
      volume: vol,
      changePct: chPct,
      ...indicators,
      marketStructure,
      session,
      asset,
      timeframe,
      timestamp: new Date().toISOString()
    },
    agentic_workflow: {
      models: {
        screening: screeningModel,
        analysts: analysisModel,
        consensus: analysisModel
      },
      parallel_agents: ['technical-analyst', 'sentiment-analyst', 'orderflow-analyst'],
      triggered_dynamic_context: shouldExpandContext,
      shock_flags: shockFlags,
      screening,
      agents: {
        technical_analysis: technicalAnalysis,
        sentiment_analysis: sentimentAnalysis,
        orderflow_analysis: orderFlowAnalysis,
        risk_review: riskReview
      },
      context: {
        news_headlines_used: adaptiveNewsItems.length,
        shock_context: shockContext
      }
    }
  };
}

module.exports = { runSpotFuturesAnalysis };
