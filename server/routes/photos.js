import { Router } from 'express';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { db } from '../db.js';
import { DEFAULT_PHOTOS_FOLDER, ensureStoredDir } from '../paths.js';
import { generatePhotoFilename, formatSessionNumber } from '../../src/shared/filename.js';
import { enqueueUpload } from '../storage/r2.js';

const router = Router();

/**
 * Strips any data URI header (e.g. data:image/jpeg;base64, or data:video/mp4;codecs=avc1;base64,)
 * cleanly by locating the comma separator, avoiding regex failures on MIME codec parameters.
 * @param {string} dataUri
 * @returns {string} clean base64 payload
 */
function stripBase64Prefix(dataUri) {
  if (typeof dataUri !== 'string') return '';
  const commaIdx = dataUri.indexOf(',');
  return commaIdx !== -1 ? dataUri.substring(commaIdx + 1) : dataUri;
}

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

    const cleanRaw = stripBase64Prefix(photo);
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
      INSERT OR REPLACE INTO photos (id, session_id, urutan, path_file, tipe)
      VALUES (?, ?, ?, ?, 'raw')
    `).run(rawPhotoId, sessionId, urutan, rawFilename);

    // Enqueue async upload to Cloudflare R2 (PRD F-31)
    if (session.token) {
      enqueueUpload({
        sessionId,
        filePath: rawFilePath,
        remoteKey: `sessions/${session.token}/${rawFilename}`,
        fileType: 'raw'
      });
    }

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
 * Menyimpan seluruh aset bundel multi-varian (komposit +/- filter, raw +/- filter, gif, live video)
 * ke disk lokal sebelum instruksi cetak (PRD F-17, F-18)
 */
router.post('/:id/save-photos', (req, res) => {
  try {
    const sessionId = req.params.id;
    const {
      composite,
      compositeOriginal,
      rawPhotos,
      rawFilteredPhotos,
      gif,
      liveVideo,
      liveVideoExtension
    } = req.body;

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

    // 2. Simpan Foto Komposit Final (Berfilter, siap cetak)
    const cleanCompositeBase64 = stripBase64Prefix(composite);
    const compositeBuffer = Buffer.from(cleanCompositeBase64, 'base64');
    const compositeFilename = generatePhotoFilename({ date: now, sessionNo, type: 'composite' });
    const compositeFilePath = resolve(outputDir, compositeFilename);

    writeFileSync(compositeFilePath, compositeBuffer);

    const compositePhotoId = `photo_${sessionId}_comp`;
    db.prepare(`
      INSERT OR REPLACE INTO photos (id, session_id, urutan, path_file, tipe)
      VALUES (?, ?, 0, ?, 'composite')
    `).run(compositePhotoId, sessionId, compositeFilename);

    if (session.token) {
      enqueueUpload({
        sessionId,
        filePath: compositeFilePath,
        remoteKey: `sessions/${session.token}/${compositeFilename}`,
        fileType: 'composite'
      });
    }

    // 3. Simpan Foto Komposit Original (Tanpa Filter) jika tersedia
    let compositeOriginalFilename = null;
    if (compositeOriginal) {
      const cleanOrigBase64 = stripBase64Prefix(compositeOriginal);
      const origBuffer = Buffer.from(cleanOrigBase64, 'base64');
      compositeOriginalFilename = generatePhotoFilename({ date: now, sessionNo, type: 'composite_original' });
      const origFilePath = resolve(outputDir, compositeOriginalFilename);

      writeFileSync(origFilePath, origBuffer);

      const origPhotoId = `photo_${sessionId}_comp_orig`;
      db.prepare(`
        INSERT OR REPLACE INTO photos (id, session_id, urutan, path_file, tipe)
        VALUES (?, ?, 0, ?, 'composite_original')
      `).run(origPhotoId, sessionId, compositeOriginalFilename);

      if (session.token) {
        enqueueUpload({
          sessionId,
          filePath: origFilePath,
          remoteKey: `sessions/${session.token}/${compositeOriginalFilename}`,
          fileType: 'composite_original'
        });
      }
    }

    // 4. Simpan Foto Mentah Asli (Raw Photos) jika tersedia
    const savedRawFilenames = [];
    if (Array.isArray(rawPhotos) && rawPhotos.length > 0) {
      rawPhotos.forEach((rawBase64, index) => {
        if (!rawBase64) return;
        const cleanRaw = stripBase64Prefix(rawBase64);
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
          INSERT OR REPLACE INTO photos (id, session_id, urutan, path_file, tipe)
          VALUES (?, ?, ?, ?, 'raw')
        `).run(rawPhotoId, sessionId, index + 1, rawFilename);

        if (session.token) {
          enqueueUpload({
            sessionId,
            filePath: rawFilePath,
            remoteKey: `sessions/${session.token}/${rawFilename}`,
            fileType: 'raw'
          });
        }
      });
    }

    // 5. Simpan Foto Mentah Berfilter (Raw Filtered Photos) jika tersedia
    const savedFilteredFilenames = [];
    if (Array.isArray(rawFilteredPhotos) && rawFilteredPhotos.length > 0) {
      rawFilteredPhotos.forEach((filtBase64, index) => {
        if (!filtBase64) return;
        const cleanFilt = stripBase64Prefix(filtBase64);
        const filtBuffer = Buffer.from(cleanFilt, 'base64');
        const filtFilename = generatePhotoFilename({
          date: now,
          sessionNo,
          type: 'raw_filtered',
          rawIndex: index + 1
        });
        const filtFilePath = resolve(outputDir, filtFilename);

        writeFileSync(filtFilePath, filtBuffer);
        savedFilteredFilenames.push(filtFilename);

        const filtPhotoId = `photo_${sessionId}_raw_filtered_${index + 1}`;
        db.prepare(`
          INSERT OR REPLACE INTO photos (id, session_id, urutan, path_file, tipe)
          VALUES (?, ?, ?, ?, 'raw_filtered')
        `).run(filtPhotoId, sessionId, index + 1, filtFilename);

        if (session.token) {
          enqueueUpload({
            sessionId,
            filePath: filtFilePath,
            remoteKey: `sessions/${session.token}/${filtFilename}`,
            fileType: 'raw_filtered'
          });
        }
      });
    }

    // 6. Simpan Animasi GIF Foto Satuan jika tersedia
    let savedGifFilename = null;
    if (gif) {
      const cleanGif = stripBase64Prefix(gif);
      const gifBuffer = Buffer.from(cleanGif, 'base64');
      savedGifFilename = generatePhotoFilename({ date: now, sessionNo, type: 'animation' });
      const gifFilePath = resolve(outputDir, savedGifFilename);

      writeFileSync(gifFilePath, gifBuffer);

      const gifPhotoId = `photo_${sessionId}_gif`;
      db.prepare(`
        INSERT OR REPLACE INTO photos (id, session_id, urutan, path_file, tipe)
        VALUES (?, ?, -1, ?, 'animation')
      `).run(gifPhotoId, sessionId, savedGifFilename);

      if (session.token) {
        enqueueUpload({
          sessionId,
          filePath: gifFilePath,
          remoteKey: `sessions/${session.token}/${savedGifFilename}`,
          fileType: 'animation'
        });
      }
    }

    // 7. Simpan Live Video Template jika tersedia
    let savedLiveVideoFilename = null;
    if (liveVideo) {
      const cleanVideo = stripBase64Prefix(liveVideo);
      const videoBuffer = Buffer.from(cleanVideo, 'base64');
      const ext = liveVideoExtension || 'mp4';
      savedLiveVideoFilename = generatePhotoFilename({
        date: now,
        sessionNo,
        type: 'live',
        extension: ext
      });
      const videoFilePath = resolve(outputDir, savedLiveVideoFilename);

      writeFileSync(videoFilePath, videoBuffer);

      const livePhotoId = `photo_${sessionId}_live`;
      db.prepare(`
        INSERT OR REPLACE INTO photos (id, session_id, urutan, path_file, tipe)
        VALUES (?, ?, -2, ?, 'live')
      `).run(livePhotoId, sessionId, savedLiveVideoFilename);

      if (session.token) {
        enqueueUpload({
          sessionId,
          filePath: videoFilePath,
          remoteKey: `sessions/${session.token}/${savedLiveVideoFilename}`,
          fileType: 'live'
        });
      }
    }

    res.json({
      success: true,
      data: {
        sessionNo,
        compositeFilename,
        compositePath: `/photos/${compositeFilename}`,
        compositeOriginalFilename,
        rawFilenames: savedRawFilenames,
        filteredRawFilenames: savedFilteredFilenames,
        gifFilename: savedGifFilename,
        liveVideoFilename: savedLiveVideoFilename
      }
    });
  } catch (error) {
    console.error('[Photos] Gagal menyimpan bundle foto:', error);
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
