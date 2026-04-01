const { fetchPriceData } = require('./fetchers/priceFetcher');
const { calculateIndicators } = require('./fetchers/indicatorEngine');
const { fetchSentiment } = require('./fetchers/sentimentFetcher');
const { fetchMacroData } = require('./fetchers/macroFetcher');

function getSession() {
  const currentHour = new Date().getUTCHours();
  if (currentHour >= 13 && currentHour < 21) return 'NY / US Session';
  if (currentHour >= 8 && currentHour < 16) return 'London / EU Session';
  return 'Asia Session';
}

async function aggregateData(asset = 'BTCUSDT') {
  console.log(`[Aggregator] Starting data fetch for ${asset}...`);
  try {
    const [priceData, sentiment, macro] = await Promise.all([
      fetchPriceData(asset.replace(/\//g, '')), // Strip slashes for Binance
      fetchSentiment(),
      fetchMacroData()
    ]);

    const indicators = calculateIndicators(priceData.candles5m);
    
    // Construct the payload
    const payload = {
      timestamp: new Date().toISOString(),
      session: getSession(),
      asset,
      price: priceData.ticker.currentPrice,
      open: priceData.ticker.open,
      high: priceData.ticker.high,
      low: priceData.ticker.low,
      volume: priceData.ticker.volume,
      changePct: priceData.ticker.changePct,
      rsi: indicators.rsi,
      macd: indicators.macd,
      macdSignal: indicators.macdSignal,
      fgValue: sentiment.fearAndGreedValue,
      fgLabel: sentiment.fearAndGreedLabel,
      newsHeadlines: sentiment.newsHeadlines,
      dxy: macro.dxy
    };

    return payload;

  } catch (err) {
    console.error(`[Aggregator] Error aggregating data:`, err.message);
    throw err;
  }
}

module.exports = { aggregateData };
