const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { getRecentBriefs, initDb } = require('../data/database');
const { analyzeStrategy, STRATEGIES, buildMockOptionsChain } = require('../optionsEngine');
const { runSpotFuturesAnalysis } = require('../spotFuturesEngine');
const { runPipeline } = require('../briefPipeline');
const { router: authRouter, authMiddleware } = require('../auth');

const app = express();
const dashboardDistPath = path.join(__dirname, '../../dashboard/dist');
const dashboardIndexPath = path.join(dashboardDistPath, 'index.html');
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

let activeSpotControllers = [];

app.post('/api/spot-futures/analyze', authMiddleware, async (req, res) => {
  const abortController = new AbortController();
  activeSpotControllers.push(abortController);

  try {
    const { asset = 'BTC/USDT', timeframe = '15m' } = req.body;
    console.log(`[webApi] Spot/Futures analysis requested: ${asset} (${timeframe})`);
    
    const analysis = await runSpotFuturesAnalysis(asset, timeframe, abortController.signal);
    
    if (!res.headersSent) {
      res.json({ success: true, analysis });
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      console.log(`[webApi] Spot/Futures analysis explicitly aborted.`);
      return;
    }
    console.error('[webApi] Spot/Futures analyze error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: err.message });
    }
  } finally {
    activeSpotControllers = activeSpotControllers.filter(c => c !== abortController);
  }
});

app.post('/api/spot-futures/cancel', authMiddleware, (req, res) => {
  console.log('[webApi] Received explicit cancel request from client.');
  activeSpotControllers.forEach(c => c.abort());
  activeSpotControllers = [];
  res.json({ success: true });
});

// ── 404 for unmatched /api/* routes ──────────────────────────────────────────
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, error: `Cannot ${req.method} ${req.path}` });
});

// ── Serve dashboard (SPA fallback) ────────────────────────────────────────────
app.use(express.static(dashboardDistPath));
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api/')) {
    if (!fs.existsSync(dashboardIndexPath)) {
      return res.status(503).json({
        success: false,
        error: 'Dashboard build not found. Run `npm run build` in the project root.'
      });
    }
    res.sendFile(dashboardIndexPath);
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
