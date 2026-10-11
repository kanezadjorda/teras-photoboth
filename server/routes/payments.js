import { Router } from 'express';
import { db } from '../db.js';
import { PAYMENT_STATES, SESSION_STATES, TIMEOUTS, DEFAULTS } from '../../src/shared/constants.js';
import { broadcastEvent } from '../events.js';
import {
  createQrisCharge,
  checkTransactionStatus,
  simulateMockPayment
} from '../payment/midtrans.js';

const router = Router();

// Store active polling intervals per session
const activePollers = new Map();

/**
 * Start Server-Side Polling for Payment Status (F-02)
 */
function startPollingWorker(sessionId, orderId) {
  if (activePollers.has(sessionId)) {
    clearInterval(activePollers.get(sessionId));
    activePollers.delete(sessionId);
  }

  const startTime = Date.now();

  const intervalId = setInterval(async () => {
    try {
      // 1. Check if session was already completed/cancelled
      const currentSession = db.prepare('SELECT status FROM sessions WHERE id = ?').get(sessionId);
      if (!currentSession || currentSession.status !== SESSION_STATES.WAITING_PAYMENT) {
        clearInterval(intervalId);
        activePollers.delete(sessionId);
        return;
      }

      // 2. Check 3-minute timeout
      const elapsedSeconds = (Date.now() - startTime) / 1000;
      if (elapsedSeconds >= TIMEOUTS.PAYMENT_SECONDS) {
        clearInterval(intervalId);
        activePollers.delete(sessionId);

        db.prepare('UPDATE payments SET status = ? WHERE session_id = ? AND status = ?')
          .run(PAYMENT_STATES.EXPIRED, sessionId, PAYMENT_STATES.PENDING);
        db.prepare('UPDATE sessions SET status = ? WHERE id = ? AND status = ?')
          .run(SESSION_STATES.EXPIRED, sessionId, SESSION_STATES.WAITING_PAYMENT);

        console.log(`[Payment] Pembayaran sesi ${sessionId} telah kedaluwarsa (3 menit).`);
        broadcastEvent('payment_expired', { sessionId, orderId });
        broadcastEvent('session_updated', { id: sessionId, status: SESSION_STATES.EXPIRED });
        return;
      }

      // 3. Poll Midtrans Gateway Status
      const statusRes = await checkTransactionStatus(orderId);

      if (statusRes.internalStatus === PAYMENT_STATES.PAID) {
        clearInterval(intervalId);
        activePollers.delete(sessionId);

        const now = new Date().toISOString();
        db.prepare('UPDATE payments SET status = ?, dibayar_pada = ? WHERE session_id = ?')
          .run(PAYMENT_STATES.PAID, now, sessionId);

        db.prepare('UPDATE sessions SET status = ? WHERE id = ?')
          .run(SESSION_STATES.CHOOSING_TEMPLATE, sessionId);

        console.log(`[Payment] Sesi ${sessionId} terbayar lunas via QRIS!`);
        broadcastEvent('payment_paid', { sessionId, orderId });
        broadcastEvent('session_updated', { id: sessionId, status: SESSION_STATES.CHOOSING_TEMPLATE });
      }
    } catch (err) {
      console.warn(`[Payment] Polling status order ${orderId} error:`, err.message);
    }
  }, TIMEOUTS.PAYMENT_POLL_INTERVAL_MS);

  activePollers.set(sessionId, intervalId);
}

/**
 * POST /api/payments/charge
 * Generate Dynamic QRIS Charge for a session (F-01, F-03)
 */
router.post('/charge', async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'sessionId wajib diisi' });
    }

    // Verify session
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, error: 'Sesi tidak ditemukan' });
    }

    if (session.status !== SESSION_STATES.WAITING_PAYMENT) {
      return res.status(400).json({
        success: false,
        error: `Sesi tidak dalam status waiting_payment (saat ini: ${session.status})`
      });
    }

    // Get session price from settings
    const priceRow = db.prepare("SELECT value FROM settings WHERE key = 'session_price'").get();
    const sessionPrice = priceRow ? parseInt(priceRow.value, 10) : DEFAULTS.SESSION_PRICE;

    // Check existing payment
    const existingPayment = db.prepare('SELECT * FROM payments WHERE session_id = ? LIMIT 1').get(sessionId);
    if (existingPayment && existingPayment.status === PAYMENT_STATES.PAID) {
      return res.json({ success: true, data: existingPayment });
    }

    // Generate dynamic QRIS with Midtrans Core API
    const orderId = sessionId;
    const charge = await createQrisCharge({ orderId, amount: sessionPrice });

    const paymentId = existingPayment ? existingPayment.id : `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const qrisData = charge.qrUrl || charge.qrString;

    if (existingPayment) {
      db.prepare(`
        UPDATE payments SET nominal = ?, status = ?, qris_string = ?, order_id = ?
        WHERE id = ?
      `).run(sessionPrice, PAYMENT_STATES.PENDING, qrisData, orderId, paymentId);
    } else {
      db.prepare(`
        INSERT INTO payments (id, session_id, order_id, nominal, status, qris_string, dibayar_pada)
        VALUES (?, ?, ?, ?, ?, ?, NULL)
      `).run(paymentId, sessionId, orderId, sessionPrice, PAYMENT_STATES.PENDING, qrisData);
    }

    // Start background polling worker
    startPollingWorker(sessionId, orderId);

    res.json({
      success: true,
      data: {
        id: paymentId,
        session_id: sessionId,
        order_id: orderId,
        nominal: sessionPrice,
        status: PAYMENT_STATES.PENDING,
        qr_url: charge.qrUrl,
        raw_qr_url: charge.rawQrUrl || '',
        qr_string: charge.qrString,
        is_mock: charge.isMock
      }
    });
  } catch (error) {
    console.error('[Payment] Gagal membuat charge:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/payments/:sessionId
 * Fetch payment status by session_id
 */
router.get('/:sessionId', (req, res) => {
  try {
    const payment = db.prepare('SELECT * FROM payments WHERE session_id = ? ORDER BY id DESC LIMIT 1')
      .get(req.params.sessionId);

    if (!payment) {
      return res.status(404).json({ success: false, error: 'Data pembayaran tidak ditemukan' });
    }

    res.json({ success: true, data: payment });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/payments/:sessionId/confirm-manual
 * Staff Manual Confirmation Fallback (F-04)
 */
router.post('/:sessionId/confirm-manual', (req, res) => {
  try {
    const { sessionId } = req.params;
    const now = new Date().toISOString();

    const payment = db.prepare('SELECT * FROM payments WHERE session_id = ? LIMIT 1').get(sessionId);
    if (!payment) {
      return res.status(404).json({ success: false, error: 'Data pembayaran tidak ditemukan' });
    }

    // Stop active poller if running
    if (activePollers.has(sessionId)) {
      clearInterval(activePollers.get(sessionId));
      activePollers.delete(sessionId);
    }

    db.prepare('UPDATE payments SET status = ?, dibayar_pada = ? WHERE id = ?')
      .run(PAYMENT_STATES.PAID, now, payment.id);

    // Update session to CHOOSING_TEMPLATE
    db.prepare('UPDATE sessions SET status = ? WHERE id = ?')
      .run(SESSION_STATES.CHOOSING_TEMPLATE, sessionId);

    broadcastEvent('payment_paid', { sessionId, manual: true });
    broadcastEvent('session_updated', { id: sessionId, status: SESSION_STATES.CHOOSING_TEMPLATE });

    res.json({ success: true, message: 'Pembayaran berhasil dikonfirmasi secara manual' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/payments/:orderId/simulate-pay
 * Sandbox / Testing helper to simulate customer paying via QRIS
 */
router.post('/:orderId/simulate-pay', (req, res) => {
  try {
    const { orderId } = req.params;
    const now = new Date().toISOString();

    // 1. Update in-memory mock store if present
    simulateMockPayment(orderId);

    // 2. Find and update database records immediately
    const payment = db.prepare('SELECT * FROM payments WHERE order_id = ? OR session_id = ? LIMIT 1').get(orderId, orderId);

    if (payment) {
      db.prepare('UPDATE payments SET status = ?, dibayar_pada = ? WHERE id = ?')
        .run(PAYMENT_STATES.PAID, now, payment.id);

      db.prepare('UPDATE sessions SET status = ? WHERE id = ?')
        .run(SESSION_STATES.CHOOSING_TEMPLATE, payment.session_id);

      if (activePollers.has(payment.session_id)) {
        clearInterval(activePollers.get(payment.session_id));
        activePollers.delete(payment.session_id);
      }

      broadcastEvent('payment_paid', { sessionId: payment.session_id, orderId });
      broadcastEvent('session_updated', { id: payment.session_id, status: SESSION_STATES.CHOOSING_TEMPLATE });
    }

    res.json({
      success: true,
      simulated: true,
      message: `Status transaksi ${orderId} berhasil diubah menjadi lunas (settlement).`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
