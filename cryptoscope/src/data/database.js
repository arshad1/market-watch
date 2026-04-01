const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'briefs.db');
const db = new Database(dbPath);

// Initialize DB schema
db.exec(`
  CREATE TABLE IF NOT EXISTS briefs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    content TEXT NOT NULL
  )
`);

function saveBrief(asset, content) {
  const stmt = db.prepare('INSERT INTO briefs (asset, timestamp, content) VALUES (?, ?, ?)');
  stmt.run(asset, new Date().toISOString(), content);
}

function getRecentBriefs(limit = 10) {
  const stmt = db.prepare('SELECT * FROM briefs ORDER BY id DESC LIMIT ?');
  return stmt.all(limit);
}

module.exports = {
  saveBrief,
  getRecentBriefs
};
