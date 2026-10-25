import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../server/db.js';
import { app } from '../server/index.js';
import { preventDoubleClick } from '../src/shared/ui.js';

describe('Offline Resilience & Session Recovery (PRD Bagian 7 & 12)', () => {
  let server = null;
  let baseUrl = '';
  const testSessionId = `recovery_test_${Date.now()}`;

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
    db.prepare('DELETE FROM payments WHERE session_id = ?').run(testSessionId);
    db.prepare('DELETE FROM sessions WHERE id = ?').run(testSessionId);
  });

  describe('Session Recovery Lifecycle', () => {
    it('detects uncompleted session when app boots up', async () => {
      // 0. Bersihkan sesi aktif lama agar tidak bertabrakan dengan test paralel
      db.prepare("UPDATE sessions SET status = 'cancelled' WHERE status NOT IN ('done', 'cancelled', 'expired')").run();

      // 1. Insert session simulating abrupt crash during capturing
      const nowIso = new Date().toISOString();
      db.prepare(`
        INSERT INTO sessions (id, template_id, status, dibuat_pada)
        VALUES (?, NULL, 'capturing', ?)
      `).run(testSessionId, nowIso);

      const res = await fetch(`${baseUrl}/api/sessions/current`);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.data.id).toBe(testSessionId);
      expect(body.data.status).toBe('capturing');
    });

    it('clears active session after cancellation or completion', async () => {
      // Cancel the session
      const cancelRes = await fetch(`${baseUrl}/api/sessions/${testSessionId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' })
      });
      expect(cancelRes.status).toBe(200);

      // Verify in DB that testSessionId is now cancelled
      const dbRow = db.prepare('SELECT status FROM sessions WHERE id = ?').get(testSessionId);
      expect(dbRow.status).toBe('cancelled');

      // Now GET /api/sessions/current must not return testSessionId
      const res = await fetch(`${baseUrl}/api/sessions/current`);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      if (body.data) {
        expect(body.data.id).not.toBe(testSessionId);
      }
    });
  });

  describe('Double-Click Prevention (PRD Bagian 3)', () => {
    it('prevents multiple simultaneous executions on rapid clicks', async () => {
      // Create mock button element
      const mockButton = {
        disabled: false,
        dataset: {},
        classList: {
          add: () => {},
          remove: () => {}
        },
        innerHTML: 'MULAI',
        textContent: 'MULAI'
      };

      let executionCount = 0;
      let resolveAction;
      const deferredPromise = new Promise((res) => {
        resolveAction = res;
      });

      const clickHandler = preventDoubleClick(mockButton, async () => {
        executionCount++;
        await deferredPromise;
      }, 'MEMPROSES...');

      // First click: triggers execution
      const call1 = clickHandler({ preventDefault: () => {}, stopPropagation: () => {} });
      expect(mockButton.disabled).toBe(true);
      expect(mockButton.dataset.busy).toBe('true');
      expect(executionCount).toBe(1);

      // Second rapid click while action is running: MUST BE IGNORED
      const call2 = clickHandler({ preventDefault: () => {}, stopPropagation: () => {} });
      expect(executionCount).toBe(1);

      // Complete first action
      resolveAction();
      await call1;
      await call2;
    });

    it('restores button state on error', async () => {
      const mockButton = {
        disabled: false,
        dataset: {},
        classList: {
          add: () => {},
          remove: () => {}
        },
        innerHTML: 'SIMPAN',
        textContent: 'SIMPAN'
      };

      const clickHandler = preventDoubleClick(mockButton, async () => {
        throw new Error('Jaringan gagal');
      });

      await expect(clickHandler()).rejects.toThrow('Jaringan gagal');
      expect(mockButton.disabled).toBe(false);
      expect(mockButton.dataset.busy).toBe('false');
    });
  });
});
