require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const { pool, initDb } = require('./database');

const DEFAULT_USER = {
  username: 'admin',
  password: 'Nazim@ibu@123',
};

async function seed() {
  try {
    console.log('[Seeder] Connecting to database...');
    await initDb();

    const [existing] = await pool.execute(
      'SELECT id FROM users WHERE username = ?',
      [DEFAULT_USER.username]
    );

    if (existing.length > 0) {
      console.log(`[Seeder] User "${DEFAULT_USER.username}" already exists. Skipping.`);
    } else {
      const hashed = await bcrypt.hash(DEFAULT_USER.password, 10);
      await pool.execute(
        'INSERT INTO users (username, password) VALUES (?, ?)',
        [DEFAULT_USER.username, hashed]
      );
      console.log(`[Seeder] ✓ Created user: ${DEFAULT_USER.username} / ${DEFAULT_USER.password}`);
    }

    console.log('[Seeder] Done.');
    process.exit(0);
  } catch (err) {
    console.error('[Seeder] Error:', err.message);
    process.exit(1);
  }
}

seed();
