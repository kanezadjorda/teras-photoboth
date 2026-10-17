import { api } from '../shared/api.js';
import { createTemplateEditor } from './screens/template-editor.js';
import { createPinModal } from './screens/pin-modal.js';
import { preventDoubleClick, setupOfflineMonitor } from '../shared/ui.js';

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

function checkAuthAndRender() {
  const isAuth = sessionStorage.getItem('admin_auth') === 'true';
  if (!isAuth) {
    const pinModal = createPinModal({
      onAuthenticated: () => {
        renderAdminDashboard();
      }
    });
    renderScreen(pinModal);
  } else {
    renderAdminDashboard();
  }
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
        <button id="btn-lock-panel" class="btn-raw-secondary px-4 py-2.5 text-xs font-headline">
          KUNCI PANEL
        </button>
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

    <!-- Kelola Event & Sesi Operasional (PRD F-17, F-18) -->
    <section class="card-raw-elevated my-6 bg-white">
      <div class="flex flex-col md:flex-row md:items-center justify-between pb-3 mb-4 border-b-[3px] border-black gap-3">
        <div>
          <div class="flex items-center gap-2">
            <span class="chip-raw bg-black text-white text-xs">EVENT</span>
            <h2 class="text-xl font-headline uppercase tracking-tight text-black">
              KELOLA EVENT / SESI OPERASIONAL
            </h2>
          </div>
          <p class="font-body text-xs text-black/70 mt-1">
            Kelola folder penyimpanan foto lokal yang disinkronkan ke Google Drive per kegiatan
          </p>
        </div>
        <div class="flex items-center gap-2">
          <button id="btn-create-event-modal" class="btn-raw-primary px-5 py-2.5 text-xs font-headline">
            + BUAT EVENT BARU
          </button>
        </div>
      </div>

      <!-- Banner Event Aktif -->
      <div class="p-4 border-[3px] border-black bg-raw-sunken mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span class="label-raw text-xs text-black">EVENT OPERASIONAL AKTIF SAAT INI</span>
          <h3 id="active-event-name" class="font-headline text-xl text-black uppercase mt-1">
            MEMUAT EVENT...
          </h3>
          <p id="active-event-path" class="font-mono text-xs text-black/80 mt-1 break-all">
            Folder: -
          </p>
        </div>
        <span class="chip-raw chip-raw-active self-start md:self-auto px-3 py-1 font-headline text-xs">
          SESI KIOSK TERSAMBUNG KE EVENT INI
        </span>
      </div>

      <!-- Tabel Daftar Event -->
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse border-[3px] border-black text-sm">
          <thead>
            <tr class="bg-black text-white font-headline text-xs uppercase">
              <th class="p-3 border-r-[2px] border-white/20">NAMA EVENT</th>
              <th class="p-3 border-r-[2px] border-white/20">FOLDER DRIVE / LOKAL</th>
              <th class="p-3 border-r-[2px] border-white/20">TOTAL SESI</th>
              <th class="p-3 border-r-[2px] border-white/20">STATUS</th>
              <th class="p-3 text-center">AKSI</th>
            </tr>
          </thead>
          <tbody id="events-table-body" class="font-mono text-xs divide-y-[2px] divide-black">
            <tr>
              <td colspan="5" class="p-4 text-center text-black/60 font-body">Memuat daftar event...</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Ringkasan Penjualan & Omset (F-15) -->
    <section class="card-raw-elevated my-6">
      <div class="flex flex-col md:flex-row md:items-center justify-between pb-3 mb-4 border-b-[3px] border-black gap-3">
        <div>
          <div class="flex items-center gap-2">
            <span class="chip-raw bg-black text-white text-xs">F-15</span>
            <h2 class="text-xl font-headline uppercase tracking-tight text-black">
              RINGKASAN PENJUALAN & OMSET
            </h2>
          </div>
          <p class="font-body text-xs text-black/70 mt-1">
            Statistik performa penjualan harian dan akumulasi keseluruhan transaksi
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <div class="flex items-center gap-2">
            <span class="label-raw text-xs text-black mb-0">FILTER:</span>
            <select id="select-report-event" class="input-raw py-1.5 px-3 text-xs font-mono">
              <option value="">SEMUA EVENT (AKUMULASI)</option>
            </select>
          </div>
          <button id="btn-export-csv" class="btn-raw-primary px-6 py-2.5 text-xs font-headline flex items-center justify-center gap-2">
            <span>EKSPOR CSV</span>
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div class="p-4 border-[3px] border-black bg-raw-sunken">
          <span class="label-raw text-xs text-black">TOTAL SESI HARI INI</span>
          <div class="mt-2 flex items-baseline justify-between">
            <span id="report-today-sessions" class="font-headline text-2xl text-black">0 SESI</span>
            <span id="report-today-paid" class="font-mono text-xs text-black/70">0 LUNAS</span>
          </div>
        </div>

        <div class="p-4 border-[3px] border-black bg-white">
          <span class="label-raw text-xs text-black">OMSET HARI INI</span>
          <div class="mt-2">
            <span id="report-today-revenue" class="font-headline text-2xl text-black">RP 0</span>
          </div>
        </div>

        <div class="p-4 border-[3px] border-black bg-raw-sunken">
          <span class="label-raw text-xs text-black">TOTAL SESI (AKUMULASI)</span>
          <div class="mt-2 flex items-baseline justify-between">
            <span id="report-alltime-sessions" class="font-headline text-2xl text-black">0 SESI</span>
            <span id="report-alltime-paid" class="font-mono text-xs text-black/70">0 LUNAS</span>
          </div>
        </div>

        <div class="p-4 border-[3px] border-black bg-white">
          <span class="label-raw text-xs text-black">TOTAL OMSET (AKUMULASI)</span>
          <div class="mt-2">
            <span id="report-alltime-revenue" class="font-headline text-2xl text-black">RP 0</span>
          </div>
        </div>
      </div>
    </section>

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

    <!-- Riwayat Transaksi & Cetak Ulang (F-13) -->
    <section class="card-raw my-6 border-[5px] border-black bg-white">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-4 border-b-[3px] border-black gap-2">
        <div>
          <div class="flex items-center gap-2">
            <span class="chip-raw bg-black text-white text-xs">F-13</span>
            <h2 class="text-xl font-headline uppercase tracking-tight text-black">
              RIWAYAT TRANSAKSI & CETAK ULANG
            </h2>
          </div>
          <p class="font-body text-xs text-black/70 mt-1">
            Daftar sesi photobooth dan fungsi reprint foto jika printer mengalami kendala teknis
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-3 self-start sm:self-auto">
          <div class="flex items-center gap-2">
            <span class="label-raw text-xs text-black mb-0">FILTER:</span>
            <select id="select-history-event" class="input-raw py-1.5 px-3 text-xs font-mono">
              <option value="">SEMUA EVENT</option>
            </select>
          </div>
          <button id="btn-refresh-history" class="btn-raw-secondary px-4 py-2 text-xs font-headline">
            REFRESH DAFTAR
          </button>
        </div>
      </div>

      <!-- History Table -->
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse border-[3px] border-black text-sm">
          <thead>
            <tr class="bg-black text-white font-headline text-xs uppercase">
              <th class="p-3 border-r-[2px] border-white/20">NO SESI</th>
              <th class="p-3 border-r-[2px] border-white/20">EVENT</th>
              <th class="p-3 border-r-[2px] border-white/20">WAKTU (WIB)</th>
              <th class="p-3 border-r-[2px] border-white/20">TEMPLATE</th>
              <th class="p-3 border-r-[2px] border-white/20">NOMINAL</th>
              <th class="p-3 border-r-[2px] border-white/20">STATUS SESI</th>
              <th class="p-3 border-r-[2px] border-white/20">PEMBAYARAN</th>
              <th class="p-3 text-center">AKSI REPRINT</th>
            </tr>
          </thead>
          <tbody id="history-table-body" class="font-mono text-xs divide-y-[2px] divide-black">
            <tr>
              <td colspan="8" class="p-4 text-center text-black/60 font-body">
                Memuat data riwayat transaksi...
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Pengaturan Sesi -->
    <section class="card-raw-elevated my-6">
      <h2 class="text-xl font-headline uppercase tracking-tight text-black pb-2 mb-6 border-b-[3px] border-black">
        PENGATURAN SESI & KEAMANAN
      </h2>
      <div id="settings-form" class="grid grid-cols-1 md:grid-cols-3 gap-6">
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
        <div>
          <label class="label-raw">PIN OPERATOR (4 DIGIT)</label>
          <input type="password" id="setting-pin" maxlength="4" class="input-raw font-mono tracking-widest text-center" placeholder="1234" />
          <p class="font-body text-xs text-black/70 mt-1">PIN untuk membuka panel & konfirmasi manual (F-14)</p>
        </div>
        <div class="md:col-span-3 flex justify-end pt-2">
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

    <!-- Modal Buat Event Baru RawBlock -->
    <div id="event-modal-overlay" class="hidden fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div class="card-raw border-[5px] border-black bg-white max-w-lg w-full p-6 space-y-4">
        <div class="border-b-[3px] border-black pb-3 flex items-center justify-between">
          <span class="chip-raw bg-black text-white text-xs">SESI OPERASIONAL</span>
          <span class="font-headline text-lg uppercase">BUAT EVENT BARU</span>
        </div>

        <form id="create-event-form" class="space-y-4">
          <div>
            <label class="label-raw">NAMA EVENT / KEGIATAN</label>
            <input
              type="text"
              id="input-event-name"
              class="input-raw font-mono text-sm w-full"
              placeholder="Contoh: Wedding Sheila & Rian"
              required
            />
            <p class="font-body text-xs text-black/70 mt-1">Nama sesi kegiatan untuk identifikasi laporan dan transaksi.</p>
          </div>

          <div>
            <label class="label-raw">FOLDER OUTPUT / GOOGLE DRIVE SYNC</label>
            <div class="flex gap-2">
              <input
                type="text"
                id="input-event-folder"
                class="input-raw font-mono text-xs w-full"
                placeholder="./data/photos/2026-10-sheila-rian"
                required
              />
              <button
                type="button"
                id="btn-browse-event-folder"
                class="btn-raw-secondary px-3 py-2 text-xs font-headline whitespace-nowrap"
              >
                PILIH FOLDER
              </button>
            </div>
            <p class="font-body text-xs text-black/70 mt-1">
              Pilih folder lokal yang disinkronkan oleh aplikasi Google Drive for Desktop di komputer ini.
            </p>
          </div>

          <div class="flex items-center gap-2 pt-1">
            <input type="checkbox" id="check-event-activate" class="w-4 h-4 accent-black" checked />
            <label for="check-event-activate" class="font-headline text-xs text-black cursor-pointer">
              JADIKAN EVENT AKTIF SEGERA UNTUK KIOSK
            </label>
          </div>

          <div class="flex items-center justify-end gap-3 pt-3 border-t-[2px] border-black">
            <button type="button" id="btn-cancel-event-modal" class="btn-raw-secondary px-6 py-2.5 text-xs font-headline">
              BATAL
            </button>
            <button type="submit" id="btn-submit-event" class="btn-raw-primary px-6 py-2.5 text-xs font-headline">
              SIMPAN & BUAT EVENT
            </button>
          </div>
        </form>
      </div>
    </div>

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

  // Lock panel button
  document.getElementById('btn-lock-panel')?.addEventListener('click', () => {
    sessionStorage.removeItem('admin_auth');
    checkAuthAndRender();
  });

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
      const pinInput = document.getElementById('setting-pin');
      if (priceInput) priceInput.value = res.data.session_price || 25000;
      if (copiesInput) copiesInput.value = res.data.copies_per_session || 1;
      if (pinInput) pinInput.value = res.data.admin_pin || '1234';
    }
  } catch (err) {
    console.error('Gagal memuat pengaturan:', err);
  }

  // Monitor status koneksi internet di panel admin
  const netStatus = document.getElementById('net-status');
  const netCard = netStatus?.closest('.card-raw');
  const netChip = netCard?.querySelector('.chip-raw');

  function updateNetworkIndicator() {
    if (!netStatus) return;
    if (navigator.onLine) {
      netStatus.textContent = 'ONLINE';
      if (netChip) {
        netChip.textContent = 'AKTIF';
        netChip.className = 'chip-raw chip-raw-active';
      }
    } else {
      netStatus.textContent = 'TERPUTUS';
      if (netChip) {
        netChip.textContent = 'OFFLINE';
        netChip.className = 'chip-raw chip-raw-destructive';
      }
    }
  }

  window.addEventListener('online', updateNetworkIndicator);
  window.addEventListener('offline', updateNetworkIndicator);
  updateNetworkIndicator();

  // Save settings event with double-click guard
  const saveBtn = document.getElementById('btn-save-settings');
  if (saveBtn) {
    saveBtn.addEventListener(
      'click',
      preventDoubleClick(
        saveBtn,
        async () => {
          const price = Number(document.getElementById('setting-price')?.value) || 25000;
          const copies = Number(document.getElementById('setting-copies')?.value) || 1;
          const pin = document.getElementById('setting-pin')?.value?.trim() || '1234';
          await api.updateSettings({
            session_price: price,
            copies_per_session: copies,
            admin_pin: pin
          });
          alert('Pengaturan berhasil disimpan');
        },
        'MENYIMPAN...'
      )
    );
  }

  // ==========================================
  // Kelola Event / Sesi Operasional (PRD F-17, F-18)
  // ==========================================
  const eventModalOverlay = document.getElementById('event-modal-overlay');
  const btnCreateEventModal = document.getElementById('btn-create-event-modal');
  const btnCancelEventModal = document.getElementById('btn-cancel-event-modal');
  const createEventForm = document.getElementById('create-event-form');
  const btnBrowseFolder = document.getElementById('btn-browse-event-folder');
  const selectReportEvent = document.getElementById('select-report-event');
  const selectHistoryEvent = document.getElementById('select-history-event');

  // Open & Close Event Modal
  btnCreateEventModal?.addEventListener('click', () => {
    const nameInput = document.getElementById('input-event-name');
    const folderInput = document.getElementById('input-event-folder');
    const checkActivate = document.getElementById('check-event-activate');
    if (nameInput) nameInput.value = '';
    if (folderInput) folderInput.value = './data/photos/' + new Date().toISOString().slice(0, 10);
    if (checkActivate) checkActivate.checked = true;
    eventModalOverlay?.classList.remove('hidden');
    nameInput?.focus();
  });

  btnCancelEventModal?.addEventListener('click', () => {
    eventModalOverlay?.classList.add('hidden');
  });

  eventModalOverlay?.addEventListener('click', (e) => {
    if (e.target === eventModalOverlay) {
      eventModalOverlay.classList.add('hidden');
    }
  });

  // Browse local folder for Google Drive sync
  btnBrowseFolder?.addEventListener('click', async () => {
    const folderInput = document.getElementById('input-event-folder');
    if (window.photobooth?.selectFolder) {
      try {
        const selected = await window.photobooth.selectFolder(folderInput?.value || '');
        if (selected) {
          folderInput.value = selected;
        }
      } catch (err) {
        console.warn('Gagal memilih folder:', err);
      }
    } else {
      alert('Fitur pemilihan folder otomatis aktif di aplikasi desktop Electron. Anda dapat mengetikkan lokasi folder secara manual.');
    }
  });

  // Submit Create Event
  createEventForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nameInput = document.getElementById('input-event-name');
    const folderInput = document.getElementById('input-event-folder');
    const checkActivate = document.getElementById('check-event-activate');
    const submitBtn = document.getElementById('btn-submit-event');

    const nama = nameInput?.value?.trim();
    const folder_path = folderInput?.value?.trim();
    const set_active = Boolean(checkActivate?.checked);

    if (!nama || !folder_path) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'MENYIMPAN...';

    try {
      const res = await api.createEvent({ nama, folder_path, set_active });
      if (!res.success) {
        throw new Error(res.error || 'Gagal membuat event');
      }
      eventModalOverlay?.classList.add('hidden');
      await loadEvents();
      await loadDailyReport(selectReportEvent?.value);
      await loadHistory(selectHistoryEvent?.value);
      alert(`Event "${nama}" berhasil dibuat!`);
    } catch (err) {
      alert('Gagal membuat event: ' + err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'SIMPAN & BUAT EVENT';
    }
  });

  // Load Events List & Update Dropdowns
  async function loadEvents() {
    const tableBody = document.getElementById('events-table-body');
    const activeNameEl = document.getElementById('active-event-name');
    const activePathEl = document.getElementById('active-event-path');

    try {
      const res = await api.getEvents();
      if (!res.success || !res.data) {
        if (tableBody) {
          tableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-raw-error font-body">Gagal memuat daftar event</td></tr>`;
        }
        return;
      }

      const events = res.data;
      const activeEvent = events.find((e) => e.aktif === 1) || events[0];

      if (activeNameEl && activeEvent) {
        activeNameEl.textContent = activeEvent.nama;
      }
      if (activePathEl && activeEvent) {
        activePathEl.textContent = `Folder Sinkronisasi Drive: ${activeEvent.folder_path}`;
      }

      // Update dropdowns options while preserving selection
      const currentReportVal = selectReportEvent?.value || '';
      const currentHistoryVal = selectHistoryEvent?.value || '';

      const reportOptions = [
        '<option value="">SEMUA EVENT (AKUMULASI)</option>',
        ...events.map(
          (e) => `<option value="${e.id}" ${e.id === currentReportVal ? 'selected' : ''}>${e.nama}${e.aktif ? ' [AKTIF]' : ''}</option>`
        )
      ];
      if (selectReportEvent) selectReportEvent.innerHTML = reportOptions.join('');

      const historyOptions = [
        '<option value="">SEMUA EVENT</option>',
        ...events.map(
          (e) => `<option value="${e.id}" ${e.id === currentHistoryVal ? 'selected' : ''}>${e.nama}${e.aktif ? ' [AKTIF]' : ''}</option>`
        )
      ];
      if (selectHistoryEvent) selectHistoryEvent.innerHTML = historyOptions.join('');

      // Render Events Table
      if (tableBody) {
        if (events.length === 0) {
          tableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-black/60 font-body">Belum ada event terdaftar</td></tr>`;
          return;
        }

        tableBody.innerHTML = events
          .map((e) => {
            const isActive = e.aktif === 1;
            const statusChip = isActive
              ? '<span class="chip-raw chip-raw-active font-bold">AKTIF SAAT INI</span>'
              : '<span class="chip-raw text-black/50">NONAKTIF</span>';

            const actionBtn = isActive
              ? '<span class="chip-raw bg-black/10 text-black/40 text-[10px]">DIGUNAKAN KIOSK</span>'
              : `<button type="button" class="btn-raw-secondary text-xs px-3 py-1 font-headline btn-activate-event" data-event-id="${e.id}" data-event-name="${e.nama}">
                  JADIKAN AKTIF
                </button>`;

            return `
              <tr class="hover:bg-raw-sunken transition-colors">
                <td class="p-3 border-r-[2px] border-black font-bold text-black font-headline uppercase">${e.nama}</td>
                <td class="p-3 border-r-[2px] border-black text-black/80 font-mono text-[11px] break-all">${e.folder_path}</td>
                <td class="p-3 border-r-[2px] border-black text-black font-bold font-mono">${e.total_sessions || 0} SESI</td>
                <td class="p-3 border-r-[2px] border-black">${statusChip}</td>
                <td class="p-3 text-center">${actionBtn}</td>
              </tr>
            `;
          })
          .join('');
      }
    } catch (err) {
      console.warn('Gagal memuat events:', err.message);
    }
  }

  // Handle Event Activation
  document.getElementById('events-table-body')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('.btn-activate-event');
    if (btn) {
      const eventId = btn.getAttribute('data-event-id');
      const eventName = btn.getAttribute('data-event-name');
      if (eventId && confirm(`Jadikan event "${eventName}" sebagai event operasional aktif? Sesi kiosk berikutnya akan menyimpan foto ke folder event ini.`)) {
        btn.disabled = true;
        btn.textContent = 'MENGAKTIFKAN...';
        try {
          const res = await api.activateEvent(eventId);
          if (!res.success) {
            throw new Error(res.error || 'Gagal mengaktifkan event');
          }
          await loadEvents();
          await loadDailyReport(selectReportEvent?.value);
          await loadHistory(selectHistoryEvent?.value);
          alert(`Event "${eventName}" sekarang aktif!`);
        } catch (err) {
          alert('Gagal mengaktifkan event: ' + err.message);
        }
      }
    }
  });

  // Filter change events
  selectReportEvent?.addEventListener('change', () => {
    loadDailyReport(selectReportEvent.value);
  });

  selectHistoryEvent?.addEventListener('change', () => {
    loadHistory(selectHistoryEvent.value);
  });

  // Load Daily Report (F-15) with Event Filter Support
  async function loadDailyReport(eventId = '') {
    try {
      const targetEventId = eventId || selectReportEvent?.value || '';
      const res = await api.getDailyReport(targetEventId);
      if (!res.success || !res.data) return;
      const { today, all_time } = res.data;

      const todaySessionsEl = document.getElementById('report-today-sessions');
      const todayPaidEl = document.getElementById('report-today-paid');
      const todayRevenueEl = document.getElementById('report-today-revenue');

      const alltimeSessionsEl = document.getElementById('report-alltime-sessions');
      const alltimePaidEl = document.getElementById('report-alltime-paid');
      const alltimeRevenueEl = document.getElementById('report-alltime-revenue');

      if (todaySessionsEl) todaySessionsEl.textContent = `${today.total_sessions} SESI`;
      if (todayPaidEl) todayPaidEl.textContent = `${today.paid_sessions} LUNAS`;
      if (todayRevenueEl) todayRevenueEl.textContent = `RP ${Number(today.revenue || 0).toLocaleString('id-ID')}`;

      if (alltimeSessionsEl) alltimeSessionsEl.textContent = `${all_time.total_sessions} SESI`;
      if (alltimePaidEl) alltimePaidEl.textContent = `${all_time.paid_sessions} LUNAS`;
      if (alltimeRevenueEl) alltimeRevenueEl.textContent = `RP ${Number(all_time.revenue || 0).toLocaleString('id-ID')}`;
    } catch (err) {
      console.warn('Gagal memuat laporan harian:', err.message);
    }
  }

  // Initial load
  await loadEvents();
  loadDailyReport();

  // Export CSV button (F-15) with Event Filter Support
  document.getElementById('btn-export-csv')?.addEventListener('click', () => {
    const currentEventId = selectReportEvent?.value || '';
    const url = api.getExportCsvUrl(currentEventId);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', '');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  // History & Reprint (F-13) with Event Filter Support
  async function loadHistory(eventId = '') {
    const tableBody = document.getElementById('history-table-body');
    if (!tableBody) return;

    try {
      const targetEventId = eventId || selectHistoryEvent?.value || '';
      const res = await api.getHistory(targetEventId);
      if (!res.success || !res.data) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="8" class="p-4 text-center text-raw-error font-body">Gagal memuat riwayat transaksi</td>
          </tr>
        `;
        return;
      }

      const rows = res.data;
      if (rows.length === 0) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="8" class="p-4 text-center text-black/60 font-body">Belum ada riwayat transaksi sesi</td>
          </tr>
        `;
        return;
      }

      tableBody.innerHTML = rows
        .map((r) => {
          const sessionNo = r.formatted_session_no || String(r.session_no).padStart(4, '0');
          const eventName = r.event_nama || 'Event Reguler';
          const dateStr = r.dibuat_pada ? r.dibuat_pada.replace('T', ' ').slice(0, 19) : '-';
          const templateName = r.template_nama || 'Belum Dipilih';
          const nominalStr = `Rp ${Number(r.nominal || 0).toLocaleString('id-ID')}`;

          let sessionBadge = 'chip-raw-default';
          if (r.session_status === 'done') sessionBadge = 'chip-raw-active';
          else if (r.session_status === 'cancelled') sessionBadge = 'chip-raw-destructive';
          else if (r.session_status === 'capturing' || r.session_status === 'reviewing') sessionBadge = 'chip-raw-warning';

          let payBadge = 'chip-raw-default';
          if (r.payment_status === 'lunas' || r.payment_status === 'paid') {
            payBadge = 'chip-raw-active';
          } else if (
            r.payment_status === 'gagal' ||
            r.payment_status === 'failed' ||
            r.payment_status === 'expired' ||
            r.payment_status === 'cancelled'
          ) {
            payBadge = 'chip-raw-destructive';
          } else if (
            r.payment_status === 'menunggu' ||
            r.payment_status === 'unpaid' ||
            r.payment_status === 'pending'
          ) {
            payBadge = 'chip-raw-warning';
          }

          const hasComposite = Boolean(r.composite_file);

          return `
            <tr class="hover:bg-raw-sunken transition-colors">
              <td class="p-3 border-r-[2px] border-black font-bold text-black">#${sessionNo}</td>
              <td class="p-3 border-r-[2px] border-black font-headline uppercase text-[11px] text-black/90">${eventName}</td>
              <td class="p-3 border-r-[2px] border-black whitespace-nowrap text-black/80">${dateStr}</td>
              <td class="p-3 border-r-[2px] border-black font-headline uppercase text-black">${templateName}</td>
              <td class="p-3 border-r-[2px] border-black text-black font-bold">${nominalStr}</td>
              <td class="p-3 border-r-[2px] border-black">
                <span class="chip-raw ${sessionBadge} text-[10px] uppercase font-bold">${r.session_status}</span>
              </td>
              <td class="p-3 border-r-[2px] border-black">
                <span class="chip-raw ${payBadge} text-[10px] uppercase font-bold">${r.payment_status || 'menunggu'}</span>
              </td>
              <td class="p-3 text-center">
                ${
                  hasComposite
                    ? `<button type="button" class="btn-raw-secondary text-xs px-3 py-1 font-headline btn-reprint" data-session-id="${r.id}" data-session-no="${sessionNo}">
                        CETAK ULANG
                      </button>`
                    : `<span class="chip-raw bg-black/10 text-black/40 text-[10px]">TIDAK ADA FOTO</span>`
                }
              </td>
            </tr>
          `;
        })
        .join('');
    } catch (err) {
      console.warn('Gagal memuat history:', err.message);
      tableBody.innerHTML = `
        <tr>
          <td colspan="8" class="p-4 text-center text-raw-error font-body">Kesalahan memuat riwayat: ${err.message}</td>
        </tr>
      `;
    }
  }

  loadHistory();

  document.getElementById('btn-refresh-history')?.addEventListener('click', () => {
    loadEvents();
    loadHistory(selectHistoryEvent?.value);
    loadDailyReport(selectReportEvent?.value);
  });

  // Handle Reprint Action (F-13) with double-click guard
  let isReprinting = false;
  async function handleReprint(sessionId, sessionNo, btn) {
    if (isReprinting) return;
    if (!confirm(`Cetak ulang foto untuk Sesi #${sessionNo}?`)) {
      return;
    }
    isReprinting = true;
    const origText = btn ? btn.textContent : '';
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'MENCETAK...';
      btn.classList.add('opacity-50');
    }

    try {
      const res = await api.reprintSession(sessionId);
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Data foto tidak tersedia');
      }

      // Siapkan layout cetak off-screen
      const existingContainer = document.getElementById('photobooth-print-container');
      if (existingContainer) existingContainer.remove();

      const printContainer = document.createElement('div');
      printContainer.id = 'photobooth-print-container';
      printContainer.innerHTML = `
        <div class="print-page">
          <img src="${res.data.compositeUrl}" alt="Reprint Sesi #${res.data.sessionNo}" />
        </div>
      `;
      document.body.appendChild(printContainer);

      if (window.photobooth?.printSilent) {
        await window.photobooth.printSilent({ copies: 1 });
      } else {
        window.print();
      }

      setTimeout(() => {
        printContainer.remove();
      }, 1000);

      alert(`Instruksi cetak ulang untuk Sesi #${res.data.sessionNo} telah dikirim ke printer!`);
    } catch (err) {
      alert('Gagal mencetak ulang: ' + err.message);
    } finally {
      isReprinting = false;
      if (btn) {
        btn.disabled = false;
        btn.textContent = origText;
        btn.classList.remove('opacity-50');
      }
    }
  }

  // Event delegation for reprint button in table
  document.getElementById('history-table-body')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-reprint');
    if (btn) {
      const sessionId = btn.getAttribute('data-session-id');
      const sessionNo = btn.getAttribute('data-session-no');
      if (sessionId) {
        handleReprint(sessionId, sessionNo, btn);
      }
    }
  });

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
      const verifyRes = await api.verifyPin(enteredPin);
      if (!verifyRes.success) {
        throw new Error('PIN tidak valid');
      }

      // PIN is valid!
      const targetSessionId = activeConfirmSessionId;
      closePinModal();

      await api.confirmPaymentManual(targetSessionId);
      alert(`Pembayaran untuk sesi ${targetSessionId} berhasil dikonfirmasi secara manual! Kiosk langsung melanjutkan.`);
      checkWaitingPayment();
      loadHistory();
      loadDailyReport();
    } catch (err) {
      if (pinModalError) {
        pinModalError.textContent = 'PIN SALAH! SILAKAN COBA LAGI.';
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
  const pollInterval = setInterval(checkWaitingPayment, 2500);

  // Listen to SSE events for real-time dashboard updates
  let sse = null;
  try {
    sse = new EventSource('http://localhost:3000/api/sse');
    const updateAll = () => {
      checkWaitingPayment();
      loadHistory(selectHistoryEvent?.value);
      loadDailyReport(selectReportEvent?.value);
      loadEvents();
    };
    sse.addEventListener('session_created', updateAll);
    sse.addEventListener('session_updated', updateAll);
    sse.addEventListener('payment_paid', updateAll);
    sse.addEventListener('payment_expired', updateAll);
  } catch (e) {
    console.warn('SSE admin error:', e);
  }

  // Emergency reset event with double-click guard
  const resetBtn = document.getElementById('btn-emergency-reset');
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
              checkWaitingPayment();
              loadHistory();
              loadDailyReport();
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

// Initial entry point
checkAuthAndRender();
