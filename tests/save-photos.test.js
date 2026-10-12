import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../server/db.js';
import { existsSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { app } from '../server/index.js';

describe('Save Photos API (PRD F-17, F-18)', () => {
  let server = null;
  let baseUrl = '';
  const testSessionId = `sess_test_${Date.now()}`;
  let savedCompositeFile = null;
  let savedRawFile = null;

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
    if (savedCompositeFile && existsSync(savedCompositeFile)) {
      try { unlinkSync(savedCompositeFile); } catch {}
    }
    if (savedRawFile && existsSync(savedRawFile)) {
      try { unlinkSync(savedRawFile); } catch {}
    }
    db.prepare('DELETE FROM photos WHERE session_id = ?').run(testSessionId);
    db.prepare('DELETE FROM sessions WHERE id = ?').run(testSessionId);
  });

  it('saves composite and raw photos to disk and records to SQLite', async () => {
    // 1. Insert dummy session
    db.prepare(`
      INSERT INTO sessions (id, template_id, status, dibuat_pada)
      VALUES (?, NULL, 'reviewing', ?)
    `).run(testSessionId, new Date().toISOString());

    // Minimal 1x1 transparent png base64
    const dummyBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const res = await fetch(`${baseUrl}/api/sessions/${testSessionId}/save-photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        composite: dummyBase64,
        rawPhotos: [dummyBase64]
      })
    });

    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.sessionNo).toBeDefined();
    expect(body.data.compositeFilename).toMatch(/^\d{8}-\d{6}-\d{4}\.jpg$/);
    expect(body.data.rawFilenames.length).toBe(1);

    savedCompositeFile = resolve(process.cwd(), 'data/photos', body.data.compositeFilename);
    savedRawFile = resolve(process.cwd(), 'data/photos', body.data.rawFilenames[0]);

    // Verify files exist on disk
    expect(existsSync(savedCompositeFile)).toBe(true);
    expect(existsSync(savedRawFile)).toBe(true);

    // Verify recorded in SQLite photos table
    const photoRecords = db.prepare('SELECT * FROM photos WHERE session_id = ?').all(testSessionId);
    expect(photoRecords.length).toBe(2); // 1 composite + 1 raw
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
