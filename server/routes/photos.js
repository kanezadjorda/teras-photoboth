import { Router } from 'express';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { db } from '../db.js';
import { DEFAULT_PHOTOS_FOLDER, ensureStoredDir } from '../paths.js';
import { generatePhotoFilename, formatSessionNumber } from '../../src/shared/filename.js';

const router = Router();

/**
 * Helper untuk mendapatkan direktori folder output foto
 * Mengutamakan folder event dari sesi terkait (PRD F-17, F-18)
 */
function getOutputDir(sessionId) {
  if (sessionId) {
    try {
      const session = db.prepare('SELECT event_id FROM sessions WHERE id = ?').get(sessionId);
      if (session && session.event_id) {
        const eventRow = db.prepare('SELECT folder_path FROM events WHERE id = ?').get(session.event_id);
        if (eventRow && eventRow.folder_path) {
          return ensureStoredDir(eventRow.folder_path);
        }
      }
    } catch (e) {
      // fallback
    }
  }

  // Fallback ke event yang sedang aktif
  try {
    const activeEvent = db.prepare('SELECT folder_path FROM events WHERE aktif = 1 LIMIT 1').get();
    if (activeEvent && activeEvent.folder_path) {
      return ensureStoredDir(activeEvent.folder_path);
    }
  } catch (e) {
    // fallback
  }

  const setting = db.prepare("SELECT value FROM settings WHERE key = 'output_folder'").get();
  return ensureStoredDir(setting?.value || DEFAULT_PHOTOS_FOLDER);
}

/**
 * POST /api/sessions/:id/photo
 * Menyimpan satu foto mentah secara idempoten per indeks ke disk dan database (PRD F-10, F-17)
 */
router.post('/:id/photo', (req, res) => {
  try {
    const sessionId = req.params.id;
    const { index, photo } = req.body;

    if (!photo) {
      return res.status(400).json({ success: false, error: 'Data foto (base64) wajib disertakan' });
    }

    const rawIndex = parseInt(index, 10);
    if (!Number.isFinite(rawIndex) || rawIndex < 0) {
      return res.status(400).json({ success: false, error: 'Indeks foto tidak valid' });
    }

    const session = db.prepare('SELECT rowid, * FROM sessions WHERE id = ?').get(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, error: 'Sesi tidak ditemukan' });
    }

    const sessionNo = formatSessionNumber(session.rowid);
    const outputDir = getOutputDir(sessionId);
    const now = new Date();
    const urutan = rawIndex + 1; // 1-based urutan in DB

    const cleanRaw = photo.replace(/^data:image\/\w+;base64,/, '');
    const rawBuffer = Buffer.from(cleanRaw, 'base64');
    const rawFilename = generatePhotoFilename({
      date: now,
      sessionNo,
      type: 'raw',
      rawIndex: urutan
    });
    const rawFilePath = resolve(outputDir, rawFilename);

    writeFileSync(rawFilePath, rawBuffer);

    const rawPhotoId = `photo_${sessionId}_raw_${urutan}`;
    db.prepare(`
      INSERT OR REPLACE INTO photos (id, session_id, urutan, path_file)
      VALUES (?, ?, ?, ?)
    `).run(rawPhotoId, sessionId, urutan, rawFilename);

    res.json({
      success: true,
      data: {
        sessionNo,
        urutan,
        filename: rawFilename,
        path: `/photos/${rawFilename}`
      }
    });
  } catch (error) {
    console.error('[Photos] Gagal menyimpan foto tunggal:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/sessions/:id/save-photos
 * Menyimpan file foto final komposit dan foto-foto mentah ke disk sebelum instruksi cetak (PRD F-17, F-18)
 */
router.post('/:id/save-photos', (req, res) => {
  try {
    const sessionId = req.params.id;
    const { composite, rawPhotos } = req.body;

    if (!composite) {
      return res.status(400).json({ success: false, error: 'Foto komposit (base64) wajib disertakan' });
    }

    // 1. Ambil data sesi dan hitung nomor sesi urut (rowid)
    const session = db.prepare('SELECT rowid, * FROM sessions WHERE id = ?').get(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, error: 'Sesi tidak ditemukan' });
    }

    const sessionNo = formatSessionNumber(session.rowid);
    const outputDir = getOutputDir(sessionId);
    const now = new Date();

    // 2. Simpan Foto Komposit Final
    const cleanCompositeBase64 = composite.replace(/^data:image\/\w+;base64,/, '');
    const compositeBuffer = Buffer.from(cleanCompositeBase64, 'base64');
    const compositeFilename = generatePhotoFilename({ date: now, sessionNo, type: 'composite' });
    const compositeFilePath = resolve(outputDir, compositeFilename);

    writeFileSync(compositeFilePath, compositeBuffer);

    // Catat komposit ke tabel photos (urutan 0 untuk komposit utama)
    const compositePhotoId = `photo_${sessionId}_comp`;
    db.prepare(`
      INSERT OR REPLACE INTO photos (id, session_id, urutan, path_file)
      VALUES (?, ?, 0, ?)
    `).run(compositePhotoId, sessionId, compositeFilename);

    // 3. Simpan Foto Mentah (Raw Photos) jika tersedia
    const savedRawFilenames = [];
    if (Array.isArray(rawPhotos) && rawPhotos.length > 0) {
      rawPhotos.forEach((rawBase64, index) => {
        if (!rawBase64) return;
        const cleanRaw = rawBase64.replace(/^data:image\/\w+;base64,/, '');
        const rawBuffer = Buffer.from(cleanRaw, 'base64');
        const rawFilename = generatePhotoFilename({
          date: now,
          sessionNo,
          type: 'raw',
          rawIndex: index + 1
        });
        const rawFilePath = resolve(outputDir, rawFilename);

        writeFileSync(rawFilePath, rawBuffer);
        savedRawFilenames.push(rawFilename);

        const rawPhotoId = `photo_${sessionId}_raw_${index + 1}`;
        db.prepare(`
          INSERT OR REPLACE INTO photos (id, session_id, urutan, path_file)
          VALUES (?, ?, ?, ?)
        `).run(rawPhotoId, sessionId, index + 1, rawFilename);
      });
    }

    res.json({
      success: true,
      data: {
        sessionNo,
        compositeFilename,
        compositePath: `/photos/${compositeFilename}`,
        rawFilenames: savedRawFilenames
      }
    });
  } catch (error) {
    console.error('[Photos] Gagal menyimpan foto:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/sessions/:id/photos
 * Mengambil daftar foto tersimpan untuk sesi tertentu
 */
router.get('/:id/photos', (req, res) => {
  try {
    const sessionId = req.params.id;
    const session = db.prepare('SELECT rowid, * FROM sessions WHERE id = ?').get(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, error: 'Sesi tidak ditemukan' });
    }

    const photos = db.prepare(`
      SELECT * FROM photos WHERE session_id = ? ORDER BY urutan ASC
    `).all(sessionId);

    res.json({
      success: true,
      data: {
        sessionNo: formatSessionNumber(session.rowid),
        photos
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
