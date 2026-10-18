import Database from 'better-sqlite3';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import dotenv from 'dotenv';
import { DEFAULTS, TIMEOUTS } from '../src/shared/constants.js';

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
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      nama TEXT NOT NULL,
      folder_path TEXT NOT NULL,
      aktif INTEGER NOT NULL DEFAULT 0,
      dibuat_pada TEXT NOT NULL
    );

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
      event_id TEXT,
      status TEXT NOT NULL,
      dibuat_pada TEXT NOT NULL,
      FOREIGN KEY(template_id) REFERENCES templates(id),
      FOREIGN KEY(event_id) REFERENCES events(id)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      order_id TEXT,
      nominal INTEGER NOT NULL,
      status TEXT NOT NULL,
      qris_string TEXT,
      qr_code_url TEXT,
      qr_code_url_v2 TEXT,
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

  // Safe migration for existing sessions table (event_id column)
  const sessionCols = db.prepare('PRAGMA table_info(sessions)').all().map((c) => c.name);
  if (!sessionCols.includes('event_id')) {
    db.exec('ALTER TABLE sessions ADD COLUMN event_id TEXT');
  }

  // Safe migration for existing payments table
  const paymentCols = db.prepare('PRAGMA table_info(payments)').all().map((c) => c.name);
  if (!paymentCols.includes('qr_code_url')) {
    db.exec('ALTER TABLE payments ADD COLUMN qr_code_url TEXT');
  }
  if (!paymentCols.includes('qr_code_url_v2')) {
    db.exec('ALTER TABLE payments ADD COLUMN qr_code_url_v2 TEXT');
  }

  // Seed default event if empty
  const eventCount = db.prepare('SELECT count(*) as count FROM events').get();
  if (eventCount.count === 0) {
    const defaultFolder = process.env.OUTPUT_FOLDER || './data/photos';
    const nowIso = new Date().toISOString();
    db.prepare(`
      INSERT INTO events (id, nama, folder_path, aktif, dibuat_pada)
      VALUES (?, ?, ?, 1, ?)
    `).run('evt_default', 'Event Reguler', defaultFolder, nowIso);

    // Link existing sessions to default event
    db.prepare("UPDATE sessions SET event_id = 'evt_default' WHERE event_id IS NULL").run();
  }

  // Seed default settings if empty
  const insertSetting = db.prepare(`
    INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)
  `);

  const initialSettings = [
    ['session_price', String(DEFAULTS.SESSION_PRICE)],
    ['copies_per_session', String(DEFAULTS.COPIES_PER_SESSION)],
    ['countdown_seconds', String(TIMEOUTS.COUNTDOWN_SECONDS || 3)],
    ['admin_pin', process.env.ADMIN_PIN || DEFAULTS.ADMIN_PIN],
    ['output_folder', process.env.OUTPUT_FOLDER || './data/photos']
  ];

  const transaction = db.transaction((settingsList) => {
    for (const [key, value] of settingsList) {
      insertSetting.run(key, value);
    }
  });

  transaction(initialSettings);

  // Seed default template if empty
  const templateCount = db.prepare('SELECT count(*) as count FROM templates').get();
  if (templateCount.count === 0) {
    const insertTemplate = db.prepare(`
      INSERT INTO templates (id, nama, file_png, jumlah_slot, aktif, slots_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const defaultSlots = [
      { x: 100, y: 120, w: 1000, h: 460 },
      { x: 100, y: 640, w: 1000, h: 460 },
      { x: 100, y: 1160, w: 1000, h: 460 }
    ];
    insertTemplate.run(
      'strip-3',
      'Strip 3 Foto Klasik',
      'strip-3.png',
      3,
      1,
      JSON.stringify(defaultSlots)
    );

    // Ensure dummy template file exists
    const tplFile = resolve(process.cwd(), 'templates', 'strip-3.png');
    if (!existsSync(tplFile)) {
      const dummyPng = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAAElFTkSuQmCC',
        'base64'
      );
      try {
        writeFileSync(tplFile, dummyPng);
      } catch (e) {
        console.warn('[DB] Gagal menulis dummy template PNG:', e.message);
      }
    }
  }
}

// Ensure schema, migrations, and default seed data are initialized
initDb();

