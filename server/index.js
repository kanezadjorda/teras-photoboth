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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const app = express();
const PORT = process.env.PORT || DEFAULTS.SERVER_PORT;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve templates and photos folder
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
app.get('/api/events', sseHandler);

// API Routes
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

