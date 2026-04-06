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
const spotFuturesJobs = new Map();
app.use(cors());
app.use(express.json());

function createJobId() {
  return `sfa_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function setSpotFuturesJob(jobId, patch) {
  const current = spotFuturesJobs.get(jobId);
  if (!current) return;
  spotFuturesJobs.set(jobId, { ...current, ...patch, updatedAt: new Date().toISOString() });
}

function compactSpotFuturesJobs() {
  const now = Date.now();
  for (const [jobId, job] of spotFuturesJobs.entries()) {
    const ageMs = now - new Date(job.updatedAt || job.createdAt).getTime();
    if (ageMs > 30 * 60 * 1000) {
      spotFuturesJobs.delete(jobId);
    }
  }
}

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
  const { asset = 'BTC/USDT', timeframe = '15m' } = req.body;
  const jobId = createJobId();
  compactSpotFuturesJobs();
  spotFuturesJobs.set(jobId, {
    id: jobId,
    status: 'queued',
    progress: 0,
    stage: 'queued',
    detail: 'Waiting to start',
    asset,
    timeframe,
    analysis: null,
    error: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  res.status(202).json({
    success: true,
    jobId,
    status: 'queued'
  });

  (async () => {
    try {
      console.log(`[webApi] Spot/Futures analysis requested: ${asset} (${timeframe}) [job ${jobId}]`);
      setSpotFuturesJob(jobId, {
        status: 'running',
        progress: 2,
        stage: 'starting',
        detail: 'Starting analysis'
      });

      const analysis = await runSpotFuturesAnalysis(asset, timeframe, ({ progress, stage, detail, timestamp }) => {
        setSpotFuturesJob(jobId, {
          status: 'running',
          progress,
          stage,
          detail,
          lastProgressAt: timestamp
        });
      });

      setSpotFuturesJob(jobId, {
        status: 'completed',
        progress: 100,
        stage: 'complete',
        detail: 'Analysis complete',
        analysis
      });
    } catch (err) {
      console.error('[webApi] Spot/Futures analyze error:', err.message);
      setSpotFuturesJob(jobId, {
        status: 'failed',
        stage: 'failed',
        detail: err.message,
        error: err.message
      });
    }
  })();
});

app.get('/api/spot-futures/analyze/:jobId', authMiddleware, async (req, res) => {
  try {
    const job = spotFuturesJobs.get(req.params.jobId);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Analysis job not found.' });
    }

    res.json({
      success: true,
      job: {
        id: job.id,
        status: job.status,
        progress: job.progress,
        stage: job.stage,
        detail: job.detail,
        asset: job.asset,
        timeframe: job.timeframe,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        error: job.error,
        analysis: job.analysis
      }
    });
  } catch (err) {
    console.error('[webApi] Spot/Futures job status error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
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
