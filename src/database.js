const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

const db = new Database(path.join(dataDir, 'birthdays.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS birthdays (
    user_id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    month INTEGER NOT NULL,
    day INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

module.exports = db;
