import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app } from '../server/index.js';
import { db, initDb } from '../server/db.js';
import { getPublicUrl, enqueueUpload } from '../server/storage/r2.js';

describe('Cloudflare R2 & Web Gallery Integration (PRD F-30, F-31)', () => {
  let server = null;
  let baseUrl = '';
  let testSessionId = '';
  let testSessionToken = '';

  beforeAll(async () => {
    initDb();
    await new Promise((res) => {
      server = app.listen(0, () => {
        baseUrl = `http://localhost:${server.address().port}`;
        res();
      });
    });

    // Buat sesi pengujian via API
    const res = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'capturing' })
    });
    const body = await res.json();

    testSessionId = body.data.id;
    testSessionToken = body.data.token;
  });

  afterAll(async () => {
    if (server) {
      await new Promise((res) => server.close(res));
    }
    if (testSessionId) {
      db.prepare('DELETE FROM upload_queue WHERE session_id = ?').run(testSessionId);
      db.prepare('DELETE FROM photos WHERE session_id = ?').run(testSessionId);
      db.prepare('DELETE FROM sessions WHERE id = ?').run(testSessionId);
    }
  });

  it('generates an unguessable unique token for each session (PRD F-30)', () => {
    expect(testSessionToken).toBeDefined();
    expect(typeof testSessionToken).toBe('string');
    expect(testSessionToken.length).toBeGreaterThanOrEqual(16);

    const sessionInDb = db.prepare('SELECT * FROM sessions WHERE id = ?').get(testSessionId);
    expect(sessionInDb.token).toBe(testSessionToken);
  });

  it('enqueues photo upload tasks into SQLite upload_queue table (PRD F-31)', () => {
    const queueId = enqueueUpload({
      sessionId: testSessionId,
      filePath: './data/photos/test-sample.jpg',
      remoteKey: `sessions/${testSessionToken}/test-sample.jpg`,
      fileType: 'raw'
    });

    expect(queueId).toBeDefined();

    const queueRow = db.prepare('SELECT * FROM upload_queue WHERE id = ?').get(queueId);
    expect(queueRow).toBeDefined();
    expect(queueRow.session_id).toBe(testSessionId);
    expect(queueRow.status).toBe('pending');
    expect(queueRow.remote_key).toBe(`sessions/${testSessionToken}/test-sample.jpg`);
  });

  it('returns clean public R2 URL without double slashes', () => {
    const prevUrl = process.env.R2_PUBLIC_URL;
    process.env.R2_PUBLIC_URL = 'https://pub-sample.r2.dev/';

    const url = getPublicUrl('/sessions/abc/photo.jpg');
    expect(url).toBe('https://pub-sample.r2.dev/sessions/abc/photo.jpg');

    process.env.R2_PUBLIC_URL = prevUrl;
  });

  it('exposes GET /api/gallery/:token with 404 for invalid tokens and 200 for valid token (PRD F-30)', async () => {
    // 1. Invalid token
    const invalidRes = await fetch(`${baseUrl}/api/gallery/invalid_random_token_999`);
    const invalidBody = await invalidRes.json();
    expect(invalidRes.status).toBe(404);
    expect(invalidBody.success).toBe(false);

    // 2. Valid token without photos
    const validRes = await fetch(`${baseUrl}/api/gallery/${testSessionToken}`);
    const validBody = await validRes.json();
    expect(validRes.status).toBe(200);
    expect(validBody.success).toBe(true);
    expect(validBody.data.sessionId).toBe(testSessionId);
    expect(validBody.data.sessionNo).toBeDefined();
    expect(validBody.data.photos).toEqual([]);

    // 3. Save a photo and check gallery response
    db.prepare(`
      INSERT INTO photos (id, session_id, urutan, path_file)
      VALUES (?, ?, 0, ?)
    `).run(`ph_${testSessionId}_comp`, testSessionId, 'comp_test.jpg');

    const resWithPhoto = await fetch(`${baseUrl}/api/gallery/${testSessionToken}`);
    const bodyWithPhoto = await resWithPhoto.json();
    expect(resWithPhoto.status).toBe(200);
    expect(bodyWithPhoto.data.composite).toBeDefined();
    expect(bodyWithPhoto.data.composite.filename).toBe('comp_test.jpg');
  });

  it('serves the local web gallery page at /s/:token (PRD F-30)', async () => {
    const res = await fetch(`${baseUrl}/s/${testSessionToken}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(html).toContain('TERAS PHOTOBOOTH');
    expect(html).toContain('GALERI SOFT FILE DIGITAL');
  });
});
