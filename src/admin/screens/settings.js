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
        <section class="card-raw-elevated my-6 bg-white p-4 sm:p-6 lg:p-8">
          <h2 class="text-xl font-headline uppercase tracking-tight text-black pb-2 mb-6 border-b-[3px] border-black">
            PENGATURAN SESI & KEAMANAN
          </h2>
          <div id="settings-form" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <label class="label-raw">HARGA PER SESI (RUPIAH)</label>
              <input type="number" id="setting-price" class="input-raw w-full" />
              <p class="font-body text-xs text-black/70 mt-1">Nominal yang akan digenerate ke QRIS dinamis Midtrans</p>
            </div>
            <div>
              <label class="label-raw">JUMLAH CETAK PER SESI</label>
              <input type="number" id="setting-copies" min="1" max="10" class="input-raw w-full" />
              <p class="font-body text-xs text-black/70 mt-1">Jumlah lembar 4R yang dicetak otomatis per sesi</p>
            </div>
            <div>
              <label class="label-raw">COUNTDOWN FOTO (DETIK)</label>
              <select id="setting-countdown" class="input-raw w-full font-headline text-sm bg-white cursor-pointer">
                <option value="3">3 DETIK (STANDAR)</option>
                <option value="5">5 DETIK</option>
                <option value="10">10 DETIK</option>
                <option value="15">15 DETIK</option>
              </select>
              <p class="font-body text-xs text-black/70 mt-1">Waktu hitung mundur sebelum kamera mengambil gambar</p>
            </div>
            <div>
              <label class="label-raw">PIN OPERATOR (4 DIGIT)</label>
              <input type="password" id="setting-pin" maxlength="4" class="input-raw font-mono tracking-widest text-center w-full" placeholder="1234" />
              <p class="font-body text-xs text-black/70 mt-1">PIN untuk membuka panel & konfirmasi manual (F-14)</p>
            </div>
            <div class="sm:col-span-2 lg:col-span-4 flex justify-end pt-2">
              <button id="btn-save-settings" class="btn-raw-primary px-8 py-3 text-sm font-headline cursor-pointer">
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

