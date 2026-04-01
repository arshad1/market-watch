const express = require('express');
const cors = require('cors');
const path = require('path');
const { getRecentBriefs } = require('../data/database');

const app = express();
app.use(cors());

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
