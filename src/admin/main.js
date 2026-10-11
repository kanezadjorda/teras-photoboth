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

    <!-- Pengaturan Sesi -->
    <section class="card-raw-elevated my-6">
      <h2 class="text-xl font-headline uppercase tracking-tight text-black pb-2 mb-6 border-b-[3px] border-black">
        PENGATURAN SESI
      </h2>
      <div id="settings-form" class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label class="label-raw">HARGA PER SESI (RUPIAH)</label>
          <input type="number" id="setting-price" class="input-raw" />
          <p class="font-body text-xs text-black/70 mt-1">Nominal yang akan digenerate ke QRIS dinamis Mayar</p>
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
        } catch (err) {
          alert('Gagal mereset: ' + err.message);
        }
      }
    });
  }
}

renderAdminDashboard();
