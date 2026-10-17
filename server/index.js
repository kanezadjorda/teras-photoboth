import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initDb } from './db.js';
import { sseHandler } from './events.js';
import settingsRouter from './routes/settings.js';
import templatesRouter from './routes/templates.js';
import sessionsRouter from './routes/sessions.js';
import paymentsRouter from './routes/payments.js';
import photosRouter from './routes/photos.js';
import reportsRouter from './routes/reports.js';
import { DEFAULTS } from '../src/shared/constants.js';

dotenv.config();

import eventsRouter from './routes/events.js';
import { existsSync } from 'node:fs';
import { db } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const app = express();
const PORT = process.env.PORT || DEFAULTS.SERVER_PORT;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Dynamic photo serving: check active event folder, photo record, or default output folder
app.get('/photos/:filename', (req, res, next) => {
  const { filename } = req.params;

  // 1. Check if photo record in DB has a session with an event
  try {
    const photoRow = db.prepare(`
      SELECT ph.path_file, e.folder_path
      FROM photos ph
      JOIN sessions s ON ph.session_id = s.id
      JOIN events e ON s.event_id = e.id
      WHERE ph.path_file = ?
      LIMIT 1
    `).get(filename);

    if (photoRow && photoRow.folder_path) {
      const fullPath = resolve(process.cwd(), photoRow.folder_path, filename);
      if (existsSync(fullPath)) {
        return res.sendFile(fullPath);
      }
    }
  } catch (err) {
    // continue to fallbacks
  }

  // 2. Check in active event folder
  try {
    const activeEvent = db.prepare('SELECT folder_path FROM events WHERE aktif = 1 LIMIT 1').get();
    if (activeEvent && activeEvent.folder_path) {
      const activePath = resolve(process.cwd(), activeEvent.folder_path, filename);
      if (existsSync(activePath)) {
        return res.sendFile(activePath);
      }
    }
  } catch (err) {
    // continue
  }

  // 3. Fallback to default output folder
  const setting = db.prepare("SELECT value FROM settings WHERE key = 'output_folder'").get();
  const defaultFolder = setting?.value || process.env.OUTPUT_FOLDER || './data/photos';
  const defaultFullPath = resolve(process.cwd(), defaultFolder, filename);
  if (existsSync(defaultFullPath)) {
    return res.sendFile(defaultFullPath);
  }

  next();
});

// Serve templates and default photos folder statically
app.use('/templates', express.static(resolve(__dirname, '../templates')));
app.use('/photos', express.static(resolve(process.cwd(), process.env.OUTPUT_FOLDER || './data/photos')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Real-time Server-Sent Events (SSE)
app.get('/events', sseHandler);
app.get('/api/sse', sseHandler);

// Handle SSE requests to /api/events (from EventSource) or pass to eventsRouter (REST API)
app.use('/api/events', (req, res, next) => {
  if (req.headers.accept && req.headers.accept.includes('text/event-stream')) {
    return sseHandler(req, res);
  }
  next();
});

// API Routes
app.use('/api/events', eventsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/sessions', photosRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/reports', reportsRouter);

/**
 * Start Express HTTP server
 * @param {number} [port]
 * @returns {Promise<import('http').Server>}
 */
export function startServer(port = PORT) {
  initDb();
  return new Promise((resolvePromise) => {
    const server = app.listen(port, () => {
      console.log(`[Express] Photobooth server running on http://localhost:${port}`);
      resolvePromise(server);
    });
  });
}

// Start standalone if executed directly
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  startServer();
}

