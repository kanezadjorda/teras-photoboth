import { api } from '../../shared/api.js';
import { preventDoubleClick } from '../../shared/ui.js';
import { pageHeader } from '../ui-helpers.js';

export function createSettingsScreen() {
  let container = null;

  async function loadSettings(el) {
    try {
      const res = await api.getSettings();
      if (res.success && res.data) {
        const priceInput = el.querySelector('#setting-price');
        const copiesInput = el.querySelector('#setting-copies');
        const countdownInput = el.querySelector('#setting-countdown');
        const pinInput = el.querySelector('#setting-pin');
        if (priceInput) priceInput.value = res.data.session_price || 25000;
        if (copiesInput) copiesInput.value = res.data.copies_per_session || 1;
        if (countdownInput) countdownInput.value = String(res.data.countdown_seconds || 3);
        if (pinInput) pinInput.value = res.data.admin_pin || '1234';
      }
    } catch (err) {
      console.error('Gagal memuat pengaturan:', err);
    }
  }

  function setupSaveListener(el) {
    const saveBtn = el.querySelector('#btn-save-settings');
    if (!saveBtn) return;

    saveBtn.addEventListener(
      'click',
      preventDoubleClick(
        saveBtn,
        async () => {
          const price = Number(el.querySelector('#setting-price')?.value) || 25000;
          const copies = Number(el.querySelector('#setting-copies')?.value) || 1;
          const countdown = Number(el.querySelector('#setting-countdown')?.value) || 3;
          const pin = el.querySelector('#setting-pin')?.value?.trim() || '1234';
          await api.updateSettings({
            session_price: price,
            copies_per_session: copies,
            countdown_seconds: countdown,
            admin_pin: pin
          });
          alert('Pengaturan berhasil disimpan');
        },
        'MENYIMPAN...'
      )
    );
  }

  return {
    mount(parent) {
      container = document.createElement('div');
      container.innerHTML = `
        ${pageHeader({
          title: 'PENGATURAN',
          description: 'Harga sesi, jumlah cetak, durasi countdown, dan PIN operator'
        })}
        <section class="card-sb my-6 bg-white p-6 lg:p-8 border border-[#E5E5E5]">
          <h2 class="text-h3 font-semibold uppercase tracking-tight text-[#0A0A0A] pb-3 mb-6 border-b border-[#E5E5E5]">
            PENGATURAN SESI & KEAMANAN
          </h2>
          <div id="settings-form" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <label class="block text-caption font-mono uppercase text-[#737373] mb-1 font-medium">HARGA PER SESI (RUPIAH)</label>
              <input type="number" id="setting-price" class="input-sb w-full font-mono text-xs" />
              <p class="text-caption text-[#737373] mt-1">Nominal yang akan digenerate ke QRIS dinamis Midtrans</p>
            </div>
            <div>
              <label class="block text-caption font-mono uppercase text-[#737373] mb-1 font-medium">JUMLAH CETAK PER SESI</label>
              <input type="number" id="setting-copies" min="1" max="10" class="input-sb w-full font-mono text-xs" />
              <p class="text-caption text-[#737373] mt-1">Jumlah lembar 4R yang dicetak otomatis per sesi</p>
            </div>
            <div>
              <label class="block text-caption font-mono uppercase text-[#737373] mb-1 font-medium">COUNTDOWN FOTO (DETIK)</label>
              <select id="setting-countdown" class="input-sb w-full font-mono text-xs bg-white cursor-pointer">
                <option value="3">3 DETIK (STANDAR)</option>
                <option value="5">5 DETIK</option>
                <option value="10">10 DETIK</option>
                <option value="15">15 DETIK</option>
              </select>
              <p class="text-caption text-[#737373] mt-1">Waktu hitung mundur sebelum kamera mengambil gambar</p>
            </div>
            <div>
              <label class="block text-caption font-mono uppercase text-[#737373] mb-1 font-medium">PIN OPERATOR (4 DIGIT)</label>
              <input type="password" id="setting-pin" maxlength="4" class="input-sb font-mono tracking-widest text-center w-full text-xs" placeholder="1234" />
              <p class="text-caption text-[#737373] mt-1">PIN untuk membuka panel & konfirmasi manual (F-14)</p>
            </div>
            <div class="sm:col-span-2 lg:col-span-4 flex justify-end pt-2 border-t border-[#E5E5E5]">
              <button id="btn-save-settings" class="btn-sb-primary px-6 py-2.5 text-xs font-mono uppercase tracking-wider cursor-pointer">
                SIMPAN PENGATURAN
              </button>
            </div>
          </div>
        </section>
      `;

      parent.appendChild(container);
      loadSettings(container);
      setupSaveListener(container);
    },
    unmount() {
      container?.remove();
      container = null;
    }
  };
}

