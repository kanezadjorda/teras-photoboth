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
    const compositePhoto = photos.find((p) => p.tipe === 'composite' || (p.urutan === 0 && p.tipe !== 'composite_original'));
    const compositeOriginalPhoto = photos.find((p) => p.tipe === 'composite_original');
    const gifPhoto = photos.find((p) => p.tipe === 'animation');
    const liveVideo = photos.find((p) => p.tipe === 'live');

    const rawPhotos = photos.filter((p) => p.tipe === 'raw' || (!p.tipe && p.urutan > 0));
    const rawFilteredPhotos = photos.filter((p) => p.tipe === 'raw_filtered');

    // Kelompokkan foto mentah per urutan
    const rawPhotoMap = new Map();
    rawPhotos.forEach((p) => {
      rawPhotoMap.set(p.urutan, {
        urutan: p.urutan,
        filename: p.path_file,
        localUrl: `/photos/${p.path_file}`,
        r2Url: getPublicUrl(`sessions/${session.token}/${p.path_file}`)
      });
    });

    rawFilteredPhotos.forEach((p) => {
      const existing = rawPhotoMap.get(p.urutan);
      if (existing) {
        existing.filteredFilename = p.path_file;
        existing.filteredLocalUrl = `/photos/${p.path_file}`;
        existing.filteredR2Url = getPublicUrl(`sessions/${session.token}/${p.path_file}`);
      } else {
        rawPhotoMap.set(p.urutan, {
          urutan: p.urutan,
          filteredFilename: p.path_file,
          filteredLocalUrl: `/photos/${p.path_file}`,
          filteredR2Url: getPublicUrl(`sessions/${session.token}/${p.path_file}`)
        });
      }
    });

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
        compositeOriginal: compositeOriginalPhoto ? {
          filename: compositeOriginalPhoto.path_file,
          localUrl: `/photos/${compositeOriginalPhoto.path_file}`,
          r2Url: getPublicUrl(`sessions/${session.token}/${compositeOriginalPhoto.path_file}`)
        } : null,
        gif: gifPhoto ? {
          filename: gifPhoto.path_file,
          localUrl: `/photos/${gifPhoto.path_file}`,
          r2Url: getPublicUrl(`sessions/${session.token}/${gifPhoto.path_file}`)
        } : null,
        live: liveVideo ? {
          filename: liveVideo.path_file,
          localUrl: `/photos/${liveVideo.path_file}`,
          r2Url: getPublicUrl(`sessions/${session.token}/${liveVideo.path_file}`)
        } : null,
        photos: Array.from(rawPhotoMap.values()).sort((a, b) => a.urutan - b.urutan)
      }
    });
  } catch (err) {
    console.error('[Gallery API] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
