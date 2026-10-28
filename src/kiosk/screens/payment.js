/**
 * Kiosk Payment Screen (QRIS Dinamis Midtrans)
 * PRD Reference: F-01, F-02, F-03
 * Design: RawBlock Brutalism (docs/DESIGN.md)
 */

import { api } from '../../shared/api.js';
import { TIMEOUTS, DEFAULTS, PAYMENT_STATES } from '../../shared/constants.js';

export function createPaymentScreen({ sessionId, onPaid, onExpired, onCancel }) {
  let container = null;
  let timerInterval = null;
  let pollInterval = null;
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

  function attachCopyAction(btn, urlText, defaultLabel) {
    if (!btn || !urlText) return;
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(urlText);
        btn.textContent = '✔️ TERSALIN!';
        setTimeout(() => {
          if (btn) btn.textContent = defaultLabel;
        }, 2000);
      } catch (e) {
        prompt('Salin URL ini untuk simulator Midtrans:', urlText);
      }
    });
  }

  function mount(parent) {
    container = document.createElement('div');
    container.className =
      'flex flex-col items-center justify-between w-full h-full max-w-5xl mx-auto p-6 box-border font-body';

    container.innerHTML = `
      <!-- Header (StudioBlank: 1px border, clear hierarchy) -->
      <div class="w-full flex items-center justify-between border-b border-[#D4D4D8] pb-4 mb-4">
        <div>
          <h1 class="text-h1 uppercase text-[#0A0A0A]">
            PEMBAYARAN QRIS
          </h1>
          <p class="text-body-sm text-[#71717A] mt-1">
            Pindai kode QRIS menggunakan GoPay, OVO, Dana, BCA, atau Mobile Banking apa saja
          </p>
        </div>
        <div class="flex items-center gap-3">
          <div class="chip-sb font-mono text-xs text-[#71717A]">
            SESI: ${sessionId.substring(0, 14)}
          </div>
          <button id="btn-cancel-payment" class="btn-sb-secondary text-xs h-9 px-4 font-mono uppercase tracking-wider cursor-pointer">
            BATAL
          </button>
        </div>
      </div>

      <!-- Main Payment Body -->
      <div class="flex-1 w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-center justify-center my-auto py-2">
        <!-- Left: QRIS Card Frame -->
        <div class="flex flex-col items-center justify-center">
          <div class="card-sb border border-[#E5E5E5] bg-white p-6 max-w-[360px] w-full flex flex-col items-center hover:border-[#0A0A0A]">
            <!-- QRIS Header Label -->
            <div class="w-full border-b border-[#E5E5E5] pb-3 mb-4 flex items-center justify-between">
              <span class="font-headline text-lg font-bold tracking-wider text-[#0A0A0A]">QRIS</span>
              <span class="chip-sb chip-sb-selected text-[10px] px-2 py-0.5">STANDAR NASIONAL</span>
            </div>

            <!-- QR Code Image / Container -->
            <div id="qr-container" class="w-64 h-64 border border-[#D4D4D8] bg-[#FAFAFA] flex items-center justify-center overflow-hidden">
              <p class="font-mono text-xs text-[#71717A] animate-pulse">MEMBUAT KODE QRIS...</p>
            </div>

            <!-- Instruction -->
            <p class="font-mono text-xs text-center text-[#71717A] mt-4 uppercase tracking-wider">
              ARAHKAN KAMERA HP KE KODE QR
            </p>
          </div>
        </div>

        <!-- Right: Nominal & Countdown Card -->
        <div class="flex flex-col space-y-5 max-w-md w-full mx-auto md:mx-0">
          <!-- Total Tagihan -->
          <div class="card-sb p-6 border border-[#E5E5E5] bg-white hover:border-[#0A0A0A]">
            <span class="font-mono text-xs uppercase tracking-widest text-[#71717A] block mb-1">TOTAL PEMBAYARAN</span>
            <div id="payment-nominal" class="font-headline text-4xl md:text-5xl font-bold text-[#0A0A0A] mt-1 tracking-tight">
              ${formatPrice(DEFAULTS.SESSION_PRICE)}
            </div>
            <p class="text-body-sm text-[#71717A] mt-2 font-light">
              Tarif sesi tunggal &bull; Termasuk cetak 4R otomatis
            </p>
          </div>

          <!-- Countdown Timer -->
          <div class="card-sb p-6 border border-[#E5E5E5] bg-white hover:border-[#0A0A0A]">
            <span class="font-mono text-xs uppercase tracking-widest text-[#71717A] block mb-1">SISA WAKTU PEMBAYARAN</span>
            <div id="payment-timer" class="font-mono text-4xl md:text-5xl font-semibold text-[#0A0A0A] tracking-wider mt-1">
              03:00
            </div>
            <div class="w-full bg-[#F4F4F5] h-1.5 mt-4 overflow-hidden">
              <div id="timer-bar" class="bg-[#0A0A0A] h-full w-full transition-all duration-1000 ease-linear"></div>
            </div>
          </div>

          <!-- Status Indicator -->
          <div id="payment-status-box" class="border border-[#E5E5E5] bg-[#FAFAFA] p-4 flex items-center gap-3">
            <div class="w-2.5 h-2.5 bg-[#0A0A0A] animate-pulse shrink-0"></div>
            <p id="payment-status-text" class="font-mono text-xs text-[#0A0A0A] uppercase tracking-wider">
              MENUNGGU PEMBAYARAN DARI PELANGGAN...
            </p>
          </div>

          <!-- Dev Simulator Panel (Sandbox Only) -->
          <div id="dev-sim-wrapper" class="hidden card-sb p-4 border border-dashed border-[#A1A1AA] bg-[#FAFAFA] space-y-2">
            <div class="flex items-center justify-between border-b border-[#E5E5E5] pb-2">
              <span class="font-mono text-[11px] uppercase text-[#71717A]">[DEV PANEL - SANDBOX ONLY]</span>
              <span class="chip-sb text-[9px] px-1.5 py-0.5">SANDBOX</span>
            </div>

            <!-- Action 1: generate-qr-code -->
            <div id="dev-action-v1-box" class="hidden flex flex-col gap-1 bg-white p-2 border border-[#E5E5E5]">
              <div class="flex items-center justify-between gap-2">
                <span class="font-mono text-[10px] text-[#0A0A0A]">generate-qr-code:</span>
                <button id="btn-copy-url-v1" type="button" class="btn-sb-secondary text-[10px] py-1 px-2 font-mono h-auto">
                  SALIN URL V1
                </button>
              </div>
              <p id="dev-url-v1" class="font-mono text-[9px] text-[#71717A] break-all select-all"></p>
            </div>

            <!-- Action 2: generate-qr-code-v2 -->
            <div id="dev-action-v2-box" class="hidden flex flex-col gap-1 bg-white p-2 border border-[#E5E5E5]">
              <div class="flex items-center justify-between gap-2">
                <span class="font-mono text-[10px] text-[#0A0A0A]">generate-qr-code-v2:</span>
                <button id="btn-copy-url-v2" type="button" class="btn-sb-secondary text-[10px] py-1 px-2 font-mono h-auto">
                  SALIN URL V2
                </button>
              </div>
              <p id="dev-url-v2" class="font-mono text-[9px] text-[#71717A] break-all select-all"></p>
            </div>

            <button id="btn-simulate-pay" type="button" class="btn-sb-secondary w-full text-xs py-2 h-auto bg-white text-[#0A0A0A] border-dashed font-mono">
              [DEV] SIMULASI BAYAR LANGSUNG
            </button>
          </div>
        </div>
      </div>

      <!-- Confirmation Modal for Cancellation -->
      <div id="modal-confirm-cancel" class="hidden fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6 select-none backdrop-blur-xs">
        <div class="card-sb border border-[#E5E5E5] bg-white max-w-md w-full p-8 space-y-6">
          <!-- Header -->
          <div class="border-b border-[#E5E5E5] pb-4 space-y-2">
            <span class="font-mono text-xs uppercase tracking-widest text-[#71717A] font-medium">
              KONFIRMASI
            </span>
            <h2 class="text-h3 uppercase text-[#0A0A0A] font-semibold tracking-tight mt-1">
              BATALKAN SESI INI?
            </h2>
            <p class="text-body-sm text-[#71717A]">
              Sesi foto akan diakhiri dan transaksi QRIS ini akan dibatalkan.
            </p>
          </div>

          <!-- Pilihan Tombol YA / TIDAK -->
          <div class="flex flex-row gap-4 pt-2">
            <button id="btn-cancel-yes" type="button" class="btn-sb-destructive flex-1 h-12 text-xs font-mono uppercase tracking-wider cursor-pointer">
              YA, BATALKAN
            </button>
            <button id="btn-cancel-no" type="button" class="btn-sb-secondary flex-1 h-12 text-xs font-mono uppercase tracking-wider cursor-pointer">
              KEMBALI
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
    const cancelModal = container.querySelector('#modal-confirm-cancel');
    const cancelYesBtn = container.querySelector('#btn-cancel-yes');
    const cancelNoBtn = container.querySelector('#btn-cancel-no');
    const simPayBtn = container.querySelector('#btn-simulate-pay');

    cancelBtn.addEventListener('click', () => {
      if (cancelModal) {
        cancelModal.classList.remove('hidden');
      } else {
        cleanup();
        if (onCancel) onCancel();
      }
    });

    if (cancelNoBtn && cancelModal) {
      cancelNoBtn.addEventListener('click', () => {
        cancelModal.classList.add('hidden');
      });
    }

    if (cancelYesBtn) {
      cancelYesBtn.addEventListener('click', () => {
        if (cancelModal) {
          cancelModal.classList.add('hidden');
        }
        cleanup();
        if (onCancel) onCancel();
      });
    }

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

        // Only display dev panel and action URLs when MIDTRANS_ENV=sandbox
        const devWrapper = container.querySelector('#dev-sim-wrapper');
        if (data.midtrans_env === 'sandbox' && devWrapper) {
          devWrapper.classList.remove('hidden');

          const urlV1 = data.actions?.['generate-qr-code'] || data.qr_code_url || '';
          const urlV2 = data.actions?.['generate-qr-code-v2'] || data.qr_code_url_v2 || '';

          const boxV1 = container.querySelector('#dev-action-v1-box');
          const textV1 = container.querySelector('#dev-url-v1');
          const btnV1 = container.querySelector('#btn-copy-url-v1');
          if (urlV1 && boxV1 && textV1 && btnV1) {
            boxV1.classList.remove('hidden');
            textV1.textContent = urlV1;
            attachCopyAction(btnV1, urlV1, '📋 SALIN URL V1');
          }

          const boxV2 = container.querySelector('#dev-action-v2-box');
          const textV2 = container.querySelector('#dev-url-v2');
          const btnV2 = container.querySelector('#btn-copy-url-v2');
          if (urlV2 && boxV2 && textV2 && btnV2) {
            boxV2.classList.remove('hidden');
            textV2.textContent = urlV2;
            attachCopyAction(btnV2, urlV2, '📋 SALIN URL V2');
          }
        } else if (devWrapper) {
          // Ensure completely hidden and empty in production mode
          devWrapper.classList.add('hidden');
          devWrapper.innerHTML = '';
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
        eventSource = new EventSource(`http://localhost:${DEFAULTS.SERVER_PORT}/api/sse`);

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

        const onFailedOrExpired = (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.sessionId === sessionId) {
              handleExpired();
            }
          } catch (err) {
            console.warn('[Payment SSE] Parse error:', err);
          }
        };

        eventSource.addEventListener('payment_expired', onFailedOrExpired);
        eventSource.addEventListener('payment_failed', onFailedOrExpired);

        eventSource.onerror = () => {
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
          if (res.success && res.data) {
            const st = res.data.status;
            if (st === PAYMENT_STATES.LUNAS || st === 'paid') {
              handleSuccess();
            } else if (st === PAYMENT_STATES.GAGAL || st === 'failed' || st === 'expired') {
              handleExpired();
            }
          }
        } catch (e) {
          // ignore
        }
      }, 2000);
    }

    function handleSuccess() {
      cleanup();
      if (statusBox && statusText) {
        statusBox.className = 'card-sb p-4 border border-[#2BB673] bg-[#2BB673]/10 text-[#0A0A0A] flex items-center gap-3';
        statusText.className = 'font-mono text-xs uppercase font-medium text-[#0A0A0A]';
        statusText.textContent = 'PEMBAYARAN DITERIMA! MEMPROSES SESI...';
      }

      setTimeout(() => {
        if (onPaid) onPaid();
      }, 1200);
    }

    function handleExpired() {
      cleanup();
      if (statusBox && statusText) {
        statusBox.className = 'card-sb p-4 border border-[#E5484D] bg-[#E5484D]/10 text-[#E5484D] flex items-center gap-3';
        statusText.className = 'font-mono text-xs uppercase font-medium text-[#E5484D]';
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

