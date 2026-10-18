import { api } from '../../shared/api.js';
import { pageHeader } from '../ui-helpers.js';

export function createEventsScreen({ onStatusChange } = {}) {
  let container = null;

  async function loadEvents(el) {
    const tableBody = el.querySelector('#events-table-body');
    const activeNameEl = el.querySelector('#active-event-name');
    const activePathEl = el.querySelector('#active-event-path');
    const activeChipEl = el.querySelector('#active-event-chip');

    try {
      const res = await api.getEvents();
      if (!res.success || !res.data) {
        if (tableBody) {
          tableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-raw-error font-body">Gagal memuat daftar event</td></tr>`;
        }
        return;
      }

      const events = res.data;
      const activeEvent = events.find((e) => e.aktif === 1) || null;

      if (activeEvent) {
        if (activeNameEl) activeNameEl.textContent = activeEvent.nama;
        if (activePathEl) activePathEl.textContent = `Folder Sinkronisasi Drive: ${activeEvent.folder_path}`;
        if (activeChipEl) {
          activeChipEl.textContent = 'SESI KIOSK TERSAMBUNG KE EVENT INI';
          activeChipEl.className = 'chip-raw chip-raw-active self-start md:self-auto px-3 py-1 font-headline text-xs';
        }
      } else {
        if (activeNameEl) activeNameEl.textContent = 'TIDAK ADA EVENT AKTIF (STANDBY / REGULER)';
        if (activePathEl) activePathEl.textContent = 'Folder Default: ./data/photos (Sesi foto baru tersimpan di folder default)';
        if (activeChipEl) {
          activeChipEl.textContent = 'STANDBY (TANPA EVENT KHUSUS)';
          activeChipEl.className = 'chip-raw chip-raw-warning self-start md:self-auto px-3 py-1 font-headline text-xs';
        }
      }

      if (!tableBody) return;
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
            ? `<button type="button" class="btn-raw-destructive text-xs px-3 py-1 font-headline btn-deactivate-event" data-event-id="${e.id}" data-event-name="${e.nama}">
                NONAKTIFKAN
              </button>`
            : `<button type="button" class="btn-raw-primary text-xs px-3 py-1 font-headline btn-activate-event" data-event-id="${e.id}" data-event-name="${e.nama}">
                JADIKAN AKTIF
              </button>`;

          return `
            <tr class="hover:bg-raw-sunken transition-colors">
              <td class="p-3 sm:p-4 border-r-[2px] border-black font-bold text-black font-headline uppercase text-xs sm:text-sm">${e.nama}</td>
              <td class="p-3 sm:p-4 border-r-[2px] border-black text-black/80 font-mono text-[11px] sm:text-xs break-all">${e.folder_path}</td>
              <td class="p-3 sm:p-4 border-r-[2px] border-black text-black font-bold font-mono text-xs sm:text-sm whitespace-nowrap">${e.total_sessions || 0} SESI</td>
              <td class="p-3 sm:p-4 border-r-[2px] border-black">${statusChip}</td>
              <td class="p-3 sm:p-4 text-center whitespace-nowrap">${actionBtn}</td>
            </tr>
          `;
        })
        .join('');
    } catch (err) {
      console.warn('Gagal memuat events:', err.message);
    }
  }

  async function handleDeactivateEvent(eventId, eventName, btn) {
    if (!eventId) return;
    if (!confirm(`Nonaktifkan event "${eventName}"? Sesi kiosk berikutnya akan beralih ke folder default tanpa event khusus.`)) {
      return;
    }
    const origText = btn ? btn.textContent : '';
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'MENONAKTIFKAN...';
    }
    try {
      const res = await api.deactivateEvent(eventId);
      if (!res.success) {
        throw new Error(res.error || 'Gagal menonaktifkan event');
      }
      await loadEvents(container);
      onStatusChange?.();
      alert(`Event "${eventName}" telah dinonaktifkan. Kiosk sekarang berada di mode standby/reguler.`);
    } catch (err) {
      alert('Gagal menonaktifkan event: ' + err.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = origText;
      }
    }
  }

  function setupEventListeners(el) {
    const modal = el.querySelector('#event-modal-overlay');
    const btnCreate = el.querySelector('#btn-create-event-modal');
    const btnCancel = el.querySelector('#btn-cancel-event-modal');
    const createForm = el.querySelector('#create-event-form');
    const btnBrowse = el.querySelector('#btn-browse-event-folder');
    const tableBody = el.querySelector('#events-table-body');

    btnCreate?.addEventListener('click', () => {
      const nameInput = el.querySelector('#input-event-name');
      const folderInput = el.querySelector('#input-event-folder');
      const checkActivate = el.querySelector('#check-event-activate');
      if (nameInput) nameInput.value = '';
      if (folderInput) folderInput.value = './data/photos/' + new Date().toISOString().slice(0, 10);
      if (checkActivate) checkActivate.checked = true;
      modal?.classList.remove('hidden');
      nameInput?.focus();
    });

    btnCancel?.addEventListener('click', () => modal?.classList.add('hidden'));

    modal?.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.add('hidden');
    });

    btnBrowse?.addEventListener('click', async () => {
      const folderInput = el.querySelector('#input-event-folder');
      if (window.photobooth?.selectFolder) {
        try {
          const selected = await window.photobooth.selectFolder(folderInput?.value || '');
          if (selected && folderInput) folderInput.value = selected;
        } catch (err) {
          console.warn('Gagal memilih folder:', err);
          alert('Gagal membuka jendela pilih folder: ' + err.message + '\n\nSilakan restart aplikasi Electron jika baru saja memperbarui kode backend Electron.');
        }
      } else {
        alert('Fitur pemilihan folder otomatis aktif di aplikasi desktop Electron. Anda dapat mengetikkan lokasi folder secara manual.');
      }
    });

    createForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nama = el.querySelector('#input-event-name')?.value?.trim();
      const folder_path = el.querySelector('#input-event-folder')?.value?.trim();
      const set_active = Boolean(el.querySelector('#check-event-activate')?.checked);
      const submitBtn = el.querySelector('#btn-submit-event');

      if (!nama || !folder_path) return;

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'MENYIMPAN...';
      }

      try {
        const res = await api.createEvent({ nama, folder_path, set_active });
        if (!res.success) throw new Error(res.error || 'Gagal membuat event');
        modal?.classList.add('hidden');
        await loadEvents(el);
        onStatusChange?.();
        alert(`Event "${nama}" berhasil dibuat!`);
      } catch (err) {
        alert('Gagal membuat event: ' + err.message);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'SIMPAN & BUAT EVENT';
        }
      }
    });

    tableBody?.addEventListener('click', async (e) => {
      const activateBtn = e.target.closest('.btn-activate-event');
      if (activateBtn) {
        const eventId = activateBtn.getAttribute('data-event-id');
        const eventName = activateBtn.getAttribute('data-event-name');
        if (eventId && confirm(`Jadikan event "${eventName}" sebagai event operasional aktif? Sesi kiosk berikutnya akan menyimpan foto ke folder event ini.`)) {
          activateBtn.disabled = true;
          activateBtn.textContent = 'MENGAKTIFKAN...';
          try {
            const res = await api.activateEvent(eventId);
            if (!res.success) throw new Error(res.error || 'Gagal mengaktifkan event');
            await loadEvents(el);
            onStatusChange?.();
            alert(`Event "${eventName}" sekarang aktif!`);
          } catch (err) {
            alert('Gagal mengaktifkan event: ' + err.message);
          }
        }
        return;
      }

      const deactivateBtn = e.target.closest('.btn-deactivate-event');
      if (deactivateBtn) {
        const eventId = deactivateBtn.getAttribute('data-event-id');
        const eventName = deactivateBtn.getAttribute('data-event-name');
        handleDeactivateEvent(eventId, eventName, deactivateBtn);
      }
    });
  }

  return {
    mount(parent) {
      container = document.createElement('div');
      container.innerHTML = `
        ${pageHeader({
          title: 'EVENT',
          description: 'Folder penyimpanan foto per kegiatan (disinkronkan Google Drive)',
          actionsHtml: '<button id="btn-create-event-modal" class="btn-raw-primary px-5 py-2.5 text-xs font-headline">+ BUAT EVENT BARU</button>'
        })}

        <!-- Banner Event Aktif -->
        <div class="p-4 sm:p-6 border-[3px] border-black bg-raw-sunken mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span class="label-raw text-xs text-black">EVENT OPERASIONAL AKTIF SAAT INI</span>
            <h3 id="active-event-name" class="font-headline text-xl sm:text-2xl text-black uppercase mt-1">
              MEMUAT EVENT...
            </h3>
            <p id="active-event-path" class="font-mono text-xs sm:text-sm text-black/80 mt-1 break-all">
              Folder: -
            </p>
          </div>
          <span id="active-event-chip" class="chip-raw chip-raw-active self-start md:self-auto px-4 py-2 font-headline text-xs sm:text-sm whitespace-nowrap">
            SESI KIOSK TERSAMBUNG KE EVENT INI
          </span>
        </div>

        <!-- Tabel Daftar Event -->
        <div class="card-raw bg-white p-0 overflow-hidden mb-6">
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse border-[3px] border-black text-sm">
              <thead>
                <tr class="bg-black text-white font-headline text-xs sm:text-sm uppercase">
                  <th class="p-3 sm:p-4 border-r-[2px] border-white/20 w-1/4 min-w-[160px]">NAMA EVENT</th>
                  <th class="p-3 sm:p-4 border-r-[2px] border-white/20 min-w-[200px]">FOLDER DRIVE / LOKAL</th>
                  <th class="p-3 sm:p-4 border-r-[2px] border-white/20 w-28 sm:w-36 min-w-[100px]">TOTAL SESI</th>
                  <th class="p-3 sm:p-4 border-r-[2px] border-white/20 w-36 sm:w-44 min-w-[130px]">STATUS</th>
                  <th class="p-3 sm:p-4 text-center w-36 sm:w-44 min-w-[130px]">AKSI</th>
                </tr>
              </thead>
              <tbody id="events-table-body" class="font-mono text-xs divide-y-[2px] divide-black">
                <tr>
                  <td colspan="5" class="p-4 text-center text-black/60 font-body">Memuat daftar event...</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

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
      `;

      parent.appendChild(container);
      setupEventListeners(container);
      loadEvents(container);
    },
    refresh() {
      if (container) {
        loadEvents(container);
      }
    },
    unmount() {
      container?.remove();
      container = null;
    }
  };
}

