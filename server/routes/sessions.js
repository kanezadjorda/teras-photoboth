import { Router } from 'express';
import { db } from '../db.js';
import { SESSION_STATES } from '../../src/shared/constants.js';
import { transitionSessionState } from '../../src/shared/session-state.js';
import { broadcastEvent } from '../events.js';

const router = Router();

// GET current active session
router.get('/current', (req, res) => {
  try {
    const session = db.prepare(`
      SELECT * FROM sessions 
      WHERE status NOT IN (?, ?, ?) 
      ORDER BY dibuat_pada DESC 
      LIMIT 1
    `).get(SESSION_STATES.DONE, SESSION_STATES.CANCELLED, SESSION_STATES.EXPIRED);

    res.json({ success: true, data: session || null });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// CREATE a new session
router.post('/', (req, res) => {
  try {
    const id = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const initialStatus = SESSION_STATES.WAITING_PAYMENT;

    db.prepare(`
      INSERT INTO sessions (id, template_id, status, dibuat_pada)
      VALUES (?, ?, ?, ?)
    `).run(id, null, initialStatus, now);

    const session = { id, template_id: null, status: initialStatus, dibuat_pada: now };
    broadcastEvent('session_created', session);

    res.status(201).json({ success: true, data: session });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// UPDATE session status with state machine enforcement
router.patch('/:id/status', (req, res) => {
  try {
    const { id } = req.params;
    const { status: targetStatus, template_id } = req.body;

    const currentSession = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
    if (!currentSession) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    const nextState = transitionSessionState(currentSession.status, targetStatus);

    if (template_id) {
      db.prepare('UPDATE sessions SET status = ?, template_id = ? WHERE id = ?')
        .run(nextState, template_id, id);
    } else {
      db.prepare('UPDATE sessions SET status = ? WHERE id = ?').run(nextState, id);
    }

    const updatedSession = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
    broadcastEvent('session_updated', updatedSession);

    res.json({ success: true, data: updatedSession });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;

