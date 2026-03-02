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
}

const getOne = async (text, params = []) => (await pool.query(text, params)).rows[0];
const getAll = async (text, params = []) => (await pool.query(text, params)).rows;
const run   = async (text, params = []) => pool.query(text, params);

module.exports = { init, getOne, getAll, run };
