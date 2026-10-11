/**
 * Midtrans Payment Gateway Integration (Core API QRIS)
 * PRD Reference: F-01, F-02, F-03
 */

import { PAYMENT_STATES } from '../../src/shared/constants.js';

// SVG placeholder QRIS for offline / local mock when server key is not provided
const MOCK_QRIS_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><rect width="240" height="240" fill="%23ffffff"/><path d="M20 20h60v60h-60z M30 30h40v40h-40z M40 40h20v20h-20z M160 20h60v60h-60z M170 30h40v40h-40z M180 40h20v20h-20z M20 160h60v60h-60z M30 170h40v40h-40z M40 180h20v20h-20z M95 20h15v15h-15z M125 20h20v20h-20z M95 45h20v15h-20z M130 45h15v35h-15z M20 95h35v15h-35z M65 95h20v15h-20z M95 95h50v15h-50z M160 95h20v15h-20z M190 95h30v15h-30z M95 120h20v20h-20z M125 120h20v40h-20z M20 125h20v20h-20z M55 125h25v20h-25z M95 150h15v30h-15z M95 190h35v30h-35z M145 170h40v20h-40z M195 170h25v20h-25z M150 200h70v20h-70z" fill="%23000000"/><rect x="85" y="105" width="70" height="30" fill="%23000000"/><text x="120" y="125" font-family="monospace" font-size="11" font-weight="bold" text-anchor="middle" fill="%23ffffff">QRIS MOCK</text></svg>`;

// In-memory mock store for simulated transactions when running without API key
const mockStore = new Map();

/**
 * Get Midtrans Base URL
 */
export function getMidtransBaseUrl() {
  const isProd = process.env.MIDTRANS_IS_PRODUCTION === 'true';
  return isProd
    ? 'https://api.midtrans.com/v2'
    : 'https://api.sandbox.midtrans.com/v2';
}

/**
 * Get Authorization Header for Midtrans Basic Auth
 */
export function getAuthHeader() {
  const serverKey = process.env.MIDTRANS_SERVER_KEY || '';
  const token = Buffer.from(`${serverKey.trim()}:`).toString('base64');
  return `Basic ${token}`;
}

/**
 * Pure function: Map Midtrans status string to internal PAYMENT_STATES
 */
export function mapMidtransStatusToPaymentState(status) {
  if (!status) return PAYMENT_STATES.PENDING;
  const s = String(status).toLowerCase();
  if (s === 'settlement' || s === 'capture') return PAYMENT_STATES.PAID;
  if (s === 'pending') return PAYMENT_STATES.PENDING;
  if (s === 'expire' || s === 'expired') return PAYMENT_STATES.EXPIRED;
  if (s === 'cancel' || s === 'cancelled') return PAYMENT_STATES.CANCELLED;
  if (s === 'deny' || s === 'failure') return PAYMENT_STATES.FAILED;
  return PAYMENT_STATES.PENDING;
}

/**
 * Create Dynamic QRIS Charge via Midtrans Core API
 * @param {Object} options
 * @param {string} options.orderId - Unique order/session ID
 * @param {number} options.amount - Nominal in Rupiah
 * @returns {Promise<Object>}
 */
export async function createQrisCharge({ orderId, amount }) {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;

  // Fallback to Mock if server key is not configured
  if (!serverKey || serverKey.trim() === '') {
    console.warn('[Midtrans] MIDTRANS_SERVER_KEY tidak ditemukan. Menggunakan mode Simulasi Mock.');
    mockStore.set(orderId, {
      transaction_status: 'pending',
      order_id: orderId,
      gross_amount: amount,
      created_at: Date.now()
    });

    return {
      success: true,
      orderId,
      transactionId: `mock_${Date.now()}`,
      qrUrl: MOCK_QRIS_SVG,
      qrString: `00020101021126590014ID.LINKAJA.WWW011893600014000000000002150000000000000000303UMI51440014ID.DANA.WWW011893600014000000000002150000000000000000303UMI5204581253033605405${amount}5802ID5916TERAS PHOTOBOOTH6007BANDUNG61054011562070703A016304`,
      grossAmount: amount,
      isMock: true
    };
  }

  const url = `${getMidtransBaseUrl()}/charge`;
  const body = {
    payment_type: 'qris',
    transaction_details: {
      order_id: orderId,
      gross_amount: Math.round(amount)
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': getAuthHeader()
    },
    body: JSON.stringify(body)
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMsg = data.status_message || data.message || `Midtrans HTTP ${response.status}`;
    console.error('[Midtrans] Gagal membuat charge QRIS:', data);
    throw new Error(`Midtrans Charge Error: ${errorMsg}`);
  }

  // Find QR code image URL in actions
  const qrAction = (data.actions || []).find((act) => act.name === 'generate-qr-code');
  let qrUrl = qrAction ? qrAction.url : MOCK_QRIS_SVG;
  const qrString = data.qr_string || '';

  // Convert QR image to Base64 Data URL so it renders instantly without CSP / CORS blocks
  if (qrAction && qrAction.url) {
    try {
      const imgRes = await fetch(qrAction.url);
      if (imgRes.ok) {
        const arrayBuf = await imgRes.arrayBuffer();
        const base64 = Buffer.from(arrayBuf).toString('base64');
        qrUrl = `data:image/png;base64,${base64}`;
      }
    } catch (err) {
      console.warn('[Midtrans] Gagal pre-fetch gambar QR, menggunakan URL langsung:', err.message);
    }
  }

  return {
    success: true,
    orderId: data.order_id || orderId,
    transactionId: data.transaction_id,
    qrUrl,
    rawQrUrl: qrAction ? qrAction.url : '',
    qrString,
    grossAmount: Number(data.gross_amount) || amount,
    rawStatus: data.transaction_status,
    isMock: false
  };
}

/**
 * Check Transaction Status from Midtrans
 * @param {string} orderId
 * @returns {Promise<Object>}
 */
export async function checkTransactionStatus(orderId) {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;

  // Mock Store Check
  if (!serverKey || serverKey.trim() === '') {
    const mock = mockStore.get(orderId);
    if (!mock) {
      return { status: 'not_found', internalStatus: PAYMENT_STATES.PENDING };
    }
    return {
      orderId,
      status: mock.transaction_status,
      internalStatus: mapMidtransStatusToPaymentState(mock.transaction_status),
      isMock: true
    };
  }

  const url = `${getMidtransBaseUrl()}/${encodeURIComponent(orderId)}/status`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': getAuthHeader()
    }
  });

  if (!response.ok) {
    if (response.status === 404) {
      return { status: 'not_found', internalStatus: PAYMENT_STATES.PENDING };
    }
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.status_message || `HTTP ${response.status}`);
  }

  const data = await response.json();
  const rawStatus = data.transaction_status;
  const internalStatus = mapMidtransStatusToPaymentState(rawStatus);

  return {
    orderId,
    transactionId: data.transaction_id,
    status: rawStatus,
    internalStatus,
    grossAmount: Number(data.gross_amount),
    settlementTime: data.settlement_time || null,
    isMock: false
  };
}

/**
 * Simulate Payment for Mock/Testing environment
 * @param {string} orderId
 */
export function simulateMockPayment(orderId) {
  const mock = mockStore.get(orderId);
  if (mock) {
    mock.transaction_status = 'settlement';
    mock.settlement_time = new Date().toISOString();
    return true;
  }
  return false;
}

