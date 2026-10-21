import { Router } from 'express';
import { db } from '../db.js';
import { broadcastEvent } from '../events.js';
import { DEFAULT_PHOTOS_FOLDER, ensureStoredDir } from '../paths.js';

const router = Router();

/**
 * GET /api/events
 * Mengambil daftar event beserta ringkasan sesi & omset
 */
router.get('/', (req, res) => {
  try {
    const events = db.prepare(`
      SELECT 
        e.*,
        count(s.id) as total_sessions,
        sum(CASE WHEN p.status IN ('lunas', 'paid') THEN 1 ELSE 0 END) as paid_sessions,
        coalesce(sum(CASE WHEN p.status IN ('lunas', 'paid') THEN p.nominal ELSE 0 END), 0) as total_revenue
      FROM events e
      LEFT JOIN sessions s ON s.event_id = e.id
      LEFT JOIN payments p ON p.session_id = s.id
      GROUP BY e.id
      ORDER BY e.aktif DESC, e.dibuat_pada DESC
    `).all();

    res.json({ success: true, data: events });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/events/active
 * Mengambil event operasional yang sedang aktif
 */
router.get('/active', (req, res) => {
  try {
    const activeEvent = db.prepare('SELECT * FROM events WHERE aktif = 1 LIMIT 1').get();
    res.json({ success: true, data: activeEvent || null });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/events
 * Membuat event operasional baru dengan folder Google Drive tersendiri
 */
router.post('/', (req, res) => {
  try {
    const { id, nama, folder_path, set_active } = req.body;

    if (!nama || !nama.trim()) {
      return res.status(400).json({ success: false, error: 'Nama event wajib diisi' });
    }

    const cleanName = nama.trim();
    const eventId = (id && id.trim()) || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();

    // Default folder: ./data/photos/<slug-nama>
    const slug = cleanName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const targetFolder = (folder_path && folder_path.trim()) || `./data/photos/${slug || 'event'}`;

    // Pastikan folder lokal ada di disk (siap sinkron Google Drive)
    ensureStoredDir(targetFolder);

    const shouldSetActive = Boolean(set_active);

    const createTransaction = db.transaction(() => {
      if (shouldSetActive) {
        db.prepare('UPDATE events SET aktif = 0').run();
      }

      db.prepare(`
        INSERT INTO events (id, nama, folder_path, aktif, dibuat_pada)
        VALUES (?, ?, ?, ?, ?)
      `).run(eventId, cleanName, targetFolder, shouldSetActive ? 1 : 0, nowIso);

      if (shouldSetActive) {
        db.prepare(`
          INSERT INTO settings (key, value) VALUES ('output_folder', ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `).run(targetFolder);
      }
    });

    createTransaction();

    const created = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
    broadcastEvent('event_updated', created);

    res.status(201).json({ success: true, data: created });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/events/:id/activate
 * Mengaktifkan event operasional untuk sesi kiosk saat ini
 */
router.patch('/:id/activate', (req, res) => {
  try {
    const { id } = req.params;
    const targetEvent = db.prepare('SELECT * FROM events WHERE id = ?').get(id);

    if (!targetEvent) {
      return res.status(404).json({ success: false, error: 'Event tidak ditemukan' });
    }

    const activateTx = db.transaction(() => {
      db.prepare('UPDATE events SET aktif = 0').run();
      db.prepare('UPDATE events SET aktif = 1 WHERE id = ?').run(id);

      db.prepare(`
        INSERT INTO settings (key, value) VALUES ('output_folder', ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `).run(targetEvent.folder_path);
    });

    activateTx();

    // Pastikan folder fisiknya ada di disk
    ensureStoredDir(targetEvent.folder_path);

    const updated = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
    broadcastEvent('event_updated', updated);

    res.json({
      success: true,
      data: updated,
      message: `Event "${targetEvent.nama}" berhasil diaktifkan. Folder output: ${targetEvent.folder_path}`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/events/:id/deactivate
 * Menonaktifkan event operasional (sesi kiosk kembali ke mode default/standby)
 */
router.patch('/:id/deactivate', (req, res) => {
  try {
    const { id } = req.params;
    const targetEvent = db.prepare('SELECT * FROM events WHERE id = ?').get(id);

    if (!targetEvent) {
      return res.status(404).json({ success: false, error: 'Event tidak ditemukan' });
    }

    const defaultFolder = DEFAULT_PHOTOS_FOLDER;

    const deactivateTx = db.transaction(() => {
      db.prepare('UPDATE events SET aktif = 0 WHERE id = ?').run(id);

      db.prepare(`
        INSERT INTO settings (key, value) VALUES ('output_folder', ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `).run(defaultFolder);
    });

    deactivateTx();

    const updated = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
    broadcastEvent('event_updated', updated);

    res.json({
      success: true,
      data: updated,
      message: `Event "${targetEvent.nama}" berhasil dinonaktifkan.`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/events/:id
 * Menghapus event (hanya jika belum memiliki sesi transaksi dan bukan event aktif)
 */
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const target = db.prepare('SELECT * FROM events WHERE id = ?').get(id);

    if (!target) {
      return res.status(404).json({ success: false, error: 'Event tidak ditemukan' });
    }

    if (target.aktif === 1) {
      return res.status(400).json({ success: false, error: 'Event yang sedang aktif tidak dapat dihapus' });
    }

    const sessionCount = db.prepare('SELECT count(*) as count FROM sessions WHERE event_id = ?').get(id);
    if (sessionCount.count > 0) {
      return res.status(400).json({
        success: false,
        error: `Event tidak dapat dihapus karena sudah memiliki ${sessionCount.count} transaksi sesi`
      });
    }

    db.prepare('DELETE FROM events WHERE id = ?').run(id);
    res.json({ success: true, message: 'Event berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
