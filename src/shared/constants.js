/**
 * Application Constants
 * Source of truth: docs/PRD.md and GEMINI.md
 */

export const SESSION_STATES = Object.freeze({
  WAITING_PAYMENT: 'waiting_payment',
  CHOOSING_TEMPLATE: 'choosing_template',
  CAPTURING: 'capturing',
  REVIEWING: 'reviewing',
  PRINTING: 'printing',
  DONE: 'done',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired'
});

export const PAYMENT_STATES = Object.freeze({
  PENDING: 'pending',
  PAID: 'paid',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
  FAILED: 'failed'
});

export const CANVAS_SPECS = Object.freeze({
  WIDTH: 1200,
  HEIGHT: 1800,
  DPI: 300,
  PAPER_FORMAT: '4R'
});

export const TIMEOUTS = Object.freeze({
  PAYMENT_SECONDS: 180, // 3 minutes QRIS expiration countdown
  PAYMENT_POLL_INTERVAL_MS: 2500, // Poll every 2-3 seconds
  COUNTDOWN_SECONDS: 3, // 3-2-1 photo countdown
  DONE_SCREEN_SECONDS: 10 // Auto return to welcome
});

export const DEFAULTS = Object.freeze({
  SESSION_PRICE: 25000,
  COPIES_PER_SESSION: 1,
  ADMIN_PIN: '1234',
  SERVER_PORT: 3000,
  CLIENT_PORT: 5173,
  MAX_RETAKES_PER_SLOT: 1
});
