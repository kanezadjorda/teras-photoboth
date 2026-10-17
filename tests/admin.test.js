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
      expect(lines[0]).toBe('No Sesi,ID Sesi,Event,Waktu Dibuat,Template Terpilih,Nominal (IDR),Status Sesi,Status Pembayaran');

      // Pastikan ada baris data transaksi
      expect(lines.length).toBeGreaterThan(1);
    });
  });

  describe('Event & Operational Session Management (PRD F-17, F-18)', () => {
    const testEventId = `evt_test_${Date.now()}`;
    const testEventName = 'Wedding Test Automation';
    const testEventFolder = './data/photos/test-automation';

    afterAll(() => {
      db.prepare('DELETE FROM payments WHERE session_id IN (SELECT id FROM sessions WHERE event_id = ?)').run(testEventId);
      db.prepare('DELETE FROM photos WHERE session_id IN (SELECT id FROM sessions WHERE event_id = ?)').run(testEventId);
      db.prepare('DELETE FROM sessions WHERE event_id = ?').run(testEventId);
      db.prepare('DELETE FROM events WHERE id = ?').run(testEventId);
      // Restore default event as active
      db.prepare("UPDATE events SET aktif = 1 WHERE id = 'evt_default'").run();
      db.prepare("UPDATE events SET aktif = 0 WHERE id != 'evt_default'").run();
    });

    it('lists existing events including default regular event', async () => {
      const res = await fetch(`${baseUrl}/api/events`);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      const defaultEvt = body.data.find((e) => e.id === 'evt_default');
      expect(defaultEvt).toBeDefined();
      expect(defaultEvt.nama).toBe('Event Reguler');
    });

    it('creates a new operational event with target folder and activates it', async () => {
      const res = await fetch(`${baseUrl}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: testEventId,
          nama: testEventName,
          folder_path: testEventFolder,
          set_active: true
        })
      });
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(testEventId);
      expect(body.data.aktif).toBe(1);

      // Verify active event endpoint returns the new event
      const activeRes = await fetch(`${baseUrl}/api/events/active`);
      const activeBody = await activeRes.json();
      expect(activeRes.status).toBe(200);
      expect(activeBody.data.id).toBe(testEventId);
      expect(activeBody.data.nama).toBe(testEventName);
    });

    it('switches active event using activate endpoint', async () => {
      const res = await fetch(`${baseUrl}/api/events/evt_default/activate`, {
        method: 'PATCH'
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe('evt_default');
      expect(body.data.aktif).toBe(1);

      const activeRes = await fetch(`${baseUrl}/api/events/active`);
      const activeBody = await activeRes.json();
      expect(activeBody.data.id).toBe('evt_default');
    });

    it('filters transaction history and daily reports by event_id', async () => {
      // Create session linked to testEventId
      const eventSessionId = `sess_event_${Date.now()}`;
      const nowIso = '2020-01-01T10:00:00.000Z'; // Past timestamp to avoid race with currentSession
      db.prepare(`
        INSERT INTO sessions (id, event_id, status, dibuat_pada)
        VALUES (?, ?, 'done', ?)
      `).run(eventSessionId, testEventId, nowIso);

      db.prepare(`
        INSERT INTO payments (id, session_id, order_id, nominal, status, dibayar_pada)
        VALUES (?, ?, ?, 50000, 'paid', ?)
      `).run(`pay_${eventSessionId}`, eventSessionId, `ord_${eventSessionId}`, nowIso);

      // 1. History filtered by event_id
      const historyRes = await fetch(`${baseUrl}/api/sessions/history?event_id=${testEventId}`);
      const historyBody = await historyRes.json();
      expect(historyRes.status).toBe(200);
      expect(historyBody.data.every((s) => s.id === eventSessionId)).toBe(true);
      expect(historyBody.data[0].event_nama).toBe(testEventName);

      // 2. Daily report filtered by event_id
      const reportRes = await fetch(`${baseUrl}/api/reports/daily?event_id=${testEventId}`);
      const reportBody = await reportRes.json();
      expect(reportRes.status).toBe(200);
      expect(reportBody.data.filter_event.id).toBe(testEventId);
      expect(reportBody.data.all_time.total_sessions).toBe(1);
      expect(reportBody.data.all_time.revenue).toBe(50000);

      // 3. Export CSV filtered by event_id
      const csvRes = await fetch(`${baseUrl}/api/reports/export-csv?event_id=${testEventId}`);
      expect(csvRes.status).toBe(200);
      const csvText = (await csvRes.text());
      expect(csvText).toContain(testEventName);
      expect(csvText).toContain(eventSessionId);

      // Cleanup event session
      db.prepare('DELETE FROM payments WHERE session_id = ?').run(eventSessionId);
      db.prepare('DELETE FROM sessions WHERE id = ?').run(eventSessionId);
    });
  });
});
