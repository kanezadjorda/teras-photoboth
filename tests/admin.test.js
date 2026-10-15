import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../server/db.js';
import { app } from '../server/index.js';

describe('Admin Panel, Security, History & Reports (PRD F-13, F-14, F-15)', () => {
  let server = null;
  let baseUrl = '';
  const testSessionId = `admin_test_${Date.now()}`;

  beforeAll(async () => {
    await new Promise((resolvePromise) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://localhost:${port}`;
        resolvePromise();
      });
    });

    // Ensure default pin is 1234
    db.prepare(`
      INSERT INTO settings (key, value)
      VALUES ('admin_pin', '1234')
      ON CONFLICT(key) DO UPDATE SET value = '1234'
    `).run();
  });

  afterAll(async () => {
    if (server) {
      await new Promise((res) => server.close(res));
    }
    // Cleanup test records
    db.prepare('DELETE FROM photos WHERE session_id = ?').run(testSessionId);
    db.prepare('DELETE FROM payments WHERE session_id = ?').run(testSessionId);
    db.prepare('DELETE FROM sessions WHERE id = ?').run(testSessionId);

    // Reset default pin to 1234
    db.prepare(`
      INSERT INTO settings (key, value)
      VALUES ('admin_pin', '1234')
      ON CONFLICT(key) DO UPDATE SET value = '1234'
    `).run();
  });

  describe('PIN Security & Verification (PRD F-14)', () => {
    it('rejects empty or missing PIN with 400', async () => {
      const res = await fetch(`${baseUrl}/api/settings/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('rejects incorrect PIN with 401', async () => {
      const res = await fetch(`${baseUrl}/api/settings/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: '0000' })
      });
      const data = await res.json();
      expect(res.status).toBe(401);
      expect(data.success).toBe(false);
    });

    it('accepts correct default PIN (1234) with 200', async () => {
      const res = await fetch(`${baseUrl}/api/settings/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: '1234' })
      });
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('allows changing PIN and enforces the new PIN', async () => {
      // 1. Update PIN to 9876
      const updateRes = await fetch(`${baseUrl}/api/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_pin: '9876' })
      });
      expect(updateRes.status).toBe(200);

      // 2. Old PIN is now rejected
      const oldRes = await fetch(`${baseUrl}/api/settings/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: '1234' })
      });
      expect(oldRes.status).toBe(401);

      // 3. New PIN is accepted
      const newRes = await fetch(`${baseUrl}/api/settings/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: '9876' })
      });
      expect(newRes.status).toBe(200);

      // Restore to 1234
      await fetch(`${baseUrl}/api/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_pin: '1234' })
      });
    });
  });

  describe('Transaction History & Reprint (PRD F-13)', () => {
    it('retrieves transaction history list with session formatting', async () => {
      // Insert test session
      const nowIso = new Date().toISOString();
      db.prepare(`
        INSERT INTO sessions (id, template_id, status, dibuat_pada)
        VALUES (?, NULL, 'done', ?)
      `).run(testSessionId, nowIso);

      db.prepare(`
        INSERT INTO payments (id, session_id, order_id, nominal, status, dibayar_pada)
        VALUES (?, ?, ?, 25000, 'paid', ?)
      `).run(`pay_${testSessionId}`, testSessionId, `order_${testSessionId}`, nowIso);

      const res = await fetch(`${baseUrl}/api/sessions/history`);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);

      const found = body.data.find((s) => s.id === testSessionId);
      expect(found).toBeDefined();
      expect(found.session_status).toBe('done');
      expect(found.nominal).toBe(25000);
      expect(found.formatted_session_no).toMatch(/^\d{4}$/);
    });

    it('handles reprint requests properly', async () => {
      // 1. Before photo is saved -> returns 400
      const resBefore = await fetch(`${baseUrl}/api/sessions/${testSessionId}/reprint`, {
        method: 'POST'
      });
      const dataBefore = await resBefore.json();
      expect(resBefore.status).toBe(400);
      expect(dataBefore.success).toBe(false);

      // 2. Insert composite photo record (urutan = 0)
      const fakeComposite = '20261015-120000-0042.jpg';
      db.prepare(`
        INSERT INTO photos (id, session_id, path_file, urutan)
        VALUES (?, ?, ?, 0)
      `).run(`photo_${testSessionId}`, testSessionId, fakeComposite);

      // 3. Request reprint -> returns 200 with composite URL
      const resAfter = await fetch(`${baseUrl}/api/sessions/${testSessionId}/reprint`, {
        method: 'POST'
      });
      const dataAfter = await resAfter.json();
      expect(resAfter.status).toBe(200);
      expect(dataAfter.success).toBe(true);
      expect(dataAfter.data.compositeFile).toBe(fakeComposite);
      expect(dataAfter.data.compositeUrl).toBe(`/photos/${fakeComposite}`);
      expect(dataAfter.data.sessionNo).toBeDefined();

      // 4. Reprint for non-existent session -> returns 404
      const resNotFound = await fetch(`${baseUrl}/api/sessions/non_existent_id/reprint`, {
        method: 'POST'
      });
      expect(resNotFound.status).toBe(404);
    });
  });

  describe('Daily Reports & CSV Export (PRD F-15)', () => {
    it('computes daily and all-time revenue metrics', async () => {
      const res = await fetch(`${baseUrl}/api/reports/daily`);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('today');
      expect(body.data).toHaveProperty('all_time');
      expect(body.data.today).toHaveProperty('total_sessions');
      expect(body.data.today).toHaveProperty('paid_sessions');
      expect(body.data.today).toHaveProperty('revenue');
      expect(typeof body.data.today.revenue).toBe('number');
      expect(Array.isArray(body.data.popular_templates)).toBe(true);
    });

    it('exports CSV file with UTF-8 BOM and correct headers', async () => {
      const res = await fetch(`${baseUrl}/api/reports/export-csv`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/csv');
      expect(res.headers.get('content-disposition')).toMatch(/attachment; filename="laporan-photobooth-\d+\.csv"/);

      const buf = Buffer.from(await res.arrayBuffer());
      // Verifikasi UTF-8 BOM (0xEF, 0xBB, 0xBF)
      expect(buf[0]).toBe(0xef);
      expect(buf[1]).toBe(0xbb);
      expect(buf[2]).toBe(0xbf);

      // Verifikasi baris header
      const text = buf.subarray(3).toString('utf-8');
      const lines = text.split('\r\n');
      expect(lines[0]).toBe('No Sesi,ID Sesi,Waktu Dibuat,Template Terpilih,Nominal (IDR),Status Sesi,Status Pembayaran');

      // Pastikan ada baris data transaksi
      expect(lines.length).toBeGreaterThan(1);
    });
  });
});
