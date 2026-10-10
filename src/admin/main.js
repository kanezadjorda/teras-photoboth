import { api } from '../shared/api.js';

const appRoot = document.getElementById('app');

async function renderAdminDashboard() {
  appRoot.innerHTML = `
    <header class="flex justify-between items-center pb-6 border-b border-dark/10">
      <div>
        <h1 class="text-3xl font-bold text-dark">Panel Operator Photobooth</h1>
        <p class="text-dark/60 text-sm mt-1">Pemantauan perangkat & pengaturan sesi</p>
      </div>
      <div class="flex items-center gap-3">
        <span id="system-status-pill" class="px-3 py-1.5 rounded-full text-xs font-semibold bg-success/20 text-success flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-success"></span>
          Sistem Siap
        </span>
      </div>
    </header>

    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 my-6">
      <div class="bg-white p-4 rounded-xl border border-dark/10 shadow-sm flex flex-col justify-between">
        <span class="text-xs font-bold text-dark/60 uppercase">Kamera Eksternal</span>
        <div class="mt-2 flex items-center justify-between">
          <span id="cam-status" class="text-lg font-bold text-dark">Mengecek...</span>
          <span class="w-3 h-3 rounded-full bg-accent"></span>
        </div>
      </div>

      <div class="bg-white p-4 rounded-xl border border-dark/10 shadow-sm flex flex-col justify-between">
        <span class="text-xs font-bold text-dark/60 uppercase">Printer Default</span>
        <div class="mt-2 flex items-center justify-between">
          <span id="printer-status" class="text-lg font-bold text-dark">Sistem Default</span>
          <span class="w-3 h-3 rounded-full bg-success"></span>
        </div>
      </div>

      <div class="bg-white p-4 rounded-xl border border-dark/10 shadow-sm flex flex-col justify-between">
        <span class="text-xs font-bold text-dark/60 uppercase">Koneksi Internet</span>
        <div class="mt-2 flex items-center justify-between">
          <span id="net-status" class="text-lg font-bold text-dark">Online</span>
          <span class="w-3 h-3 rounded-full bg-success"></span>
        </div>
      </div>

      <div class="bg-white p-4 rounded-xl border border-dark/10 shadow-sm flex flex-col justify-between">
        <span class="text-xs font-bold text-dark/60 uppercase">Sinkron Google Drive</span>
        <div class="mt-2 flex items-center justify-between">
          <span id="drive-status" class="text-lg font-bold text-dark">Folder Lokal Aktif</span>
          <span class="w-3 h-3 rounded-full bg-success"></span>
        </div>
      </div>
    </div>

    <section class="bg-white rounded-2xl border border-dark/10 p-6 shadow-sm mb-6">
      <h2 class="text-xl font-bold text-dark mb-4">Pengaturan Sesi</h2>
      <div id="settings-form" class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label class="block text-sm font-semibold text-dark/70 mb-2">Harga Per Sesi (Rp)</label>
          <input type="number" id="setting-price" class="w-full px-4 py-3 rounded-xl border border-dark/20 text-lg font-semibold focus:outline-none focus:border-primary" />
        </div>
        <div>
          <label class="block text-sm font-semibold text-dark/70 mb-2">Jumlah Cetak Per Sesi</label>
          <input type="number" id="setting-copies" min="1" max="10" class="w-full px-4 py-3 rounded-xl border border-dark/20 text-lg font-semibold focus:outline-none focus:border-primary" />
        </div>
        <div class="md:col-span-2 flex justify-end">
          <button id="btn-save-settings" class="px-6 py-3 bg-primary text-white font-bold rounded-xl hover:opacity-90 cursor-pointer">
            Simpan Pengaturan
          </button>
        </div>
      </div>
    </section>

    <section class="bg-white rounded-2xl border border-dark/10 p-6 shadow-sm flex justify-between items-center">
      <div>
        <h3 class="text-lg font-bold text-dark">Tombol Darurat (Reset Sesi)</h3>
        <p class="text-sm text-dark/60">Gunakan jika customer mengalami kendala dan ingin mereset booth ke layar awal.</p>
      </div>
      <button id="btn-emergency-reset" class="px-6 py-3 bg-error text-white font-bold rounded-xl hover:opacity-90 cursor-pointer">
        Reset ke Welcome
      </button>
    </section>
  `;

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
}

renderAdminDashboard();
