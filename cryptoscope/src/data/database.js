require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '3306'),
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASS     || '',
  database: process.env.DB_NAME     || 'cryptoscope',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function initDb() {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS briefs (
      id        INT AUTO_INCREMENT PRIMARY KEY,
      asset     VARCHAR(50)  NOT NULL,
      timestamp VARCHAR(50)  NOT NULL,
      content   LONGTEXT     NOT NULL
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      username   VARCHAR(100) NOT NULL UNIQUE,
      password   VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('[Database] MySQL tables ready.');
}

async function saveBrief(asset, content) {
  await pool.execute(
    'INSERT INTO briefs (asset, timestamp, content) VALUES (?, ?, ?)',
    [asset, new Date().toISOString(), content]
  );
}

async function getRecentBriefs(limit = 10) {
  const [rows] = await pool.execute(
    'SELECT * FROM briefs ORDER BY id DESC LIMIT ?',
    [limit]
  );
  return rows;
}

module.exports = { pool, initDb, saveBrief, getRecentBriefs };
