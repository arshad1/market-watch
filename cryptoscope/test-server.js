require('dotenv').config();
const express = require('express');
const app = express();

app.get('/ping', (req, res) => {
  console.log('[test] ping received');
  res.json({ pong: true });
});

const port = process.env.WEB_PORT || 3001;
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`[test] listening on http://0.0.0.0:${port}`);
});

server.on('error', (err) => {
  console.error('[test] server error:', err.message);
});
