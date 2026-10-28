import { api } from '../../shared/api.js';
import { preventDoubleClick } from '../../shared/ui.js';
import { getCameraDevices } from '../../shared/camera.js';
import { pageHeader, formatRupiah } from '../ui-helpers.js';

export function createHomeScreen({ onStatusChange } = {}) {
  let container = null;
  let activeConfirmSessionId = null;
  let handleDeviceChange = null;

  async function loadTodayStats() {
    if (!container) return;
    try {
      const res = await api.getDailyReport('');
      if (!res.success || !res.data) return;
      const { today } = res.data;

      const sessionsEl = container.querySelector('#home-today-sessions');
      const paidEl = container.querySelector('#home-today-paid');
      const revenueEl = container.querySelector('#home-today-revenue');

      if (sessionsEl) sessionsEl.textContent = `${today.total_sessions} SESI`;
      if (paidEl) paidEl.textContent = `${today.paid_sessions} LUNAS`;
      if (revenueEl) revenueEl.textContent = formatRupiah(today.revenue);
    } catch (err) {
      console.warn('[Home] Gagal memuat statistik hari ini:', err.message);
    }
  }

  function updateCameraStatusUI(devices, activeId) {
    if (!container) return;
    const camChip = container.querySelector('#cam-chip');
    const camHint = container.querySelector('#cam-hint');
    const activeDev = devices.find((d) => d.deviceId === activeId);
    if (!activeDev) return;

    if (activeDev.isExternal) {
      if (camChip) {
        camChip.textContent = 'TERHUBUNG (EKSTERNAL)';
        camChip.className = 'chip-sb border border-[#2BB673]/40 text-[#0A0A0A] bg-[#2BB673]/10 text-xs';
      }
      if (camHint) {
        camHint.textContent = `Kamera eksternal (${activeDev.label}) aktif dan siap untuk sesi foto kiosk.`;
      }
    } else {
      if (camChip) {
        camChip.textContent = 'TERHUBUNG (LAPTOP)';
        camChip.className = 'chip-sb border border-[#2BB673]/40 text-[#0A0A0A] bg-[#2BB673]/10 text-xs';
      }
      if (camHint) {
        camHint.textContent = 'Kamera eksternal tidak ditemukan. Menggunakan kamera bawaan laptop sebagai default.';
      }
    }
  }

  async function updateCameraDevices() {
    if (!container) return;
    const selectCamera = container.querySelector('#select-camera-device');
    const camChip = container.querySelector('#cam-chip');
    const camHint = container.querySelector('#cam-hint');
    if (!selectCamera) return;

    try {
      const devices = await getCameraDevices();
      selectCamera.innerHTML = '';

      if (!devices || devices.length === 0) {
        selectCamera.innerHTML = '<option value="">TIDAK ADA KAMERA TERHUBUNG</option>';
        if (camChip) {
          camChip.textContent = 'TIDAK TERHUBUNG';
          camChip.className = 'chip-sb border border-[#E5484D]/40 text-[#E5484D] bg-[#E5484D]/10 text-xs';
        }
        if (camHint) {
          camHint.textContent = 'Peringatan: Tidak ada kamera terdeteksi. Sambungkan DSLR/webcam ke port USB!';
        }
        return;
      }

      const savedCamId = typeof localStorage !== 'undefined' ? localStorage.getItem('selected_camera_id') : null;
      let selectedId = '';

      devices.forEach((dev) => {
        const opt = document.createElement('option');
        opt.value = dev.deviceId;
        const tag = dev.isExternal ? '[EKSTERNAL]' : '[INTERNAL / LAPTOP]';
        opt.textContent = `${dev.label} ${tag}`;
        selectCamera.appendChild(opt);
      });

      if (savedCamId && devices.some((d) => d.deviceId === savedCamId)) {
        selectedId = savedCamId;
      } else {
        const ext = devices.find((d) => d.isExternal);
        selectedId = ext ? ext.deviceId : devices[0].deviceId;
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('selected_camera_id', selectedId);
        }
      }

      selectCamera.value = selectedId;
      updateCameraStatusUI(devices, selectedId);
    } catch (err) {
      console.warn('[Admin] Gagal memuat daftar kamera:', err);
    }
  }

  async function updatePrinterDevices() {
    if (!container) return;
    const selectPrinter = container.querySelector('#select-printer-device');
    const printerChip = container.querySelector('#printer-chip');
    const printerHint = container.querySelector('#printer-hint');
    if (!selectPrinter) return;

    try {
      let printers = [];
      if (window.photobooth?.getPrinters) {
        printers = await window.photobooth.getPrinters();
      }

      selectPrinter.innerHTML = '';

      if (!printers || printers.length === 0) {
        selectPrinter.innerHTML = '<option value="">TIDAK ADA PRINTER TERHUBUNG</option>';
        if (printerChip) {
          printerChip.textContent = 'TIDAK TERHUBUNG';
          printerChip.className = 'chip-sb border border-[#E5484D]/40 text-[#E5484D] bg-[#E5484D]/10 text-xs';
        }
        if (printerHint) {
          printerHint.textContent = 'Tidak ada printer terdeteksi pada sistem laptop. Pastikan kabel printer terpasang dan driver aktif.';
        }
        return;
      }

      const savedPrinter = typeof localStorage !== 'undefined' ? localStorage.getItem('selected_printer_name') : null;
      let chosenName = '';

      printers.forEach((p) => {
        const opt = document.createElement('option');
        const pName = p.name || p.displayName;
        opt.value = pName;
        opt.textContent = p.isDefault ? `${pName} [DEFAULT SISTEM]` : pName;
        selectPrinter.appendChild(opt);
      });

      if (savedPrinter && printers.some((p) => (p.name || p.displayName) === savedPrinter)) {
        chosenName = savedPrinter;
      } else {
        const def = printers.find((p) => p.isDefault);
        chosenName = def ? (def.name || def.displayName) : (printers[0].name || printers[0].displayName);
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('selected_printer_name', chosenName);
        }
      }

      selectPrinter.value = chosenName;
      if (printerChip) {
        printerChip.textContent = 'TERHUBUNG';
        printerChip.className = 'chip-sb border border-[#2BB673]/40 text-[#0A0A0A] bg-[#2BB673]/10 text-xs';
      }
      if (printerHint) {
        printerHint.textContent = `Printer "${chosenName}" siap digunakan untuk cetak senyap otomatis (silent print).`;
      }
    } catch (err) {
      console.warn('[Admin] Gagal memuat daftar printer:', err);
    }
  }

  function openPinModal(sessionId) {
    if (!container) return;
    activeConfirmSessionId = sessionId;
    const pinModalOverlay = container.querySelector('#pin-modal-overlay');
    const pinModalSessionId = container.querySelector('#pin-modal-session-id');
    const inputPinConfirm = container.querySelector('#input-pin-confirm');
    const pinModalError = container.querySelector('#pin-modal-error');

    if (pinModalSessionId) pinModalSessionId.textContent = sessionId;
    if (inputPinConfirm) inputPinConfirm.value = '';
    if (pinModalError) pinModalError.classList.add('hidden');
    if (pinModalOverlay) pinModalOverlay.classList.remove('hidden');
    setTimeout(() => inputPinConfirm?.focus(), 100);
  }

  function closePinModal() {
    activeConfirmSessionId = null;
    if (container) {
      const pinModalOverlay = container.querySelector('#pin-modal-overlay');
      if (pinModalOverlay) pinModalOverlay.classList.add('hidden');
    }
  }

  async function checkWaitingPayment() {
    if (!container) return;
    const widgetContent = container.querySelector('#payment-widget-content');
    const widgetBadge = container.querySelector('#payment-widget-badge');
    if (!widgetContent || !widgetBadge) return;

    try {
      const sessionRes = await api.getCurrentSession();
      const session = sessionRes.data;

      if (session && session.status === 'waiting_payment') {
        let paymentData = null;
        try {
          const payRes = await api.getPayment(session.id);
          paymentData = payRes.data;
        } catch (e) {
          // payment data may be pending creation
        }

        const nominal = paymentData ? Number(paymentData.nominal).toLocaleString('id-ID') : '25.000';

        widgetBadge.className = 'chip-sb bg-[#0A0A0A] text-[#FAFAFA] animate-pulse text-xs';
        widgetBadge.textContent = 'MENUNGGU PEMBAYARAN';

        widgetContent.innerHTML = `
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border border-[#E5E5E5] bg-[#FAFAFA]">
            <div>
              <p class="text-body font-semibold text-[#0A0A0A] uppercase">
                SESI AKTIF: ${session.id}
              </p>
              <p class="font-mono text-xs text-[#737373] mt-1">
                NOMINAL: <span class="font-bold text-[#0A0A0A]">RP ${nominal}</span> &bull; STATUS: <span class="uppercase">WAITING PAYMENT</span>
              </p>
              <p class="text-caption text-[#737373] mt-1">
                Gunakan konfirmasi manual jika customer telah membayar tetapi gateway terganggu.
              </p>
            </div>
            <button
              id="btn-manual-confirm"
              type="button"
              data-session-id="${session.id}"
              class="btn-sb-primary px-5 py-2.5 text-xs font-mono whitespace-nowrap cursor-pointer"
            >
              KONFIRMASI BAYAR MANUAL
            </button>
          </div>
        `;
      } else {
        widgetBadge.className = 'chip-sb border border-[#2BB673]/40 text-[#0A0A0A] bg-[#2BB673]/10 text-xs';
        widgetBadge.textContent = 'STANDBY';
        widgetContent.innerHTML = `
          <div class="p-4 border border-[#E5E5E5] bg-[#FAFAFA]">
            <p class="font-mono text-xs text-[#737373]">Tidak ada sesi aktif yang sedang menunggu pembayaran.</p>
          </div>
        `;
      }
    } catch (err) {
      console.warn('Gagal mengecek status pembayaran aktif:', err.message);
    }
  }

  function setupEventListeners(el) {
    const selectCamera = el.querySelector('#select-camera-device');
    const selectPrinter = el.querySelector('#select-printer-device');
    const widgetContent = el.querySelector('#payment-widget-content');
    const pinModalOverlay = el.querySelector('#pin-modal-overlay');
    const btnCancelPin = el.querySelector('#btn-cancel-pin-modal');
    const pinForm = el.querySelector('#pin-confirm-form');
    const inputPinConfirm = el.querySelector('#input-pin-confirm');
    const pinModalError = el.querySelector('#pin-modal-error');
    const resetBtn = el.querySelector('#btn-emergency-reset');

    selectCamera?.addEventListener('change', async (e) => {
      const chosenId = e.target.value;
      if (chosenId) {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('selected_camera_id', chosenId);
        }
        const devices = await getCameraDevices();
        updateCameraStatusUI(devices, chosenId);
        onStatusChange?.();
      }
    });

    handleDeviceChange = () => {
      updateCameraDevices();
      onStatusChange?.();
    };
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    }

    selectPrinter?.addEventListener('change', (e) => {
      const chosenName = e.target.value;
      if (chosenName) {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('selected_printer_name', chosenName);
        }
        const printerChip = el.querySelector('#printer-chip');
        const printerHint = el.querySelector('#printer-hint');
        if (printerChip) {
          printerChip.textContent = 'TERHUBUNG';
          printerChip.className = 'chip-sb border border-[#2BB673]/40 text-[#0A0A0A] bg-[#2BB673]/10 text-xs';
        }
        if (printerHint) {
          printerHint.textContent = `Printer "${chosenName}" siap digunakan untuk cetak senyap otomatis (silent print).`;
        }
        onStatusChange?.();
      }
    });

    widgetContent?.addEventListener('click', (e) => {
      const btn = e.target.closest('#btn-manual-confirm');
      if (btn) {
        const sId = btn.getAttribute('data-session-id');
        if (sId) openPinModal(sId);
      }
    });

    btnCancelPin?.addEventListener('click', closePinModal);

    pinModalOverlay?.addEventListener('click', (e) => {
      if (e.target === pinModalOverlay) closePinModal();
    });

    pinForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!activeConfirmSessionId) return;

      const enteredPin = inputPinConfirm?.value || '';
      try {
        const verifyRes = await api.verifyPin(enteredPin);
        if (!verifyRes.success) throw new Error('PIN tidak valid');

        const targetSessionId = activeConfirmSessionId;
        closePinModal();

        await api.confirmPaymentManual(targetSessionId);
        alert(`Pembayaran untuk sesi ${targetSessionId} berhasil dikonfirmasi secara manual! Kiosk langsung melanjutkan.`);
        await checkWaitingPayment();
        await loadTodayStats();
        onStatusChange?.();
      } catch (err) {
        if (pinModalError) {
          pinModalError.textContent = 'PIN SALAH! SILAKAN COBA LAGI.';
          pinModalError.classList.remove('hidden');
        }
      }
    });

    if (resetBtn) {
      resetBtn.addEventListener(
        'click',
        preventDoubleClick(
          resetBtn,
          async () => {
            if (confirm('Yakin ingin mereset sesi aktif dan kembali ke layar awal?')) {
              try {
                const current = await api.getCurrentSession();
                if (current.data && current.data.id) {
                  await api.updateSessionStatus(current.data.id, 'cancelled');
                }
                alert('Sesi berhasil direset');
                await checkWaitingPayment();
                await loadTodayStats();
                onStatusChange?.();
              } catch (err) {
                alert('Gagal mereset: ' + err.message);
              }
            }
          },
          'MERESET...'
        )
      );
    }
  }

  return {
    mount(parent) {
      container = document.createElement('div');
      container.innerHTML = `
        ${pageHeader({
          title: 'BERANDA',
          description: 'Pantau sesi yang sedang berjalan hari ini'
        })}

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 mb-6">
          <div class="card-sb p-6 border border-[#E5E5E5] bg-white">
            <span class="text-caption font-mono uppercase text-[#737373] font-medium tracking-wider">SESI HARI INI</span>
            <div class="mt-2">
              <span id="home-today-sessions" class="text-h2 font-semibold text-[#0A0A0A] tracking-tight">0 SESI</span>
            </div>
          </div>
          <div class="card-sb p-6 border border-[#E5E5E5] bg-white">
            <span class="text-caption font-mono uppercase text-[#737373] font-medium tracking-wider">LUNAS</span>
            <div class="mt-2">
              <span id="home-today-paid" class="text-h2 font-semibold text-[#0A0A0A] tracking-tight">0 LUNAS</span>
            </div>
          </div>
          <div class="card-sb p-6 border border-[#E5E5E5] bg-white sm:col-span-2 lg:col-span-1">
            <span class="text-caption font-mono uppercase text-[#737373] font-medium tracking-wider">OMSET HARI INI</span>
            <div class="mt-2">
              <span id="home-today-revenue" class="text-h2 font-semibold text-[#0A0A0A] tracking-tight">RP 0</span>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div class="lg:col-span-2">
            <section id="waiting-payment-section" class="card-sb border border-[#E5E5E5] bg-white h-full flex flex-col justify-between p-6">
              <div class="flex items-center justify-between pb-3 border-b border-[#E5E5E5]">
                <div class="flex items-center gap-2">
                  <span class="chip-sb text-xs font-mono text-[#737373] border border-[#E5E5E5]">F-04</span>
                  <h2 class="text-body font-semibold uppercase tracking-tight text-[#0A0A0A]">
                    SESI MENUNGGU PEMBAYARAN (QRIS)
                  </h2>
                </div>
                <span id="payment-widget-badge" class="chip-sb text-xs border border-[#FFD166]/40 text-[#0A0A0A] bg-[#FFD166]/10">STANDBY</span>
              </div>

              <div id="payment-widget-content" class="py-4 flex-1">
                <p class="font-mono text-xs text-[#737373]">Mengecek sesi aktif di kiosk...</p>
              </div>
            </section>
          </div>

          <div>
            <section class="card-sb border border-[#E5E5E5] bg-white h-full flex flex-col justify-between p-6">
              <div>
                <div class="flex items-center gap-2 pb-3 border-b border-[#E5E5E5]">
                  <span class="chip-sb text-xs font-mono text-[#737373] border border-[#E5E5E5]">F-16</span>
                  <h3 class="text-body font-semibold uppercase text-[#0A0A0A]">TOMBOL DARURAT</h3>
                </div>
                <p class="text-caption text-[#737373] mt-3 leading-relaxed">
                  Gunakan jika customer mengalami kendala dan ingin membatalkan sesi kembali ke layar Welcome.
                </p>
              </div>
              <div class="pt-4">
                <button id="btn-emergency-reset" class="btn-sb-destructive w-full py-2.5 text-xs font-mono uppercase tracking-wider">
                  RESET KE WELCOME
                </button>
              </div>
            </section>
          </div>
        </div>

        <div class="mb-6">
          <div class="flex items-center gap-2 pb-2 mb-4 border-b border-[#E5E5E5]">
            <span class="chip-sb text-xs font-mono text-[#737373] border border-[#E5E5E5]">PERANGKAT</span>
            <h2 class="text-body font-semibold uppercase tracking-tight text-[#0A0A0A]">
              STATUS & PEMILIHAN PERANGKAT
            </h2>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Card Kamera -->
            <div class="card-sb flex flex-col justify-between p-6 bg-white border border-[#E5E5E5]">
              <div class="flex items-center justify-between pb-3 border-b border-[#E5E5E5]">
                <span class="text-caption font-mono uppercase text-[#737373] font-medium tracking-wider">PERANGKAT KAMERA</span>
                <span id="cam-chip" class="chip-sb text-xs border border-[#FFD166]/40 text-[#0A0A0A] bg-[#FFD166]/10">MEMINDAI...</span>
              </div>
              <div class="mt-4">
                <label for="select-camera-device" class="block text-caption font-mono uppercase text-[#0A0A0A] mb-2 font-medium">
                  PILIH SUMBER KAMERA:
                </label>
                <select id="select-camera-device" class="input-sb w-full text-xs font-mono bg-white cursor-pointer">
                  <option value="">MEMINDAI PERANGKAT KAMERA...</option>
                </select>
                <p id="cam-hint" class="font-mono text-[11px] text-[#737373] mt-2">
                  Mendeteksi ketersediaan kamera eksternal dan bawaan laptop...
                </p>
              </div>
            </div>

            <!-- Card Printer -->
            <div class="card-sb flex flex-col justify-between p-6 bg-white border border-[#E5E5E5]">
              <div class="flex items-center justify-between pb-3 border-b border-[#E5E5E5]">
                <span class="text-caption font-mono uppercase text-[#737373] font-medium tracking-wider">PERANGKAT PRINTER</span>
                <span id="printer-chip" class="chip-sb text-xs border border-[#FFD166]/40 text-[#0A0A0A] bg-[#FFD166]/10">MEMINDAI...</span>
              </div>
              <div class="mt-4">
                <label for="select-printer-device" class="block text-caption font-mono uppercase text-[#0A0A0A] mb-2 font-medium">
                  PILIH PRINTER TUJUAN:
                </label>
                <select id="select-printer-device" class="input-sb w-full text-xs font-mono bg-white cursor-pointer">
                  <option value="">MEMINDAI DAFTAR PRINTER...</option>
                </select>
                <p id="printer-hint" class="font-mono text-[11px] text-[#737373] mt-2">
                  Mendeteksi printer sistem untuk cetak senyap otomatis...
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Modal PIN Konfirmasi Manual StudioBlank (F-04) -->
        <div id="pin-modal-overlay" class="hidden fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div class="card-sb border border-[#E5E5E5] bg-white max-w-md w-full p-6 space-y-4">
            <div class="border-b border-[#E5E5E5] pb-3 flex items-center justify-between">
              <span class="chip-sb text-xs font-mono text-[#737373] border border-[#E5E5E5]">OTORISASI STAFF</span>
              <span class="text-body font-semibold uppercase text-[#0A0A0A]">MASUKKAN PIN</span>
            </div>

            <p class="text-body-sm text-[#737373]">
              Konfirmasi pembayaran manual untuk sesi: <span id="pin-modal-session-id" class="font-mono font-medium text-[#0A0A0A]"></span>
            </p>

            <form id="pin-confirm-form" class="space-y-4">
              <div>
                <label class="block text-caption font-mono uppercase text-[#737373] mb-1">PIN OPERATOR (DEFAULT: 1234)</label>
                <input
                  type="password"
                  id="input-pin-confirm"
                  class="input-sb text-center text-2xl font-mono tracking-[0.5em] py-2.5 w-full"
                  maxlength="8"
                  placeholder="••••"
                  autocomplete="off"
                />
                <p id="pin-modal-error" class="hidden text-caption font-mono text-[#E5484D] mt-2">
                  PIN SALAH! SILAKAN COBA LAGI.
                </p>
              </div>

              <div class="flex items-center justify-end gap-3 pt-2">
                <button type="button" id="btn-cancel-pin-modal" class="btn-sb-secondary px-5 py-2 text-xs font-mono uppercase tracking-wider">
                  BATAL
                </button>
                <button type="submit" id="btn-submit-pin-modal" class="btn-sb-primary px-5 py-2 text-xs font-mono uppercase tracking-wider">
                  KONFIRMASI BAYAR
                </button>
              </div>
            </form>
          </div>
        </div>
      `;

      parent.appendChild(container);
      setupEventListeners(container);
      loadTodayStats();
      checkWaitingPayment();
      updateCameraDevices();
      updatePrinterDevices();
    },
    refresh() {
      checkWaitingPayment();
      loadTodayStats();
    },
    unmount() {
      if (handleDeviceChange && typeof navigator !== 'undefined' && navigator.mediaDevices?.removeEventListener) {
        navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      }
      container?.remove();
      container = null;
    }
  };
}

