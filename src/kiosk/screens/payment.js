/**
 * Kiosk Payment Screen (QRIS Dinamis Midtrans)
 * PRD Reference: F-01, F-02, F-03
 * Design: RawBlock Brutalism (docs/DESIGN.md)
 */

import { api } from '../../shared/api.js';
import { TIMEOUTS, DEFAULTS } from '../../shared/constants.js';

export function createPaymentScreen({ sessionId, onPaid, onExpired, onCancel }) {
  let container = null;
  let timerInterval = null;
  let eventSource = null;
  let remainingSeconds = TIMEOUTS.PAYMENT_SECONDS; // 180s (3 minutes)

  function formatPrice(amount) {
    return 'RP ' + Number(amount || DEFAULTS.SESSION_PRICE).toLocaleString('id-ID');
  }

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  function mount(parent) {
    container = document.createElement('div');
    container.className =
      'flex flex-col items-center justify-between w-full h-full max-w-5xl mx-auto p-6 box-border font-body';

    container.innerHTML = `
      <!-- Header -->
      <div class="w-full flex items-center justify-between border-b-[5px] border-black pb-4 mb-4">
        <div>
          <h1 class="text-3xl md:text-4xl font-headline uppercase text-black">
            PEMBAYARAN QRIS
          </h1>
          <p class="font-body text-xs text-black/70">
            SCAN KODE QRIS MENGGUNAKAN GO-PAY, OVO, DANA, BCA, ATAU MOBILE BANKING
          </p>
        </div>
        <div class="flex items-center gap-3">
          <div class="chip-raw bg-white font-mono text-xs">
            SESI: ${sessionId.substring(0, 14)}
          </div>
          <button id="btn-cancel-payment" class="btn-raw-secondary text-xs px-4 py-2">
            BATAL
          </button>
        </div>
      </div>

      <!-- Main Payment Body -->
      <div class="flex-1 w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-center justify-center my-auto">
        <!-- Left: QRIS Card Frame -->
        <div class="flex flex-col items-center justify-center">
          <div class="border-[5px] border-black bg-white p-4 max-w-[340px] w-full flex flex-col items-center">
            <!-- QRIS Header Label -->
            <div class="w-full border-b-[3px] border-black pb-2 mb-3 flex items-center justify-between">
              <span class="font-headline text-lg tracking-wider">QRIS</span>
              <span class="chip-raw bg-black text-white text-[10px] px-2 py-0.5">NATIONAL STANDARD</span>
            </div>

            <!-- QR Code Image / Container -->
            <div id="qr-container" class="w-64 h-64 border-[3px] border-black bg-raw-sunken flex items-center justify-center overflow-hidden">
              <p class="font-mono text-xs text-black/50 animate-pulse">MEMBUAT KODE QRIS...</p>
            </div>

            <!-- Instruction -->
            <p class="font-mono text-[11px] text-center text-black/80 mt-3 uppercase tracking-tight">
              TAMPILKAN KE KAMERA HP ANDA
            </p>
          </div>
        </div>

        <!-- Right: Nominal & Countdown Card -->
        <div class="flex flex-col space-y-6">
          <!-- Total Tagihan -->
          <div class="card-raw p-6 border-[5px] border-black bg-white">
            <span class="chip-raw bg-black text-white text-xs mb-2">TOTAL PEMBAYARAN</span>
            <div id="payment-nominal" class="font-headline text-4xl md:text-5xl text-black mt-2">
              ${formatPrice(DEFAULTS.SESSION_PRICE)}
            </div>
            <p class="font-body text-xs text-black/60 mt-1">
              Harga sesi tetap &bull; Bebas pilih template apa pun setelah pembayaran
            </p>
          </div>

          <!-- Countdown Timer -->
          <div class="card-raw p-6 border-[5px] border-black bg-white">
            <span class="chip-raw bg-white text-xs mb-2">SISA WAKTU PEMBAYARAN</span>
            <div id="payment-timer" class="font-mono text-4xl md:text-5xl font-bold text-black tracking-widest mt-2">
              03:00
            </div>
            <div class="w-full bg-raw-sunken h-2 mt-4 border border-black overflow-hidden">
              <div id="timer-bar" class="bg-black h-full w-full transition-all duration-1000 ease-linear"></div>
            </div>
          </div>

          <!-- Status Indicator -->
          <div id="payment-status-box" class="card-raw p-4 border-[3px] border-black bg-raw-sunken flex items-center gap-3">
            <div class="w-3 h-3 bg-raw-accent border border-black animate-ping"></div>
            <p id="payment-status-text" class="font-mono text-xs text-black uppercase">
              MENUNGGU PEMBAYARAN DARI PELANGGAN...
            </p>
          </div>

          <!-- Dev Simulator Button (Helper) -->
          <div id="dev-sim-wrapper" class="pt-2">
            <button id="btn-simulate-pay" class="btn-raw-secondary w-full text-xs py-2 bg-raw-sunken text-black border-dashed">
              [DEV] SIMULASI BAYAR LANGSUNG
            </button>
          </div>
        </div>
      </div>
    `;

    parent.appendChild(container);

    const qrContainer = container.querySelector('#qr-container');
    const nominalEl = container.querySelector('#payment-nominal');
    const timerEl = container.querySelector('#payment-timer');
    const timerBar = container.querySelector('#timer-bar');
    const statusBox = container.querySelector('#payment-status-box');
    const statusText = container.querySelector('#payment-status-text');
    const cancelBtn = container.querySelector('#btn-cancel-payment');
    const simPayBtn = container.querySelector('#btn-simulate-pay');

    let pollInterval = null;

    cancelBtn.addEventListener('click', () => {
      cleanup();
      if (onCancel) onCancel();
    });

    simPayBtn.addEventListener('click', async () => {
      try {
        simPayBtn.disabled = true;
        simPayBtn.textContent = 'MEMPROSES SIMULASI...';
        await api.simulatePayment(sessionId);
        // Direct instant transition on successful simulation
        handleSuccess();
      } catch (e) {
        console.warn('[Payment] Simulasi bayar gagal:', e.message);
        try {
          await api.confirmPaymentManual(sessionId);
          handleSuccess();
        } catch (err) {
          alert('Gagal simulasi: ' + err.message);
          simPayBtn.disabled = false;
          simPayBtn.textContent = '[DEV] SIMULASI BAYAR LANGSUNG';
        }
      }
    });

    // 1. Generate QRIS via Backend API
    async function loadQris() {
      try {
        const res = await api.createPaymentCharge(sessionId);
        const data = res.data;

        nominalEl.textContent = formatPrice(data.nominal);

        if (data.qr_url) {
          qrContainer.innerHTML = `<img src="${data.qr_url}" alt="QRIS Code" class="w-full h-full object-contain p-2" />`;
        } else if (data.qr_string) {
          qrContainer.innerHTML = `
            <div class="p-2 text-center break-all font-mono text-[9px]">
              ${data.qr_string}
            </div>
          `;
        }
      } catch (err) {
        console.error('[Payment] Gagal memuat QRIS:', err);
        qrContainer.innerHTML = `
          <div class="p-4 text-center">
            <p class="font-headline text-xs text-raw-error uppercase">GAGAL MEMBUAT QRIS</p>
            <p class="font-body text-[11px] text-black/70 mt-1">${err.message}</p>
          </div>
        `;
      }
    }

    // 2. Start Countdown Timer
    function startTimer() {
      timerInterval = setInterval(() => {
        remainingSeconds--;

        if (timerEl) {
          timerEl.textContent = formatTime(remainingSeconds);
        }

        if (timerBar) {
          const pct = Math.max(0, (remainingSeconds / TIMEOUTS.PAYMENT_SECONDS) * 100);
          timerBar.style.width = `${pct}%`;
        }

        if (remainingSeconds <= 0) {
          handleExpired();
        }
      }, 1000);
    }

    // 3. Connect to Server-Sent Events (SSE)
    function connectSse() {
      try {
        eventSource = new EventSource(`http://localhost:${DEFAULTS.SERVER_PORT}/api/events`);

        eventSource.addEventListener('payment_paid', (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.sessionId === sessionId) {
              handleSuccess();
            }
          } catch (err) {
            console.warn('[Payment SSE] Parse error:', err);
          }
        });

        eventSource.addEventListener('payment_expired', (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.sessionId === sessionId) {
              handleExpired();
            }
          } catch (err) {
            console.warn('[Payment SSE] Parse error:', err);
          }
        });

        eventSource.onerror = (err) => {
          console.warn('[Payment SSE] Koneksi terputus, mengandalkan polling backend.');
        };
      } catch (e) {
        console.warn('[Payment] SSE tidak didukung:', e);
      }
    }

    // 4. Polling Fallback (Cek status tiap 2 detik jika SSE terhambat)
    function startPollingFallback() {
      pollInterval = setInterval(async () => {
        try {
          const res = await api.getPayment(sessionId);
          if (res.success && res.data && res.data.status === 'paid') {
            handleSuccess();
          }
        } catch (e) {
          // ignore
        }
      }, 2000);
    }

    function handleSuccess() {
      cleanup();
      if (statusBox && statusText) {
        statusBox.className = 'card-raw p-4 border-[5px] border-black bg-raw-success text-white flex items-center gap-3';
        statusText.className = 'font-headline text-sm uppercase text-white';
        statusText.textContent = 'PEMBAYARAN DITERIMA! MEMPROSES SESI...';
      }

      setTimeout(() => {
        if (onPaid) onPaid();
      }, 1200);
    }

    function handleExpired() {
      cleanup();
      if (statusBox && statusText) {
        statusBox.className = 'card-raw p-4 border-[5px] border-black bg-raw-error text-white flex items-center gap-3';
        statusText.className = 'font-headline text-sm uppercase text-white';
        statusText.textContent = 'WAKTU PEMBAYARAN TELAH HABIS';
      }

      setTimeout(() => {
        if (onExpired) onExpired();
      }, 3000);
    }

    loadQris();
    startTimer();
    connectSse();
    startPollingFallback();
  }

  function cleanup() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }

  function unmount() {
    cleanup();
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    container = null;
  }

  return { mount, unmount };
}

