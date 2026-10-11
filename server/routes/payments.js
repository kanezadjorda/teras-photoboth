import { Router } from 'express';
import { db } from '../db.js';
import { PAYMENT_STATES, SESSION_STATES } from '../../src/shared/constants.js';
import { broadcastEvent } from '../events.js';

const router = Router();

// GET payment status by session_id
router.get('/:sessionId', (req, res) => {
  try {
    const payment = db.prepare('SELECT * FROM payments WHERE session_id = ? ORDER BY dibayar_pada DESC LIMIT 1')
      .get(req.params.sessionId);

    if (!payment) {
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }

    res.json({ success: true, data: payment });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Manual payment confirmation fallback by staff (F-04)
router.post('/:sessionId/confirm-manual', (req, res) => {
  try {
    const { sessionId } = req.params;
    const now = new Date().toISOString();

    const payment = db.prepare('SELECT * FROM payments WHERE session_id = ? LIMIT 1').get(sessionId);
    if (!payment) {
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }

    db.prepare('UPDATE payments SET status = ?, dibayar_pada = ? WHERE id = ?')
      .run(PAYMENT_STATES.PAID, now, payment.id);

    // Also update session to CHOOSING_TEMPLATE
    db.prepare('UPDATE sessions SET status = ? WHERE id = ?')
      .run(SESSION_STATES.CHOOSING_TEMPLATE, sessionId);

    broadcastEvent('payment_paid', { sessionId, manual: true });
    broadcastEvent('session_updated', { id: sessionId, status: SESSION_STATES.CHOOSING_TEMPLATE });

    res.json({ success: true, message: 'Payment confirmed manually' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;

