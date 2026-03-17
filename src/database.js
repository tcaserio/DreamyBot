const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS birthdays (
      user_id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      month INTEGER NOT NULL,
      day INTEGER NOT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS applications (
      id SERIAL PRIMARY KEY,
      in_game_name TEXT NOT NULL,
      rules_agreed BOOLEAN NOT NULL,
      how_found TEXT NOT NULL,
      vibe_check TEXT NOT NULL,
      welcome_package TEXT,
      discord_username TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      responses JSONB NOT NULL DEFAULT '[]',
      gifts_given JSONB NOT NULL DEFAULT '{}',
      message_id TEXT,
      channel_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

const getOne = async (text, params = []) => (await pool.query(text, params)).rows[0];
const getAll = async (text, params = []) => (await pool.query(text, params)).rows;
const run   = async (text, params = []) => pool.query(text, params);

module.exports = { init, getOne, getAll, run };
