import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import {
  mapMidtransStatusToPaymentState,
  getMidtransBaseUrl,
  getMidtransEnv,
  isSandboxMode,
  createQrisCharge,
  checkTransactionStatus,
  simulateMockPayment
} from '../server/payment/midtrans.js';
import { PAYMENT_STATES } from '../src/shared/constants.js';
import { db } from '../server/db.js';
import { app } from '../server/index.js';

describe('Midtrans Payment Gateway Logic', () => {
  const origEnv = { ...process.env };
  let server = null;
  let baseUrl = '';
  const testSessions = [];

  beforeAll(async () => {
    await new Promise((resolvePromise) => {
      server = app.listen(0, () => {
        baseUrl = `http://localhost:${server.address().port}`;
        resolvePromise();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise((res) => server.close(res));
    }
    for (const sId of testSessions) {
      db.prepare('DELETE FROM payments WHERE session_id = ?').run(sId);
      db.prepare('DELETE FROM sessions WHERE id = ?').run(sId);
    }
  });

  afterEach(() => {
    process.env = { ...origEnv };
    vi.restoreAllMocks();
  });

  describe('Status Mapping (mapMidtransStatusToPaymentState)', () => {
    it('maps settlement and capture to lunas', () => {
      expect(mapMidtransStatusToPaymentState('settlement')).toBe('lunas');
      expect(mapMidtransStatusToPaymentState('Settlement')).toBe(PAYMENT_STATES.LUNAS);
      expect(mapMidtransStatusToPaymentState('capture')).toBe('lunas');
    });

    it('maps pending to menunggu', () => {
      expect(mapMidtransStatusToPaymentState('pending')).toBe('menunggu');
      expect(mapMidtransStatusToPaymentState('')).toBe(PAYMENT_STATES.MENUNGGU);
      expect(mapMidtransStatusToPaymentState(null)).toBe('menunggu');
    });

    it('maps expire, deny, and cancel to gagal', () => {
      expect(mapMidtransStatusToPaymentState('expire')).toBe('gagal');
      expect(mapMidtransStatusToPaymentState('expired')).toBe('gagal');
      expect(mapMidtransStatusToPaymentState('deny')).toBe('gagal');
      expect(mapMidtransStatusToPaymentState('cancel')).toBe('gagal');
      expect(mapMidtransStatusToPaymentState('cancelled')).toBe('gagal');
      expect(mapMidtransStatusToPaymentState('failure')).toBe(PAYMENT_STATES.GAGAL);
    });
  });

  describe('Environment & Base URL Configuration (MIDTRANS_ENV)', () => {
    it('returns sandbox URL and isSandboxMode=true when MIDTRANS_ENV=sandbox', () => {
      process.env.MIDTRANS_ENV = 'sandbox';
      process.env.MIDTRANS_IS_PRODUCTION = 'false';
      expect(getMidtransEnv()).toBe('sandbox');
      expect(isSandboxMode()).toBe(true);
      expect(getMidtransBaseUrl()).toBe('https://api.sandbox.midtrans.com/v2');
    });

    it('returns production URL and isSandboxMode=false when MIDTRANS_ENV=production', () => {
      process.env.MIDTRANS_ENV = 'production';
      delete process.env.MIDTRANS_IS_PRODUCTION;
      expect(getMidtransEnv()).toBe('production');
      expect(isSandboxMode()).toBe(false);
      expect(getMidtransBaseUrl()).toBe('https://api.midtrans.com/v2');
    });

    it('returns production URL and isSandboxMode=false when MIDTRANS_IS_PRODUCTION=true', () => {
      process.env.MIDTRANS_IS_PRODUCTION = 'true';
      expect(getMidtransEnv()).toBe('production');
      expect(isSandboxMode()).toBe(false);
      expect(getMidtransBaseUrl()).toBe('https://api.midtrans.com/v2');
    });
  });

  describe('Core API Charge Payload & Actions Extraction', () => {
    it('sends qris.acquirer = "gopay" and stores both generate-qr-code and generate-qr-code-v2 URLs', async () => {
      process.env.MIDTRANS_SERVER_KEY = 'SB-Mid-server-test-key';
      process.env.MIDTRANS_ENV = 'sandbox';
      process.env.MIDTRANS_IS_PRODUCTION = 'false';

      const v1Url = 'https://api.sandbox.midtrans.com/v2/qris/tx-123/qr-code';
      const v2Url = 'https://merchants-app.sbx.midtrans.com/v4/qris/gopay/ref-123/qr-code';

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
        if (String(url).endsWith('/charge')) {
          return {
            ok: true,
            status: 201,
            json: async () => ({
              status_code: '201',
              order_id: 'order_qris_01',
              transaction_id: 'tx-123',
              gross_amount: '25000.00',
              transaction_status: 'pending',
              qr_string: '00020101021226...',
              actions: [
                { name: 'generate-qr-code', method: 'GET', url: v1Url },
                { name: 'generate-qr-code-v2', method: 'GET', url: v2Url }
              ]
            })
          };
        }
        // Mock QR image fetch
        return {
          ok: true,
          arrayBuffer: async () => new Uint8Array([137, 80, 78, 71]).buffer
        };
      });

      const charge = await createQrisCharge({ orderId: 'order_qris_01', amount: 25000 });

      expect(fetchSpy).toHaveBeenCalled();
      const [calledUrl, calledOpts] = fetchSpy.mock.calls[0];
      expect(calledUrl).toBe('https://api.sandbox.midtrans.com/v2/charge');

      const parsedBody = JSON.parse(calledOpts.body);
      expect(parsedBody).toEqual({
        payment_type: 'qris',
        qris: { acquirer: 'gopay' },
        transaction_details: {
          order_id: 'order_qris_01',
          gross_amount: 25000
        }
      });

      expect(charge.qrCodeUrl).toBe(v1Url);
      expect(charge.qrCodeUrlV2).toBe(v2Url);
      expect(charge.actions).toEqual({
        'generate-qr-code': v1Url,
        'generate-qr-code-v2': v2Url
      });
    });

    it('exposes both action URLs in /api/payments/charge only when MIDTRANS_ENV=sandbox and hides them in production', async () => {
      delete process.env.MIDTRANS_SERVER_KEY;
      const oldTimestamp = '2020-01-01T00:00:00.000Z';

      // 1. Sandbox mode
      process.env.MIDTRANS_ENV = 'sandbox';
      process.env.MIDTRANS_IS_PRODUCTION = 'false';

      const sbxSessionId = `sess_sbx_${Date.now()}`;
      testSessions.push(sbxSessionId);
      db.prepare('INSERT INTO sessions (id, template_id, status, dibuat_pada) VALUES (?, NULL, ?, ?)')
        .run(sbxSessionId, 'waiting_payment', oldTimestamp);

      const sbxRes = await fetch(`${baseUrl}/api/payments/charge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sbxSessionId })
      });
      const sbxBody = await sbxRes.json();

      expect(sbxBody.success).toBe(true);
      expect(sbxBody.data.status).toBe('menunggu');
      expect(sbxBody.data.midtrans_env).toBe('sandbox');
      expect(sbxBody.data.actions['generate-qr-code']).toBeTruthy();
      expect(sbxBody.data.actions['generate-qr-code-v2']).toBeTruthy();

      // Verify both URLs persisted in DB
      const dbRow = db.prepare('SELECT qr_code_url, qr_code_url_v2 FROM payments WHERE session_id = ?').get(sbxSessionId);
      expect(dbRow.qr_code_url).toBe(sbxBody.data.actions['generate-qr-code']);
      expect(dbRow.qr_code_url_v2).toBe(sbxBody.data.actions['generate-qr-code-v2']);

      // Mark session done so polling worker stops immediately
      db.prepare('UPDATE sessions SET status = ? WHERE id = ?').run('done', sbxSessionId);

      // 2. Production mode -> URLs must NOT be exposed in API response
      process.env.MIDTRANS_ENV = 'production';
      const prodSessionId = `sess_prod_${Date.now()}`;
      testSessions.push(prodSessionId);
      db.prepare('INSERT INTO sessions (id, template_id, status, dibuat_pada) VALUES (?, NULL, ?, ?)')
        .run(prodSessionId, 'waiting_payment', oldTimestamp);

      const prodRes = await fetch(`${baseUrl}/api/payments/charge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: prodSessionId })
      });
      const prodBody = await prodRes.json();

      expect(prodBody.success).toBe(true);
      expect(prodBody.data.midtrans_env).toBe('production');
      expect(prodBody.data.actions).toBeUndefined();
      expect(prodBody.data.qr_code_url).toBeUndefined();
      expect(prodBody.data.qr_code_url_v2).toBeUndefined();
      expect(prodBody.data.raw_qr_url).toBeUndefined();

      db.prepare('UPDATE sessions SET status = ? WHERE id = ?').run('done', prodSessionId);
    });
  });

  describe('Mock QRIS Mode when Server Key is empty', () => {
    beforeEach(() => {
      delete process.env.MIDTRANS_SERVER_KEY;
    });

    it('creates simulated charge with both action URLs without error', async () => {
      const result = await createQrisCharge({ orderId: 'test_order_123', amount: 25000 });
      expect(result.success).toBe(true);
      expect(result.isMock).toBe(true);
      expect(result.orderId).toBe('test_order_123');
      expect(result.qrUrl).toContain('data:image/svg+xml');
      expect(result.qrCodeUrl).toContain('/v2/qris/');
      expect(result.qrCodeUrlV2).toContain('/v4/qris/gopay/');
      expect(result.grossAmount).toBe(25000);
    });

    it('status starts as menunggu then changes to lunas after simulation', async () => {
      const orderId = 'test_order_456';
      await createQrisCharge({ orderId, amount: 25000 });

      const status1 = await checkTransactionStatus(orderId);
      expect(status1.internalStatus).toBe('menunggu');

      // Simulate payment
      const simulated = simulateMockPayment(orderId);
      expect(simulated).toBe(true);

      const status2 = await checkTransactionStatus(orderId);
      expect(status2.internalStatus).toBe('lunas');
    });
  });
});

