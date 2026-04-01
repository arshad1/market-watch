const axios = require('axios');

const BASE = 'https://api.binance.com/api/v3';

async function fetchPriceData(symbol = 'BTCUSDT') {
  try {
    const [tickerRes, candles5mRes, candles15mRes] = await Promise.all([
      axios.get(`${BASE}/ticker/24hr?symbol=${symbol}`),
      axios.get(`${BASE}/klines?symbol=${symbol}&interval=5m&limit=100`),
      axios.get(`${BASE}/klines?symbol=${symbol}&interval=15m&limit=50`),
    ]);

    const ticker = tickerRes.data;
    const candles5m = candles5mRes.data;
    const candles15m = candles15mRes.data;

    // Latest candle is usually the last one (index 99)
    const currentPrice = parseFloat(ticker.lastPrice);
    const open = parseFloat(ticker.openPrice);
    const high = parseFloat(ticker.highPrice);
    const low = parseFloat(ticker.lowPrice);
    const volume = parseFloat(ticker.volume);
    const changePct = parseFloat(ticker.priceChangePercent);

    return {
      ticker: {
        currentPrice,
        open,
        high,
        low,
        volume,
        changePct: changePct.toFixed(2)
      },
      candles5m,
      candles15m
    };
  } catch (error) {
    console.error(`Error fetching price data for ${symbol}:`, error.message);
    throw error;
  }
}

module.exports = { fetchPriceData };
