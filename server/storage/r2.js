import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { readFileSync, existsSync } from 'node:fs';
import { db } from '../db.js';
import dotenv from 'dotenv';

dotenv.config();

const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
  R2_PUBLIC_URL
} = process.env;

let s3ClientInstance = null;
let isProcessing = false;
let workerInterval = null;

/**
 * Cek apakah kredensial Cloudflare R2 sudah dikonfigurasi di .env
 */
export function isR2Configured() {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  );
}

/**
 * Dapatkan singleton S3 client yang dikonfigurasi untuk Cloudflare R2
 */
export function getS3Client() {
  if (!isR2Configured()) return null;
  if (!s3ClientInstance) {
    const accountId = process.env.R2_ACCOUNT_ID;
    s3ClientInstance = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
      }
    });
  }
  return s3ClientInstance;
}

/**
 * Dapatkan URL publik dari file yang diunggah ke R2
 */
export function getPublicUrl(remoteKey) {
  const base = (process.env.R2_PUBLIC_URL || '').replace(/\/+$/, '');
  const cleanKey = remoteKey.replace(/^\/+/, '');
  return base ? `${base}/${cleanKey}` : cleanKey;
}

/**
 * Tambahkan file ke antrean upload SQLite (PRD F-31)
 */
export function enqueueUpload({ sessionId, filePath, remoteKey, fileType = 'photo' }) {
  const id = `upl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO upload_queue (id, session_id, file_path, remote_key, file_type, status, attempts, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'pending', 0, ?, ?)
  `).run(id, sessionId, filePath, remoteKey, fileType, now, now);

  // Jalankan pemrosesan di latar belakang tanpa memblokir pemanggil
  setTimeout(() => {
    processUploadQueue().catch((err) => {
      console.warn('[R2 Uploader] Gagal memproses antrean upload:', err.message);
    });
  }, 100);

  return id;
}

/**
 * Helper untuk menentukan Content-Type berdasarkan ekstensi file
 */
function getContentType(filePath) {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.json')) return 'application/json';
  return 'application/octet-stream';
}

/**
 * Unggah langsung buffer/string data ke R2
 */
export async function uploadBufferToR2({ remoteKey, body, contentType = 'application/json' }) {
  const client = getS3Client();
  if (!client) {
    throw new Error('Kredensial Cloudflare R2 belum lengkap di .env');
  }

  const bucket = process.env.R2_BUCKET_NAME;
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: remoteKey,
    Body: body,
    ContentType: contentType
  });

  await client.send(command);
  return getPublicUrl(remoteKey);
}

/**
 * Buat dan unggah manifest metadata sesi (meta.json) ke R2
 * Memudahkan web galeri Vercel untuk membaca list foto tanpa perlu DB server booth
 */
export async function syncSessionMetadata(sessionId) {
  try {
    const session = db.prepare('SELECT rowid, * FROM sessions WHERE id = ?').get(sessionId);
    if (!session || !session.token) return;

    const photos = db.prepare('SELECT * FROM photos WHERE session_id = ? ORDER BY urutan ASC').all(sessionId);
    const compositePhoto = photos.find((p) => p.urutan === 0);
    const rawPhotos = photos.filter((p) => p.urutan > 0);

    const metadata = {
      sessionId: session.id,
      token: session.token,
      sessionNo: String(session.rowid).padStart(4, '0'),
      createdAt: session.dibuat_pada,
      effectId: session.effect_id || 'normal',
      composite: compositePhoto ? {
        filename: compositePhoto.path_file,
        url: getPublicUrl(`sessions/${session.token}/${compositePhoto.path_file}`)
      } : null,
      photos: rawPhotos.map((p) => ({
        urutan: p.urutan,
        filename: p.path_file,
        url: getPublicUrl(`sessions/${session.token}/${p.path_file}`)
      }))
    };

    const metaKey = `sessions/${session.token}/meta.json`;
    await uploadBufferToR2({
      remoteKey: metaKey,
      body: JSON.stringify(metadata, null, 2),
      contentType: 'application/json'
    });
    console.log(`[R2 Uploader] Metadata sesi ${session.id} tersinkronisasi ke ${metaKey}`);
  } catch (err) {
    console.warn(`[R2 Uploader] Gagal sinkronisasi metadata sesi ${sessionId}:`, err.message);
  }
}

/**
 * Proses antrean upload di SQLite (PRD F-31)
 */
export async function processUploadQueue() {
  if (isProcessing) return;
  if (!isR2Configured()) {
    return;
  }

  isProcessing = true;
  try {
    const client = getS3Client();
    if (!client) return;

    const pendingItems = db.prepare(`
      SELECT * FROM upload_queue 
      WHERE status IN ('pending', 'failed') AND attempts < 5 
      ORDER BY created_at ASC 
      LIMIT 10
    `).all();

    if (pendingItems.length === 0) return;

    const bucket = process.env.R2_BUCKET_NAME;

    for (const item of pendingItems) {
      const now = new Date().toISOString();
      try {
        if (!existsSync(item.file_path)) {
          db.prepare(`
            UPDATE upload_queue 
            SET status = 'failed', attempts = attempts + 1, error_message = ?, updated_at = ? 
            WHERE id = ?
          `).run('Berkas lokal tidak ditemukan', now, item.id);
          continue;
        }

        // Baca berkas lokal
        const fileBuffer = readFileSync(item.file_path);
        const contentType = getContentType(item.file_path);

        // Upload ke R2
        const command = new PutObjectCommand({
          Bucket: bucket,
          Key: item.remote_key,
          Body: fileBuffer,
          ContentType: contentType
        });

        await client.send(command);

        // Sukses
        db.prepare(`
          UPDATE upload_queue 
          SET status = 'uploaded', error_message = NULL, updated_at = ? 
          WHERE id = ?
        `).run(now, item.id);

        console.log(`[R2 Uploader] Berhasil upload ${item.remote_key}`);

        // Update / unggah metadata sesi
        await syncSessionMetadata(item.session_id);
      } catch (err) {
        console.warn(`[R2 Uploader] Percobaan upload gagal untuk ${item.remote_key}:`, err.message);
        db.prepare(`
          UPDATE upload_queue 
          SET status = 'failed', attempts = attempts + 1, error_message = ?, updated_at = ? 
          WHERE id = ?
        `).run(err.message, now, item.id);
      }
    }
  } finally {
    isProcessing = false;
  }
}

/**
 * Mulai background worker untuk memeriksa antrean berkala (setiap 30 detik)
 */
export function startR2QueueWorker(intervalMs = 30000) {
  if (workerInterval) return;
  // Jalankan segera saat server boot
  processUploadQueue().catch(() => {});
  workerInterval = setInterval(() => {
    processUploadQueue().catch(() => {});
  }, intervalMs);
}

/**
 * Hentikan background worker
 */
export function stopR2QueueWorker() {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
  }
}
