import { Router } from 'express';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { db } from '../db.js';
import { generatePhotoFilename, formatSessionNumber } from '../../src/shared/filename.js';

const router = Router();

/**
 * Helper untuk mendapatkan direktori folder output foto
 */
function getOutputDir() {
  const setting = db.prepare("SELECT value FROM settings WHERE key = 'output_folder'").get();
  const folder = setting?.value || process.env.OUTPUT_FOLDER || './data/photos';
  const fullPath = resolve(process.cwd(), folder);
  if (!existsSync(fullPath)) {
    mkdirSync(fullPath, { recursive: true });
  }
  return fullPath;
}

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
    const outputDir = getOutputDir();
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
