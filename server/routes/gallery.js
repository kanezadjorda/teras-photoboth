import { Router } from 'express';
import { db } from '../db.js';
import { getPublicUrl } from '../storage/r2.js';

const router = Router();

/**
 * GET /api/gallery/:token
 * Endpoint JSON untuk mendapatkan info galeri dan tautan unduhan Cloudflare R2
 */
router.get('/:token', (req, res) => {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).json({ success: false, error: 'Token sesi diperlukan' });
    }

    const session = db.prepare('SELECT rowid, * FROM sessions WHERE token = ?').get(token);
    if (!session) {
      return res.status(404).json({ success: false, error: 'Sesi foto tidak ditemukan atau token tidak valid' });
    }

    const photos = db.prepare('SELECT * FROM photos WHERE session_id = ? ORDER BY urutan ASC').all(session.id);
    const compositePhoto = photos.find((p) => p.urutan === 0);
    const rawPhotos = photos.filter((p) => p.urutan > 0);

    // Hitung antrean upload untuk sesi ini
    const queueStats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'uploaded' THEN 1 ELSE 0 END) as uploaded,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM upload_queue
      WHERE session_id = ?
    `).get(session.id);

    const isFullyUploaded = queueStats.total > 0 && queueStats.uploaded === queueStats.total;

    res.json({
      success: true,
      data: {
        sessionId: session.id,
        sessionNo: String(session.rowid).padStart(4, '0'),
        createdAt: session.dibuat_pada,
        status: session.status,
        isFullyUploaded,
        queue: queueStats,
        composite: compositePhoto ? {
          filename: compositePhoto.path_file,
          localUrl: `/photos/${compositePhoto.path_file}`,
          r2Url: getPublicUrl(`sessions/${session.token}/${compositePhoto.path_file}`)
        } : null,
        photos: rawPhotos.map((p) => ({
          urutan: p.urutan,
          filename: p.path_file,
          localUrl: `/photos/${p.path_file}`,
          r2Url: getPublicUrl(`sessions/${session.token}/${p.path_file}`)
        }))
      }
    });
  } catch (err) {
    console.error('[Gallery API] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

