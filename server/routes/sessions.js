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

// GET /api/sessions/history - Riwayat sesi transaksi
router.get('/history', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT 
        s.rowid as session_no,
        s.id,
        s.template_id,
        s.status as session_status,
        s.dibuat_pada,
        t.nama as template_nama,
        p.nominal,
        p.status as payment_status,
        ph.path_file as composite_file
      FROM sessions s
      LEFT JOIN templates t ON s.template_id = t.id
      LEFT JOIN payments p ON p.session_id = s.id
      LEFT JOIN photos ph ON ph.session_id = s.id AND ph.urutan = 0
      ORDER BY s.rowid DESC
      LIMIT 100
    `).all();

    const formattedRows = rows.map((r) => ({
      ...r,
      formatted_session_no: String(r.session_no).padStart(4, '0')
    }));

    res.json({ success: true, data: formattedRows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/sessions/:id/reprint - Ambil info foto komposit untuk cetak ulang
router.post('/:id/reprint', (req, res) => {
  try {
    const { id } = req.params;
    const session = db.prepare('SELECT rowid, * FROM sessions WHERE id = ?').get(id);
    if (!session) {
      return res.status(404).json({ success: false, error: 'Sesi tidak ditemukan' });
    }

    const photo = db.prepare('SELECT path_file FROM photos WHERE session_id = ? AND urutan = 0').get(id);
    if (!photo || !photo.path_file) {
      return res.status(400).json({ success: false, error: 'Foto komposit belum tersedia untuk sesi ini' });
    }

    res.json({
      success: true,
      data: {
        sessionNo: String(session.rowid).padStart(4, '0'),
        compositeFile: photo.path_file,
        compositeUrl: `/photos/${photo.path_file}`
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;

