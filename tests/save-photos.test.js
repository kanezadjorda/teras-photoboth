import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../server/db.js';
import { existsSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { app } from '../server/index.js';

describe('Save Photos API (PRD F-17, F-18 & Multi-Variant)', () => {
  let server = null;
  let baseUrl = '';
  const testSessionId = `sess_test_${Date.now()}`;
  const filesToClean = [];

  beforeAll(async () => {
    await new Promise((resolvePromise) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://localhost:${port}`;
        resolvePromise();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise((res) => server.close(res));
    }
    // Clean up created test files and database records
    filesToClean.forEach((file) => {
      if (file && existsSync(file)) {
        try { unlinkSync(file); } catch {}
      }
    });
    db.prepare('DELETE FROM photos WHERE session_id = ?').run(testSessionId);
    db.prepare('DELETE FROM sessions WHERE id = ?').run(testSessionId);
  });

  it('saves composite, original composite, raw, raw filtered, gif, and live video to disk and SQLite', async () => {
    // 1. Insert dummy session with explicit evt_default
    db.prepare(`
      INSERT INTO sessions (id, template_id, event_id, status, dibuat_pada)
      VALUES (?, NULL, 'evt_default', 'reviewing', ?)
    `).run(testSessionId, new Date().toISOString());

    // Minimal 1x1 png and dummy base64
    const dummyImageBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const dummyGifBase64 = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    const dummyVideoBase64 = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAA';

    const res = await fetch(`${baseUrl}/api/sessions/${testSessionId}/save-photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        composite: dummyImageBase64,
        compositeOriginal: dummyImageBase64,
        rawPhotos: [dummyImageBase64],
        rawFilteredPhotos: [dummyImageBase64],
        gif: dummyGifBase64,
        liveVideo: dummyVideoBase64,
        liveVideoExtension: 'mp4'
      })
    });

    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.sessionNo).toBeDefined();
    expect(body.data.compositeFilename).toMatch(/^\d{8}-\d{6}-\d{4}\.jpg$/);
    expect(body.data.compositeOriginalFilename).toMatch(/^\d{8}-\d{6}-\d{4}-original\.jpg$/);
    expect(body.data.rawFilenames.length).toBe(1);
    expect(body.data.filteredRawFilenames.length).toBe(1);
    expect(body.data.gifFilename).toMatch(/^\d{8}-\d{6}-\d{4}-animation\.gif$/);
    expect(body.data.liveVideoFilename).toMatch(/^\d{8}-\d{6}-\d{4}-live\.mp4$/);

    const compFile = resolve(process.cwd(), 'data/photos', body.data.compositeFilename);
    const origFile = resolve(process.cwd(), 'data/photos', body.data.compositeOriginalFilename);
    const rawFile = resolve(process.cwd(), 'data/photos', body.data.rawFilenames[0]);
    const filtFile = resolve(process.cwd(), 'data/photos', body.data.filteredRawFilenames[0]);
    const gifFile = resolve(process.cwd(), 'data/photos', body.data.gifFilename);
    const liveFile = resolve(process.cwd(), 'data/photos', body.data.liveVideoFilename);

    filesToClean.push(compFile, origFile, rawFile, filtFile, gifFile, liveFile);

    // Verify files exist on disk
    expect(existsSync(compFile)).toBe(true);
    expect(existsSync(origFile)).toBe(true);
    expect(existsSync(rawFile)).toBe(true);
    expect(existsSync(filtFile)).toBe(true);
    expect(existsSync(gifFile)).toBe(true);
    expect(existsSync(liveFile)).toBe(true);

    // Verify recorded in SQLite photos table with correct tipe
    const photoRecords = db.prepare('SELECT * FROM photos WHERE session_id = ?').all(testSessionId);
    expect(photoRecords.length).toBe(6);

    const tipes = photoRecords.map((p) => p.tipe);
    expect(tipes).toContain('composite');
    expect(tipes).toContain('composite_original');
    expect(tipes).toContain('raw');
    expect(tipes).toContain('raw_filtered');
    expect(tipes).toContain('animation');
    expect(tipes).toContain('live');
  });

  it('returns 400 if composite base64 is missing', async () => {
    const res = await fetch(`${baseUrl}/api/sessions/${testSessionId}/save-photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rawPhotos: []
      })
    });

    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
  });
});
