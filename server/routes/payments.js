import { Router } from 'express';
import { db } from '../db.js';
import { PAYMENT_STATES, SESSION_STATES, TIMEOUTS, DEFAULTS } from '../../src/shared/constants.js';
import { broadcastEvent } from '../events.js';
import {
  createQrisCharge,
  checkTransactionStatus,
  cancelTransaction,
  simulateMockPayment,
  isSandboxMode
} from '../payment/midtrans.js';

const router = Router();

// Store active polling intervals per session
const activePollers = new Map();

/**
 * Stop active polling worker for a session
 */
export function stopPollingWorker(sessionId) {
  if (activePollers.has(sessionId)) {
    clearInterval(activePollers.get(sessionId));
    activePollers.delete(sessionId);
  }
}

/**
 * Cancel session payment instantly in local DB and Midtrans (PRD F-01, F-16)
 * @param {string} sessionId
 */
export async function cancelSessionPayment(sessionId) {
  stopPollingWorker(sessionId);

  const pendingPayment = db.prepare('SELECT * FROM payments WHERE session_id = ? AND status = ?')
    .get(sessionId, PAYMENT_STATES.MENUNGGU);

  if (pendingPayment) {
    db.prepare('UPDATE payments SET status = ? WHERE id = ?')
      .run(PAYMENT_STATES.BATAL, pendingPayment.id);

    const orderId = pendingPayment.order_id || sessionId;
    try {
      await cancelTransaction(orderId);
    } catch (e) {
      console.warn(`[Payment] Gagal membatalkan transaksi Midtrans ${orderId}:`, e.message);
    }

    broadcastEvent('payment_failed', { sessionId, orderId, reason: 'cancel' });
    broadcastEvent('payment_cancelled', { sessionId, orderId });
    return { success: true, paymentId: pendingPayment.id, status: PAYMENT_STATES.BATAL };
  }

  return { success: true, message: 'Tidak ada pembayaran tertunda' };
}

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
          .run(PAYMENT_STATES.GAGAL, sessionId, PAYMENT_STATES.MENUNGGU);
        db.prepare('UPDATE sessions SET status = ? WHERE id = ? AND status = ?')
          .run(SESSION_STATES.EXPIRED, sessionId, SESSION_STATES.WAITING_PAYMENT);

        console.log(`[Payment] Pembayaran sesi ${sessionId} telah kedaluwarsa (3 menit).`);
        broadcastEvent('payment_expired', { sessionId, orderId });
        broadcastEvent('session_updated', { id: sessionId, status: SESSION_STATES.EXPIRED });
        return;
      }

      // 3. Poll Midtrans Gateway Status
      const statusRes = await checkTransactionStatus(orderId);

      if (statusRes.internalStatus === PAYMENT_STATES.LUNAS) {
        clearInterval(intervalId);
        activePollers.delete(sessionId);

        const now = new Date().toISOString();
        db.prepare('UPDATE payments SET status = ?, dibayar_pada = ? WHERE session_id = ?')
          .run(PAYMENT_STATES.LUNAS, now, sessionId);

        db.prepare('UPDATE sessions SET status = ? WHERE id = ?')
          .run(SESSION_STATES.CHOOSING_TEMPLATE, sessionId);

        console.log(`[Payment] Sesi ${sessionId} terbayar lunas via QRIS!`);
        broadcastEvent('payment_paid', { sessionId, orderId });
        broadcastEvent('session_updated', { id: sessionId, status: SESSION_STATES.CHOOSING_TEMPLATE });
      } else if (
        statusRes.internalStatus === PAYMENT_STATES.GAGAL ||
        statusRes.internalStatus === PAYMENT_STATES.BATAL
      ) {
        clearInterval(intervalId);
        activePollers.delete(sessionId);

        db.prepare('UPDATE payments SET status = ? WHERE session_id = ?')
          .run(statusRes.internalStatus, sessionId);

        const nextSessionState =
          statusRes.status === 'cancel' || statusRes.status === 'cancelled'
            ? SESSION_STATES.CANCELLED
            : SESSION_STATES.EXPIRED;

        db.prepare('UPDATE sessions SET status = ? WHERE id = ? AND status = ?')
          .run(nextSessionState, sessionId, SESSION_STATES.WAITING_PAYMENT);

        console.log(`[Payment] Pembayaran sesi ${sessionId} status: ${statusRes.status}.`);
        broadcastEvent('payment_failed', { sessionId, orderId, reason: statusRes.status });
        broadcastEvent('payment_expired', { sessionId, orderId, reason: statusRes.status });
        broadcastEvent('session_updated', { id: sessionId, status: nextSessionState });
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
    if (existingPayment && (existingPayment.status === PAYMENT_STATES.LUNAS || existingPayment.status === 'paid')) {
      return res.json({ success: true, data: existingPayment });
    }

    // Generate dynamic QRIS with Midtrans Core API
    const orderId = sessionId;
    const charge = await createQrisCharge({ orderId, amount: sessionPrice });

    const paymentId = existingPayment ? existingPayment.id : `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const qrisData = charge.qrUrl || charge.qrString;
    const qrCodeUrl = charge.qrCodeUrl || '';
    const qrCodeUrlV2 = charge.qrCodeUrlV2 || '';

    if (existingPayment) {
      db.prepare(`
        UPDATE payments
        SET nominal = ?, status = ?, qris_string = ?, qr_code_url = ?, qr_code_url_v2 = ?, order_id = ?
        WHERE id = ?
      `).run(sessionPrice, PAYMENT_STATES.MENUNGGU, qrisData, qrCodeUrl, qrCodeUrlV2, orderId, paymentId);
    } else {
      db.prepare(`
        INSERT INTO payments (id, session_id, order_id, nominal, status, qris_string, qr_code_url, qr_code_url_v2, dibayar_pada)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)
      `).run(paymentId, sessionId, orderId, sessionPrice, PAYMENT_STATES.MENUNGGU, qrisData, qrCodeUrl, qrCodeUrlV2);
    }

    // Start background polling worker
    startPollingWorker(sessionId, orderId);

    const sandbox = isSandboxMode();

    res.json({
      success: true,
      data: {
        id: paymentId,
        session_id: sessionId,
        order_id: orderId,
        nominal: sessionPrice,
        status: PAYMENT_STATES.MENUNGGU,
        qr_url: charge.qrUrl,
        qr_string: charge.qrString,
        is_mock: charge.isMock,
        midtrans_env: sandbox ? 'sandbox' : 'production',
        ...(sandbox
          ? {
              raw_qr_url: qrCodeUrl,
              qr_code_url: qrCodeUrl,
              qr_code_url_v2: qrCodeUrlV2,
              actions: {
                'generate-qr-code': qrCodeUrl,
                'generate-qr-code-v2': qrCodeUrlV2
              }
            }
          : {})
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

    const sandbox = isSandboxMode();
    if (!sandbox) {
      delete payment.qr_code_url;
      delete payment.qr_code_url_v2;
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

/**
 * POST /api/payments/:sessionId/cancel
 * Membatalkan pembayaran sesi secara instan (PRD F-01, F-16)
 */
router.post('/:sessionId/cancel', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const result = await cancelSessionPayment(sessionId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
