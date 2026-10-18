/**
 * Choose Template Screen for Kiosk (RawBlock Design System)
 * Displays active templates gallery for customer selection.
 * PRD Reference: F-06, F-23
 */

import { api } from '../../shared/api.js';
import { getUniquePhotoCount } from '../../shared/composite.js';

export function createChooseTemplateScreen({ onSelectTemplate }) {
  let container = null;
  let gridContainer = null;

  async function loadTemplates() {
    if (!gridContainer) return;
    try {
      const res = await api.getTemplates(false); // only active templates
      const templates = res.data || [];

      if (templates.length === 0) {
        gridContainer.innerHTML = `
          <div class="col-span-full border-[5px] border-black bg-white p-12 text-center space-y-4">
            <h3 class="font-headline text-2xl uppercase text-black">BELUM ADA TEMPLATE AKTIF</h3>
            <p class="font-body text-sm text-black/70">
              Silakan hubungi staff atau operator untuk mengaktifkan template cetakan di panel admin.
            </p>
          </div>
        `;
        return;
      }

      gridContainer.innerHTML = '';
      for (const tpl of templates) {
        const uniqueTakes = getUniquePhotoCount(tpl.slots);
        const photoBadgeText = uniqueTakes < tpl.jumlah_slot
          ? `${uniqueTakes} FOTO (${tpl.jumlah_slot} SLOT)`
          : `${tpl.jumlah_slot} FOTO`;

        const card = document.createElement('div');
        card.className =
          'card-raw flex flex-col justify-between cursor-pointer group hover:bg-black hover:text-white transition-none p-5 space-y-4';

        card.innerHTML = `
          <div class="space-y-3">
            <div class="flex items-center justify-between pb-2 border-b-[2px] border-black group-hover:border-white">
              <h3 class="font-headline text-lg uppercase text-black group-hover:text-white truncate">
                ${tpl.nama}
              </h3>
              <span class="chip-raw chip-raw-default group-hover:border-white group-hover:text-white group-hover:bg-black">
                ${photoBadgeText}
              </span>
            </div>

            <!-- Thumbnail Preview -->
            <div class="aspect-[2/3] bg-raw-sunken border-[3px] border-black group-hover:border-white overflow-hidden flex items-center justify-center p-2">
              <img src="/templates/${tpl.file_png}" alt="${tpl.nama}" class="w-full h-full object-contain" />
            </div>
          </div>

          <button class="btn-select btn-raw-primary w-full py-4 text-base font-headline group-hover:bg-white group-hover:text-black group-hover:border-white">
            PILIH TEMPLATE INI
          </button>
        `;

        // Select template event with double-click guard and recovery
        let isSelecting = false;
        const triggerSelect = async () => {
          if (isSelecting) return;
          isSelecting = true;
          const btn = card.querySelector('.btn-select');
          if (btn) {
            btn.disabled = true;
            btn.textContent = 'MEMPROSES...';
          }
          try {
            if (onSelectTemplate) {
              await onSelectTemplate(tpl);
            }
          } catch (err) {
            console.error('[ChooseTemplate] Gagal melanjutkan ke sesi foto:', err);
            isSelecting = false;
            if (btn) {
              btn.disabled = false;
              btn.textContent = 'PILIH TEMPLATE INI';
            }
          }
        };

        card.addEventListener('click', (e) => {
          if (!e.target.closest('.btn-select')) {
            triggerSelect();
          }
        });

        card.querySelector('.btn-select').addEventListener('click', (e) => {
          e.stopPropagation();
          triggerSelect();
        });

        gridContainer.appendChild(card);
      }
    } catch (err) {
      console.error('[ChooseTemplate] Gagal memuat template:', err);
      if (gridContainer) {
        gridContainer.innerHTML = `
          <div class="col-span-full border-[5px] border-black bg-raw-error text-white p-8 text-center font-headline uppercase">
            GAGAL MENGHUBUNGI SERVER LOCAL. PERIKSA KONEKSI APLIKASI.
          </div>
        `;
      }
    }
  }

  function mount(parent) {
    container = document.createElement('div');
    container.className =
      'flex flex-col justify-between w-full h-full max-w-6xl mx-auto p-6 box-border font-body overflow-y-auto';

    container.innerHTML = `
      <!-- Header -->
      <div class="flex items-center justify-between pb-4 mb-6 border-b-[5px] border-black">
        <div>
          <h1 class="text-3xl md:text-4xl font-headline uppercase text-black">
            PILIH TEMPLATE CETAKAN
          </h1>
          <p class="font-body text-xs text-black/70 mt-1">
            PILIH BINGKAI FOTO YANG KAMU SUKAI UNTUK MEMULAI SESI FOTO
          </p>
        </div>
      </div>

      <!-- Templates Grid -->
      <div id="templates-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 my-auto">
        <div class="col-span-full font-mono text-sm text-center p-12 border-[3px] border-black bg-raw-sunken">
          MEMUAT DAFTAR TEMPLATE AKTIF...
        </div>
      </div>

      <!-- Footer Info -->
      <div class="mt-6 pt-4 border-t-[3px] border-black flex items-center justify-between font-mono text-xs text-black/60">
        <span>FORMAT CETAK: 4R (1200×1800 PX) BORDERLESS</span>
        <span>KLIK PADA SALAH SATU KARTU UNTUK MEMILIH</span>
      </div>
    `;

    parent.appendChild(container);

    gridContainer = container.querySelector('#templates-grid');
    loadTemplates();
  }

  function unmount() {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    container = null;
    gridContainer = null;
  }

  return { mount, unmount };
}

