import Database from 'better-sqlite3';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import dotenv from 'dotenv';
import { DEFAULTS } from '../src/shared/constants.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = process.env.DATABASE_PATH
  ? resolve(process.cwd(), process.env.DATABASE_PATH)
  : resolve(__dirname, '../data/photobooth.db');

mkdirSync(dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);

// Enable WAL mode for better concurrency and performance
db.pragma('journal_mode = WAL');

/**
 * Initialize SQLite database schema
 */
export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      nama TEXT NOT NULL,
      file_png TEXT NOT NULL,
      jumlah_slot INTEGER NOT NULL,
      aktif INTEGER NOT NULL DEFAULT 1,
      slots_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      template_id TEXT,
      status TEXT NOT NULL,
      dibuat_pada TEXT NOT NULL,
      FOREIGN KEY(template_id) REFERENCES templates(id)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      order_id TEXT,
      nominal INTEGER NOT NULL,
      status TEXT NOT NULL,
      qris_string TEXT,
      dibayar_pada TEXT,
      FOREIGN KEY(session_id) REFERENCES sessions(id)
    );

    CREATE TABLE IF NOT EXISTS photos (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      urutan INTEGER NOT NULL,
      path_file TEXT NOT NULL,
      FOREIGN KEY(session_id) REFERENCES sessions(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Seed default settings if empty
  const insertSetting = db.prepare(`
    INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)
  `);

  const initialSettings = [
    ['session_price', String(DEFAULTS.SESSION_PRICE)],
    ['copies_per_session', String(DEFAULTS.COPIES_PER_SESSION)],
    ['admin_pin', process.env.ADMIN_PIN || DEFAULTS.ADMIN_PIN],
    ['output_folder', process.env.OUTPUT_FOLDER || './data/photos']
  ];

  const transaction = db.transaction((settingsList) => {
    for (const [key, value] of settingsList) {
      insertSetting.run(key, value);
    }
  });

  transaction(initialSettings);
}
