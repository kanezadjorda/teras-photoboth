import { api } from '../shared/api.js';
import { createTemplateEditor } from './screens/template-editor.js';

const appRoot = document.getElementById('app');
let currentScreen = null;

function renderScreen(screen) {
  if (currentScreen && currentScreen.unmount) {
    currentScreen.unmount();
  }
  currentScreen = screen;
  appRoot.innerHTML = '';
  currentScreen.mount(appRoot);
}

async function renderAdminDashboard() {
  if (currentScreen && currentScreen.unmount) {
    currentScreen.unmount();
    currentScreen = null;
  }

  appRoot.innerHTML = `
    <header class="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b-[5px] border-black gap-4">
      <div>
        <h1 class="text-3xl md:text-4xl font-headline uppercase tracking-tight text-black">
          Panel Operator Photobooth
        </h1>
        <p class="font-body text-sm text-black mt-1">
          PEMANTAUAN PERANGKAT &bull; PENGATURAN SESI &bull; KONTROL SISTEM
        </p>
      </div>
      <div class="flex items-center gap-3">
        <button id="btn-nav-templates" class="btn-raw-primary px-5 py-2.5 text-xs font-headline">
          KELOLA TEMPLATE
        </button>
        <span id="system-status-pill" class="chip-raw chip-raw-active">
          SISTEM SIAP
        </span>
      </div>
    </header>

    <!-- Status Perangkat -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 my-6">
      <div class="card-raw flex flex-col justify-between">
        <span class="label-raw text-xs text-black">KAMERA EKSTERNAL</span>
        <div class="mt-4 flex items-center justify-between">
          <span id="cam-status" class="font-mono text-base font-bold text-black">MENGECEK...</span>
          <span class="chip-raw chip-raw-warning">STANDBY</span>
        </div>
      </div>

      <div class="card-raw flex flex-col justify-between">
        <span class="label-raw text-xs text-black">PRINTER DEFAULT</span>
        <div class="mt-4 flex items-center justify-between">
          <span id="printer-status" class="font-mono text-base font-bold text-black">DEFAULT 4R</span>
          <span class="chip-raw chip-raw-active">TERHUBUNG</span>
        </div>
      </div>

      <div class="card-raw flex flex-col justify-between">
        <span class="label-raw text-xs text-black">KONEKSI INTERNET</span>
        <div class="mt-4 flex items-center justify-between">
          <span id="net-status" class="font-mono text-base font-bold text-black">ONLINE</span>
          <span class="chip-raw chip-raw-active">AKTIF</span>
        </div>
      </div>

      <div class="card-raw flex flex-col justify-between">
        <span class="label-raw text-xs text-black">SINKRON GOOGLE DRIVE</span>
        <div class="mt-4 flex items-center justify-between">
          <span id="drive-status" class="font-mono text-base font-bold text-black">MIRROR AKTIF</span>
          <span class="chip-raw chip-raw-active">LOKAL</span>
        </div>
      </div>
    </div>

    <!-- Quick Status Template Aktif -->
    <section class="card-raw mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-raw-sunken">
      <div>
        <h3 class="font-headline text-base uppercase text-black">STATUS TEMPLATE CETAKAN</h3>
        <p id="template-count-summary" class="font-mono text-xs text-black/70 mt-1">Memuat data template...</p>
      </div>
      <button id="btn-quick-manage-templates" class="btn-raw-secondary px-6 py-2.5 text-xs font-headline">
        BUKA EDITOR TEMPLATE
      </button>
    </section>

    <!-- Sesi Menunggu Pembayaran & Konfirmasi Manual (F-04) -->
    <section id="waiting-payment-section" class="card-raw border-[5px] border-black my-6 bg-white">
      <div class="flex items-center justify-between pb-3 border-b-[3px] border-black">
        <div class="flex items-center gap-2">
          <span class="chip-raw bg-black text-white text-xs">F-04</span>
          <h2 class="text-lg font-headline uppercase tracking-tight text-black">
            SESI MENUNGGU PEMBAYARAN (QRIS)
          </h2>
        </div>
        <span id="payment-widget-badge" class="chip-raw chip-raw-warning">STANDBY</span>
      </div>

      <div id="payment-widget-content" class="py-4">
        <p class="font-mono text-xs text-black/60">Mengecek sesi aktif di kiosk...</p>
      </div>
    </section>

    <!-- Pengaturan Sesi -->
    <section class="card-raw-elevated my-6">
      <h2 class="text-xl font-headline uppercase tracking-tight text-black pb-2 mb-6 border-b-[3px] border-black">
        PENGATURAN SESI
      </h2>
      <div id="settings-form" class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label class="label-raw">HARGA PER SESI (RUPIAH)</label>
          <input type="number" id="setting-price" class="input-raw" />
          <p class="font-body text-xs text-black/70 mt-1">Nominal yang akan digenerate ke QRIS dinamis Midtrans</p>
        </div>
        <div>
          <label class="label-raw">JUMLAH CETAK PER SESI</label>
          <input type="number" id="setting-copies" min="1" max="10" class="input-raw" />
          <p class="font-body text-xs text-black/70 mt-1">Jumlah lembar 4R yang dicetak otomatis per sesi</p>
        </div>
        <div class="md:col-span-2 flex justify-end pt-2">
          <button id="btn-save-settings" class="btn-raw-primary px-8 py-3 text-sm">
            SIMPAN PENGATURAN
          </button>
        </div>
      </div>
    </section>

    <!-- Tombol Darurat -->
    <section class="card-raw my-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h3 class="text-lg font-headline uppercase text-black">TOMBOL DARURAT (RESET SESI)</h3>
        <p class="font-body text-xs text-black mt-1">
          Gunakan jika customer mengalami kendala dan ingin membatalkan sesi kembali ke layar Welcome.
        </p>
      </div>
      <button id="btn-emergency-reset" class="btn-raw-destructive px-8 py-3 text-sm whitespace-nowrap">
        RESET KE WELCOME
      </button>
    </section>

    <!-- Modal PIN Konfirmasi Manual RawBlock (F-04) -->
    <div id="pin-modal-overlay" class="hidden fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div class="card-raw border-[5px] border-black bg-white max-w-md w-full p-6 space-y-4">
        <div class="border-b-[3px] border-black pb-3 flex items-center justify-between">
          <span class="chip-raw bg-black text-white text-xs">OTORISASI STAFF</span>
          <span class="font-headline text-lg uppercase">MASUKKAN PIN</span>
        </div>

        <p class="font-body text-xs text-black/80">
          Konfirmasi pembayaran manual untuk sesi: <span id="pin-modal-session-id" class="font-mono font-bold text-black"></span>
        </p>

        <form id="pin-confirm-form" class="space-y-4">
          <div>
            <label class="label-raw">PIN OPERATOR (DEFAULT: 1234)</label>
            <input
              type="password"
              id="input-pin-confirm"
              class="input-raw text-center text-3xl font-mono tracking-[0.5em] py-3 w-full"
              maxlength="8"
              placeholder="••••"
              autocomplete="off"
            />
            <p id="pin-modal-error" class="hidden font-headline text-xs text-raw-error mt-2">
              PIN SALAH! SILAKAN COBA LAGI.
            </p>
          </div>

          <div class="flex items-center justify-end gap-3 pt-2">
            <button type="button" id="btn-cancel-pin-modal" class="btn-raw-secondary px-6 py-3 text-xs font-headline">
              BATAL
            </button>
            <button type="submit" id="btn-submit-pin-modal" class="btn-raw-primary px-6 py-3 text-xs font-headline">
              KONFIRMASI BAYAR
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Template editor navigation
  const openTemplateEditor = () => {
    const editor = createTemplateEditor({
      onBack: renderAdminDashboard
    });
    renderScreen(editor);
  };

  document.getElementById('btn-nav-templates')?.addEventListener('click', openTemplateEditor);
  document.getElementById('btn-quick-manage-templates')?.addEventListener('click', openTemplateEditor);

  // Load template summary
  try {
    const tplRes = await api.getTemplates(true);
    const countSummary = document.getElementById('template-count-summary');
    if (countSummary && tplRes.success) {
      const activeCount = (tplRes.data || []).filter((t) => t.aktif).length;
      const totalCount = (tplRes.data || []).length;
      countSummary.textContent = `${activeCount} TEMPLATE AKTIF DARI TOTAL ${totalCount} TEMPLATE TERSIMPAN.`;
    }
  } catch (err) {
    console.error('Gagal memuat ringkasan template:', err);
  }

  // Load existing settings
  try {
    const res = await api.getSettings();
    if (res.success && res.data) {
      const priceInput = document.getElementById('setting-price');
      const copiesInput = document.getElementById('setting-copies');
      if (priceInput) priceInput.value = res.data.session_price || 25000;
      if (copiesInput) copiesInput.value = res.data.copies_per_session || 1;
    }
  } catch (err) {
    console.error('Gagal memuat pengaturan:', err);
  }

  // Save settings event
  const saveBtn = document.getElementById('btn-save-settings');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const price = Number(document.getElementById('setting-price')?.value) || 25000;
      const copies = Number(document.getElementById('setting-copies')?.value) || 1;
      try {
        await api.updateSettings({
          session_price: price,
          copies_per_session: copies
        });
        alert('Pengaturan berhasil disimpan');
      } catch (err) {
        alert('Gagal menyimpan: ' + err.message);
      }
    });
  }

  // Waiting Payment Widget Logic (F-04)
  const widgetContent = document.getElementById('payment-widget-content');
  const widgetBadge = document.getElementById('payment-widget-badge');

  // Modal elements
  const pinModalOverlay = document.getElementById('pin-modal-overlay');
  const pinModalSessionId = document.getElementById('pin-modal-session-id');
  const inputPinConfirm = document.getElementById('input-pin-confirm');
  const pinModalError = document.getElementById('pin-modal-error');
  const btnCancelPin = document.getElementById('btn-cancel-pin-modal');
  const pinForm = document.getElementById('pin-confirm-form');

  let activeConfirmSessionId = null;

  function openPinModal(sessionId) {
    activeConfirmSessionId = sessionId;
    if (pinModalSessionId) pinModalSessionId.textContent = sessionId;
    if (inputPinConfirm) inputPinConfirm.value = '';
    if (pinModalError) pinModalError.classList.add('hidden');
    if (pinModalOverlay) pinModalOverlay.classList.remove('hidden');
    setTimeout(() => inputPinConfirm?.focus(), 100);
  }

  function closePinModal() {
    activeConfirmSessionId = null;
    if (pinModalOverlay) pinModalOverlay.classList.add('hidden');
  }

  btnCancelPin?.addEventListener('click', closePinModal);

  // Close modal when clicking outside
  pinModalOverlay?.addEventListener('click', (e) => {
    if (e.target === pinModalOverlay) {
      closePinModal();
    }
  });

  pinForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!activeConfirmSessionId) return;

    const enteredPin = inputPinConfirm?.value || '';
    try {
      const settings = await api.getSettings();
      const validPin = settings.data?.admin_pin || '1234';

      if (enteredPin.trim() !== String(validPin).trim()) {
        if (pinModalError) {
          pinModalError.textContent = 'PIN SALAH! SILAKAN COBA LAGI.';
          pinModalError.classList.remove('hidden');
        }
        inputPinConfirm?.focus();
        return;
      }

      // PIN is valid!
      const targetSessionId = activeConfirmSessionId;
      closePinModal();

      await api.confirmPaymentManual(targetSessionId);
      alert(`Pembayaran untuk sesi ${targetSessionId} berhasil dikonfirmasi secara manual! Kiosk langsung melanjutkan.`);
      checkWaitingPayment();
    } catch (err) {
      if (pinModalError) {
        pinModalError.textContent = 'GAGAL: ' + err.message;
        pinModalError.classList.remove('hidden');
      }
    }
  });

  // Event delegation on widgetContent so click ALWAYS triggers openPinModal
  widgetContent?.addEventListener('click', (e) => {
    const btn = e.target.closest('#btn-manual-confirm');
    if (btn) {
      const sId = btn.getAttribute('data-session-id');
      if (sId) {
        openPinModal(sId);
      }
    }
  });

  async function checkWaitingPayment() {
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

        widgetBadge.className = 'chip-raw bg-black text-white animate-pulse';
        widgetBadge.textContent = 'MENUNGGU PEMBAYARAN';

        widgetContent.innerHTML = `
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border-[3px] border-black bg-raw-sunken">
            <div>
              <p class="font-headline text-base text-black uppercase">
                SESI AKTIF: ${session.id}
              </p>
              <p class="font-mono text-xs text-black/80 mt-1">
                NOMINAL: <span class="font-bold">RP ${nominal}</span> &bull; STATUS: <span class="uppercase">WAITING PAYMENT</span>
              </p>
              <p class="font-body text-xs text-black/60 mt-1">
                Gunakan konfirmasi manual jika customer telah membayar tetapi gateway terganggu.
              </p>
            </div>
            <button
              id="btn-manual-confirm"
              type="button"
              data-session-id="${session.id}"
              class="btn-raw-primary px-6 py-3 text-xs font-headline whitespace-nowrap cursor-pointer hover:bg-black hover:text-white"
            >
              KONFIRMASI BAYAR MANUAL
            </button>
          </div>
        `;
      } else {
        widgetBadge.className = 'chip-raw chip-raw-active';
        widgetBadge.textContent = 'STANDBY';
        widgetContent.innerHTML = `
          <div class="p-3 border border-black/30 bg-white">
            <p class="font-mono text-xs text-black/60">Tidak ada sesi aktif yang sedang menunggu pembayaran.</p>
          </div>
        `;
      }
    } catch (err) {
      console.warn('Gagal mengecek status pembayaran aktif:', err.message);
    }
  }

  checkWaitingPayment();

  // Polling fallback every 2.5s to ensure admin UI is always up to date
  setInterval(checkWaitingPayment, 2500);

  // Listen to SSE events for real-time dashboard updates
  try {
    const sse = new EventSource('http://localhost:3000/api/events');
    sse.addEventListener('session_created', checkWaitingPayment);
    sse.addEventListener('session_updated', checkWaitingPayment);
    sse.addEventListener('payment_paid', checkWaitingPayment);
    sse.addEventListener('payment_expired', checkWaitingPayment);
  } catch (e) {
    console.warn('SSE admin error:', e);
  }

  // Emergency reset event
  const resetBtn = document.getElementById('btn-emergency-reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      if (confirm('Yakin ingin mereset sesi aktif dan kembali ke layar awal?')) {
        try {
          const current = await api.getCurrentSession();
          if (current.data && current.data.id) {
            await api.updateSessionStatus(current.data.id, 'cancelled');
          }
          alert('Sesi berhasil direset');
          checkWaitingPayment();
        } catch (err) {
          alert('Gagal mereset: ' + err.message);
        }
      }
    });
  }
}

renderAdminDashboard();
