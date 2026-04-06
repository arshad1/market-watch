const axios = require('axios');

const BASE = 'https://api.binance.com/api/v3';

async function fetchPriceData(symbol = 'BTCUSDT') {
  try {
    const [tickerRes, candles5mRes, candles15mRes, depthRes, aggTradesRes, forceRes] = await Promise.all([
      axios.get(`${BASE}/ticker/24hr?symbol=${symbol}`),
      axios.get(`${BASE}/klines?symbol=${symbol}&interval=5m&limit=100`),
      axios.get(`${BASE}/klines?symbol=${symbol}&interval=15m&limit=50`),
      axios.get(`https://fapi.binance.com/fapi/v1/depth?symbol=${symbol}&limit=100`).catch(() => ({ data: { bids: [], asks: [] } })),
      axios.get(`https://fapi.binance.com/fapi/v1/aggTrades?symbol=${symbol}&limit=1000`).catch(() => ({ data: [] })),
      axios.get(`https://fapi.binance.com/fapi/v1/allForceOrders?symbol=${symbol}&limit=100`).catch(() => ({ data: [] }))
    ]);

    const ticker = tickerRes.data;
    const candles5m = candles5mRes.data;
    const candles15m = candles15mRes.data;
    
    // Order Book Imbalance Calculation
    const depth = depthRes.data;
    let totalBids = 0, totalAsks = 0;
    if (depth.bids && depth.asks) {
      depth.bids.forEach(b => totalBids += parseFloat(b[1]));
      depth.asks.forEach(a => totalAsks += parseFloat(a[1]));
    }
    const imbalance = (totalBids + totalAsks) > 0 
      ? ((totalBids - totalAsks) / (totalBids + totalAsks)).toFixed(2) 
      : '0.00';

    // Cumulative Volume Delta Calculation
    const trades = aggTradesRes.data;
    let cvd = 0;
    if (Array.isArray(trades)) {
      trades.forEach(t => {
        const qty = parseFloat(t.q); // quantity
        if (t.m) {
          cvd -= qty; // Market Sell
        } else {
          cvd += qty; // Market Buy
        }
      });
    }

    // Liquidations Calculation
    const forceOrders = forceRes.data;
    let longsLiquidated = 0;
    let shortsLiquidated = 0;
    if (Array.isArray(forceOrders)) {
      forceOrders.forEach(o => {
        const valUSD = parseFloat(o.q) * parseFloat(o.p);
        if (o.S === 'SELL') longsLiquidated += valUSD; // Long got liquidated
        else shortsLiquidated += valUSD; // Short got liquidated
      });
    }

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
      candles15m,
      orderFlow: {
        imbalance,
        cvd,
        liquidations: { longs: longsLiquidated, shorts: shortsLiquidated }
      }
    };
  } catch (error) {
    console.error(`Error fetching price data for ${symbol}:`, error.message);
    throw error;
  }
}

module.exports = { fetchPriceData };
