/**
 * Choose Template Screen for Kiosk (RawBlock Design System)
 * Displays active templates gallery for customer selection.
 * PRD Reference: F-06, F-23
 */

import { api } from '../../shared/api.js';
import { getUniquePhotoCount } from '../../shared/composite.js';
import { createIdleTimer } from '../../shared/ui.js';
import { TIMEOUTS } from '../../shared/constants.js';

export function createChooseTemplateScreen({ onSelectTemplate, onTimeout }) {
  let container = null;
  let gridContainer = null;
  let idleTimer = null;

  async function loadTemplates() {
    if (!gridContainer) return;
    try {
      const res = await api.getTemplates(false); // only active templates
      const templates = res.data || [];

      if (templates.length === 0) {
        gridContainer.innerHTML = `
          <div class="col-span-full border border-[#E5E5E5] bg-white p-12 text-center space-y-4">
            <h3 class="text-h2 uppercase text-[#0A0A0A]">BELUM ADA TEMPLATE AKTIF</h3>
            <p class="text-body-sm text-[#71717A]">
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
          'card-sb flex flex-col justify-between cursor-pointer group bg-white border border-[#E5E5E5] hover:border-[#0A0A0A] transition-colors duration-150 p-5 space-y-4';

        card.innerHTML = `
          <div class="space-y-3">
            <div class="flex items-center justify-between pb-2 border-b border-[#E5E5E5]">
              <h3 class="font-headline text-base font-semibold uppercase text-[#0A0A0A] truncate">
                ${tpl.nama}
              </h3>
              <span class="chip-sb text-[10px] font-mono text-[#71717A]">
                ${photoBadgeText}
              </span>
            </div>

            <!-- Thumbnail Preview: StudioBlank clean image container -->
            <div class="aspect-[2/3] bg-[#FAFAFA] border border-[#E5E5E5] overflow-hidden flex items-center justify-center p-3 group-hover:border-[#0A0A0A] transition-colors duration-150">
              <img src="/templates/${tpl.file_png}" alt="${tpl.nama}" class="w-full h-full object-contain" />
            </div>
          </div>

          <button class="btn-select btn-sb-primary w-full h-12 text-xs font-mono uppercase tracking-wider font-semibold cursor-pointer">
            PILIH TEMPLATE INI &rarr;
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
          <div class="col-span-full border border-[#DC2626] bg-[#FFFFFF] text-[#DC2626] p-8 text-center font-headline uppercase">
            GAGAL MENGHUBUNGI SERVER LOKAL. PERIKSA KONEKSI APLIKASI.
          </div>
        `;
      }
    }
  }

  function mount(parent) {
    container = document.createElement('div');
    container.className =
      'flex flex-col justify-between w-full h-full max-w-6xl mx-auto p-6 md:p-8 box-border font-body overflow-y-auto select-none';

    container.innerHTML = `
      <!-- Header (StudioBlank: 1px border, refined hierarchy) -->
      <div class="flex items-center justify-between pb-4 mb-6 border-b border-[#D4D4D8]">
        <div>
          <h1 class="text-h1 uppercase text-[#0A0A0A]">
            PILIH TEMPLATE CETAKAN
          </h1>
          <p class="text-body-sm text-[#71717A] mt-1">
            PILIH BINGKAI FOTO YANG KAMU SUKAI UNTUK MEMULAI SESI FOTO
          </p>
        </div>
      </div>

      <!-- Templates Grid -->
      <div id="templates-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 my-auto py-2">
        <div class="col-span-full font-mono text-sm text-center p-12 border border-[#E5E5E5] bg-white text-[#71717A]">
          MEMUAT DAFTAR TEMPLATE AKTIF...
        </div>
      </div>

      <!-- Footer Info -->
      <div class="mt-6 pt-4 border-t border-[#D4D4D8] flex items-center justify-between font-mono text-xs text-[#71717A]">
        <span>FORMAT CETAK: 4R (1200×1800 PX) BORDERLESS</span>
        <span>KLIK PADA SALAH SATU KARTU UNTUK MEMILIH</span>
      </div>
    `;

    parent.appendChild(container);

    gridContainer = container.querySelector('#templates-grid');
    loadTemplates();

    // Start 60s idle timeout (PRD F-29)
    idleTimer = createIdleTimer({
      timeoutSeconds: TIMEOUTS.IDLE_TIMEOUT_SECONDS || 60,
      onTimeout: () => {
        console.warn('[ChooseTemplate] Tidak ada aktivitas selama 60 detik. Membatalkan sesi & kembali ke awal.');
        if (typeof onTimeout === 'function') {
          onTimeout();
        }
      }
    });
    idleTimer.start();
  }

  function unmount() {
    if (idleTimer) {
      idleTimer.stop();
      idleTimer = null;
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    container = null;
    gridContainer = null;
  }

  return { mount, unmount };
}

