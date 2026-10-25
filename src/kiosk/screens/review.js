/**
 * Review & Effect Screen for Kiosk (RawBlock Design System)
 * Displays composite print preview (300 DPI 4R) and 7 photo effect presets.
 * Note: Retake is handled during the capture phase (PRD F-10).
 * PRD Reference: F-11, F-27, F-28, F-29
 */

import { composeSession, loadImage } from '../../shared/composite.js';
import { EFFECT_LIST } from '../../shared/effects.js';
import { CANVAS_SPECS, TIMEOUTS } from '../../shared/constants.js';
import { preventDoubleClick, createIdleTimer } from '../../shared/ui.js';

export function createReviewScreen({
  template,
  photos = [],
  initialEffectId = 'normal',
  onConfirm,
  onTimeout
}) {
  let container = null;
  let canvasContainer = null;
  let effectsContainer = null;
  let confirmBtn = null;
  let compositeCanvas = null;
  let idleTimer = null;
  let selectedEffectId = initialEffectId || 'normal';

  // Cached template overlay image
  let cachedTemplateImg = null;

  async function generateCompositePreview() {
    if (!canvasContainer) return;
    try {
      canvasContainer.innerHTML = `
        <div class="font-mono text-xs text-black p-8 text-center animate-pulse">
          MEMPROSES KOMPOSIT FOTO 4R (300 DPI)...
        </div>
      `;

      // Load template overlay PNG if not yet cached
      if (template?.file_png && !cachedTemplateImg) {
        cachedTemplateImg = await loadImage(`/templates/${template.file_png}`).catch((err) => {
          console.warn('[Review] Gagal memuat overlay PNG template:', err);
          return null;
        });
      }

      // Load all photo images
      const loadedPhotos = await Promise.all(
        photos.map((src) => (src ? loadImage(src) : null))
      );

      // Render composite with selected effect applied strictly to photos (PRD F-28)
      compositeCanvas = composeSession({
        template,
        photos: loadedPhotos,
        effectId: selectedEffectId,
        templateImage: cachedTemplateImg,
        canvasWidth: CANVAS_SPECS.WIDTH,
        canvasHeight: CANVAS_SPECS.HEIGHT
      });

      compositeCanvas.className =
        'max-h-[62vh] w-auto border-[5px] border-black bg-white shadow-none object-contain';

      canvasContainer.innerHTML = '';
      canvasContainer.appendChild(compositeCanvas);
    } catch (err) {
      console.error('[Review] Gagal membuat komposit preview:', err);
      if (canvasContainer) {
        canvasContainer.innerHTML = `
          <div class="border-[3px] border-black bg-raw-error text-white p-4 font-headline text-center uppercase">
            GAGAL MERENDER KOMPOSIT FOTO.
          </div>
        `;
      }
    }
  }

  function renderEffectChips() {
    if (!effectsContainer) return;
    effectsContainer.innerHTML = '';

    const samplePhotoSrc = photos[0] || '';

    EFFECT_LIST.forEach((preset) => {
      const isSelected = preset.id === selectedEffectId;
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.dataset.effectId = preset.id;
      chip.className = `effect-chip flex items-center gap-3 p-3 border-[3px] border-black font-headline text-sm uppercase cursor-pointer select-none transition-none w-full ${
        isSelected
          ? 'bg-black text-white shadow-[3px_3px_0px_0px_#000]'
          : 'bg-white text-black hover:bg-neutral-100'
      }`;

      chip.innerHTML = `
        <span class="w-8 h-8 border-[2px] border-black overflow-hidden inline-block shrink-0 bg-raw-sunken">
          ${
            samplePhotoSrc
              ? `<img src="${samplePhotoSrc}" alt="${preset.label}" class="w-full h-full object-cover" style="filter: ${preset.filter};" />`
              : `<span class="block w-full h-full bg-neutral-300"></span>`
          }
        </span>
        <span class="tracking-wider flex-1 text-left">${preset.label}</span>
        ${isSelected ? '<span class="text-xs font-mono">\u25cf AKTIF</span>' : ''}
      `;

      chip.addEventListener('click', () => {
        if (selectedEffectId === preset.id) return;
        selectedEffectId = preset.id;
        renderEffectChips();
        generateCompositePreview();
      });

      effectsContainer.appendChild(chip);
    });
  }

  function mount(parent) {
    container = document.createElement('div');
    container.className =
      'flex flex-col justify-between w-full h-full max-w-6xl mx-auto p-6 box-border font-body overflow-y-auto select-none';

    container.innerHTML = `
      <!-- Header -->
      <div class="flex items-center justify-between pb-4 mb-4 border-b-[5px] border-black">
        <div>
          <h1 class="text-3xl md:text-4xl font-headline uppercase text-black">
            PILIH EFEK FOTO
          </h1>
          <p class="font-body text-xs text-black/70 mt-1">
            PILIH FILTER WARNA TERBAIK UNTUK HASIL CETAK 4R KAMU
          </p>
        </div>
      </div>

      <!-- Main Layout: Composite Preview (Left/Center) & Effect Selection (Right) -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start my-auto">
        <!-- Composite Preview -->
        <div class="lg:col-span-7 flex flex-col items-center justify-center">
          <div id="composite-canvas-container" class="border-[5px] border-black bg-raw-sunken p-4 flex items-center justify-center w-full min-h-[460px]">
          </div>
          <span class="font-mono text-xs text-black/60 mt-2 uppercase">
            PRATINJAU HASIL CETAK 4R (BORDERLESS)
          </span>
        </div>

        <!-- Effect Selection Tray (Right) -->
        <div class="lg:col-span-5 space-y-4">
          <div class="card-raw-elevated space-y-3 p-5 border-[4px] border-black bg-white shadow-[4px_4px_0px_0px_#000]">
            <div class="flex items-center justify-between pb-2 border-b-[3px] border-black">
              <h3 class="font-headline text-base uppercase text-black">
                PILIH PRESET EFEK
              </h3>
              <span class="font-mono text-xs text-black/60 uppercase">7 PILIHAN</span>
            </div>
            <div id="effects-selection-tray" class="flex flex-col gap-2.5 max-h-[400px] overflow-y-auto pr-1"></div>
          </div>
        </div>
      </div>

      <!-- Footer Action -->
      <div class="mt-6 pt-4 border-t-[5px] border-black flex flex-col md:flex-row items-center justify-between gap-4">
        <div class="font-mono text-xs text-black/80">
          PASTIKAN EFEK WARNA SUDAH PAS SEBELUM MENCETAK.
        </div>
        <button id="btn-confirm-print" class="btn-raw-primary min-h-[64px] px-12 text-xl font-headline w-full md:w-auto cursor-pointer">
          LANJUT & CETAK FOTO
        </button>
      </div>
    `;

    parent.appendChild(container);

    canvasContainer = container.querySelector('#composite-canvas-container');
    effectsContainer = container.querySelector('#effects-selection-tray');
    confirmBtn = container.querySelector('#btn-confirm-print');

    if (confirmBtn && onConfirm) {
      const clickHandler = preventDoubleClick(confirmBtn, async () => {
        const compositeDataUrl = compositeCanvas ? compositeCanvas.toDataURL('image/jpeg', 0.95) : null;
        await onConfirm({ photos, compositeDataUrl, effectId: selectedEffectId });
      }, 'MENYIAPKAN CETAKAN...');
      confirmBtn.addEventListener('click', clickHandler);
    }

    renderEffectChips();
    generateCompositePreview();

    // Start 60s idle timeout (PRD F-29)
    idleTimer = createIdleTimer({
      timeoutSeconds: TIMEOUTS.IDLE_TIMEOUT_SECONDS || 60,
      onTimeout: () => {
        console.warn('[Review] Tidak ada aktivitas selama 60 detik. Membatalkan sesi & kembali ke awal.');
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
    canvasContainer = null;
    effectsContainer = null;
    confirmBtn = null;
  }

  return { mount, unmount };
}
