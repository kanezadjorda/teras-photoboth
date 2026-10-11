import { describe, it, expect, beforeEach } from 'vitest';
import {
  mapMidtransStatusToPaymentState,
  getMidtransBaseUrl,
  createQrisCharge,
  checkTransactionStatus,
  simulateMockPayment
} from '../server/payment/midtrans.js';
import { PAYMENT_STATES } from '../src/shared/constants.js';

describe('Midtrans Payment Gateway Logic', () => {
  describe('Status Mapping (mapMidtransStatusToPaymentState)', () => {
    it('maps settlement and capture to PAID', () => {
      expect(mapMidtransStatusToPaymentState('settlement')).toBe(PAYMENT_STATES.PAID);
      expect(mapMidtransStatusToPaymentState('Settlement')).toBe(PAYMENT_STATES.PAID);
      expect(mapMidtransStatusToPaymentState('capture')).toBe(PAYMENT_STATES.PAID);
    });

    it('maps pending to PENDING', () => {
      expect(mapMidtransStatusToPaymentState('pending')).toBe(PAYMENT_STATES.PENDING);
      expect(mapMidtransStatusToPaymentState('')).toBe(PAYMENT_STATES.PENDING);
      expect(mapMidtransStatusToPaymentState(null)).toBe(PAYMENT_STATES.PENDING);
    });

    it('maps expire/expired to EXPIRED', () => {
      expect(mapMidtransStatusToPaymentState('expire')).toBe(PAYMENT_STATES.EXPIRED);
      expect(mapMidtransStatusToPaymentState('expired')).toBe(PAYMENT_STATES.EXPIRED);
    });

    it('maps cancel to CANCELLED', () => {
      expect(mapMidtransStatusToPaymentState('cancel')).toBe(PAYMENT_STATES.CANCELLED);
      expect(mapMidtransStatusToPaymentState('cancelled')).toBe(PAYMENT_STATES.CANCELLED);
    });

    it('maps deny and failure to FAILED', () => {
      expect(mapMidtransStatusToPaymentState('deny')).toBe(PAYMENT_STATES.FAILED);
      expect(mapMidtransStatusToPaymentState('failure')).toBe(PAYMENT_STATES.FAILED);
    });
  });

  describe('Base URL Configuration', () => {
    it('returns sandbox URL when MIDTRANS_IS_PRODUCTION is false', () => {
      process.env.MIDTRANS_IS_PRODUCTION = 'false';
      expect(getMidtransBaseUrl()).toBe('https://api.sandbox.midtrans.com/v2');
    });

    it('returns production URL when MIDTRANS_IS_PRODUCTION is true', () => {
      process.env.MIDTRANS_IS_PRODUCTION = 'true';
      expect(getMidtransBaseUrl()).toBe('https://api.midtrans.com/v2');
      process.env.MIDTRANS_IS_PRODUCTION = 'false'; // restore
    });
  });

  describe('Mock QRIS Mode when Server Key is empty', () => {
    beforeEach(() => {
      delete process.env.MIDTRANS_SERVER_KEY;
    });

    it('creates simulated charge without error', async () => {
      const result = await createQrisCharge({ orderId: 'test_order_123', amount: 25000 });
      expect(result.success).toBe(true);
      expect(result.isMock).toBe(true);
      expect(result.orderId).toBe('test_order_123');
      expect(result.qrUrl).toContain('data:image/svg+xml');
      expect(result.grossAmount).toBe(25000);
    });

    it('status starts as pending then changes to settlement after simulation', async () => {
      const orderId = 'test_order_456';
      await createQrisCharge({ orderId, amount: 25000 });

      const status1 = await checkTransactionStatus(orderId);
      expect(status1.internalStatus).toBe(PAYMENT_STATES.PENDING);

      // Simulate payment
      const simulated = simulateMockPayment(orderId);
      expect(simulated).toBe(true);

      const status2 = await checkTransactionStatus(orderId);
      expect(status2.internalStatus).toBe(PAYMENT_STATES.PAID);
    });
  });
});
