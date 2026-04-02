const express = require('express');
const cors = require('cors');
const path = require('path');
const { getRecentBriefs } = require('../data/database');
const { analyzeStrategy, STRATEGIES, buildMockOptionsChain } = require('../optionsEngine');
const { runSpotFuturesAnalysis } = require('../spotFuturesEngine');

const app = express();
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Fetch recent briefs
app.get('/api/briefs', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const briefs = getRecentBriefs(limit);
    res.json({ success: true, count: briefs.length, briefs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── OPTIONS STRATEGY ENDPOINTS ──────────────────────────────────────────────

/**
 * GET /api/options/strategies
 * Returns list of all predefined strategies with their metadata
 */
app.get('/api/options/strategies', (req, res) => {
  res.json({ success: true, strategies: STRATEGIES });
});

/**
 * GET /api/options/chain?price=<price>
 * Returns a mock options chain for the given price
 */
app.get('/api/options/chain', (req, res) => {
  try {
    const price = parseFloat(req.query.price) || 50000;
    const chain = buildMockOptionsChain(price);
    res.json({ success: true, chain });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/options/analyze
 * Runs AI analysis on the given strategy + legs + market data
 * Body: { strategyId, legs: [{ type, direction, strike, expiry, quantity }], marketData: { asset, price, ... } }
 */
app.post('/api/options/analyze', async (req, res) => {
  try {
    const { strategyId, legs, marketData } = req.body;

    if (!strategyId || !legs || !Array.isArray(legs) || legs.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'strategyId and at least one leg are required.'
      });
    }

    if (!marketData || !marketData.price) {
      return res.status(400).json({
        success: false,
        error: 'marketData with price is required.'
      });
    }

    console.log(`[webApi] Options analysis requested for strategy: ${strategyId}`);
    const analysis = await analyzeStrategy(strategyId, legs, marketData);
    res.json({ success: true, analysis });

  } catch (err) {
    console.error('[webApi] Options analyze error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── SPOT / FUTURES STRATEGY ENDPOINTS ───────────────────────────────────────

/**
 * POST /api/spot-futures/analyze
 * Fetches live Binance data, computes all indicators, runs 7-strategy AI analysis
 * Body: { asset: "BTC/USDT", timeframe: "15m" }
 */
app.post('/api/spot-futures/analyze', async (req, res) => {
  try {
    const { asset = 'BTC/USDT', timeframe = '15m' } = req.body;
    console.log(`[webApi] Spot/Futures analysis requested: ${asset} (${timeframe})`);
    const analysis = await runSpotFuturesAnalysis(asset, timeframe);
    res.json({ success: true, analysis });
  } catch (err) {
    console.error('[webApi] Spot/Futures analyze error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

// Serve frontend dashboard built files out of /dashboard/dist
app.use(express.static(path.join(__dirname, '../../dashboard/dist')));
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, '../../dashboard/dist/index.html'));
  } else {
    next();
  }
});

function startServer() {
  if (process.env.ENABLE_WEB !== 'true') return;

  const port = process.env.WEB_PORT || 3001;
  app.listen(port, () => {
    console.log(`[WebApi] Dashboard API server running on port ${port}`);
  });
}

module.exports = { startServer };
