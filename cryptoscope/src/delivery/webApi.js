const express = require('express');
const cors = require('cors');
const path = require('path');
const { getRecentBriefs, initDb } = require('../data/database');
const { analyzeStrategy, STRATEGIES, buildMockOptionsChain } = require('../optionsEngine');
const { runSpotFuturesAnalysis } = require('../spotFuturesEngine');
const { runPipeline } = require('../briefPipeline');
const { router: authRouter, authMiddleware } = require('../auth');

const app = express();
app.use(cors());
app.use(express.json());

// ── Auth Routes (public) ──────────────────────────────────────────────────────
app.use('/api/auth', authRouter);

// ── Health check (public) ─────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ── Protected: Briefs ─────────────────────────────────────────────────────────
app.get('/api/briefs', authMiddleware, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const briefs = await getRecentBriefs(limit);
    res.json({ success: true, count: briefs.length, briefs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

let briefGenerationInFlight = false;

app.post('/api/briefs/generate', authMiddleware, async (req, res) => {
  if (briefGenerationInFlight) {
    return res.status(409).json({
      success: false,
      error: 'A market brief is already being generated.'
    });
  }

  briefGenerationInFlight = true;

  try {
    const asset = req.body?.asset || process.env.ASSET || 'BTC/USDT';
    const result = await runPipeline(asset);
    const briefs = await getRecentBriefs(1);

    res.json({
      success: true,
      message: 'Market brief generated successfully.',
      brief: briefs[0] || { asset: result.asset, content: result.content }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally {
    briefGenerationInFlight = false;
  }
});

// ── Protected: Options ────────────────────────────────────────────────────────

app.get('/api/options/strategies', authMiddleware, (req, res) => {
  res.json({ success: true, strategies: STRATEGIES });
});

app.get('/api/options/chain', authMiddleware, (req, res) => {
  try {
    const price = parseFloat(req.query.price) || 50000;
    const chain = buildMockOptionsChain(price);
    res.json({ success: true, chain });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/options/analyze', authMiddleware, async (req, res) => {
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

// ── Protected: Spot / Futures ─────────────────────────────────────────────────

app.post('/api/spot-futures/analyze', authMiddleware, async (req, res) => {
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

// ── 404 for unmatched /api/* routes ──────────────────────────────────────────
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, error: `Cannot ${req.method} ${req.path}` });
});

// ── Serve dashboard (SPA fallback) ────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../../dashboard/dist')));
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, '../../dashboard/dist/index.html'));
  } else {
    next();
  }
});

async function startServer() {
  if (process.env.ENABLE_WEB !== 'true') return;

  await initDb();

  const port = process.env.WEB_PORT || 3101;
  const server = app.listen(port, () => {
    console.log(`[WebApi] Dashboard API server running on port ${port}`);
  });

  server.on('error', (err) => {
    console.error(`[WebApi] Failed to start on port ${port}: ${err.message}`);
  });
}

module.exports = { startServer };
