/**
 * Review & Effect Screen for Kiosk (RawBlock Design System)
 * Displays composite print preview (300 DPI 4R) and 7 photo effect presets.
 * Generates multi-variants upon confirm:
 *   1. Composite with filter (ready for print)
 *   2. Composite original (unfiltered)
 *   3. Raw photos filtered
 *   4. Animated GIF from raw shots
 *   5. Live Video Template (2-3s animated template)
 * PRD Reference: F-11, F-17, F-27, F-28, F-29
 */

import { composeSession, loadImage } from '../../shared/composite.js';
import { EFFECT_LIST, getEffect } from '../../shared/effects.js';
import { CANVAS_SPECS, TIMEOUTS } from '../../shared/constants.js';
import { preventDoubleClick, createIdleTimer } from '../../shared/ui.js';
import { createGifFromImages } from '../../shared/gif.js';
import { composeTemplateLiveVideo } from '../../shared/video-composer.js';

/**
 * Applies a CSS filter to an image element and exports as JPEG data URL.
 * @param {HTMLImageElement} img
 * @param {string} filter
 * @returns {string}
 */
function applyFilterToImage(img, filter) {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width || 1200;
  canvas.height = img.naturalHeight || img.height || 1800;
  const ctx = canvas.getContext('2d');
  if (filter && filter !== 'none') {
    ctx.filter = filter;
  }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.95);
}

export function createReviewScreen({
  template,
  photos = [],
  slotVideos = [],
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
  let loadedPhotosCache = null;

  async function preloadAssets() {
    if (template?.file_png && !cachedTemplateImg) {
      cachedTemplateImg = await loadImage(`/templates/${template.file_png}`).catch((err) => {
        console.warn('[Review] Gagal memuat overlay PNG template:', err);
        return null;
      });
    }

    if (!loadedPhotosCache) {
      loadedPhotosCache = await Promise.all(
        photos.map((src) => (src ? loadImage(src) : null))
      );
    }
  }

  async function generateCompositePreview() {
    if (!canvasContainer) return;
    try {
      canvasContainer.innerHTML = `
        <div class="font-mono text-xs text-black p-8 text-center animate-pulse">
          MEMPROSES KOMPOSIT FOTO 4R (300 DPI)...
        </div>
      `;

      await preloadAssets();

      // Render composite with selected effect applied strictly to photos (PRD F-28)
      compositeCanvas = composeSession({
        template,
        photos: loadedPhotosCache,
        effectId: selectedEffectId,
        templateImage: cachedTemplateImg,
        canvasWidth: CANVAS_SPECS.WIDTH,
        canvasHeight: CANVAS_SPECS.HEIGHT
      });

      compositeCanvas.className =
        'max-h-[48vh] sm:max-h-[55vh] lg:max-h-[62vh] max-w-full w-auto border border-[#0A0A0A] bg-white shadow-none object-contain';

      canvasContainer.innerHTML = '';
      canvasContainer.appendChild(compositeCanvas);
    } catch (err) {
      console.error('[Review] Gagal membuat komposit preview:', err);
      if (canvasContainer) {
        canvasContainer.innerHTML = `
          <div class="border border-[#DC2626] bg-white text-[#DC2626] p-4 font-headline text-center uppercase">
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
      chip.className = `effect-chip flex items-center gap-3 p-3 border font-headline text-xs md:text-sm uppercase cursor-pointer select-none transition-colors duration-150 w-full ${
        isSelected
          ? 'bg-[#0A0A0A] text-[#FAFAFA] border-[#0A0A0A]'
          : 'bg-white text-[#0A0A0A] border-[#D4D4D8] hover:bg-[#F4F4F5] hover:border-[#A1A1AA]'
      }`;

      chip.innerHTML = `
        <span class="w-7 h-7 border border-[#D4D4D8] overflow-hidden inline-block shrink-0 bg-[#FAFAFA]">
          ${
            samplePhotoSrc
              ? `<img src="${samplePhotoSrc}" alt="${preset.label}" class="w-full h-full object-cover" style="filter: ${preset.filter};" />`
              : `<span class="block w-full h-full bg-[#E5E5E5]"></span>`
          }
        </span>
        <span class="tracking-wider flex-1 text-left">${preset.label}</span>
        ${isSelected ? '<span class="text-xs font-mono font-medium tracking-widest text-white/70">&bull; AKTIF</span>' : ''}
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
      'flex flex-col justify-between w-full min-h-screen max-w-6xl 2xl:max-w-7xl mx-auto p-4 sm:p-6 md:p-8 xl:p-10 box-border font-body select-none';

    container.innerHTML = `
      <!-- Header (StudioBlank: 1px border, refined hierarchy) -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-4 border-b border-[#D4D4D8]">
        <div>
          <h1 class="text-h1 uppercase text-[#0A0A0A]">
            PILIH EFEK FOTO
          </h1>
          <p class="text-body-sm text-[#71717A] mt-1">
            PILIH FILTER WARNA TERBAIK UNTUK HASIL CETAK 4R, LIVE VIDEO & GALERI KAMU
          </p>
        </div>
      </div>

      <!-- Main Layout: Composite Preview (Left/Center) & Effect Selection (Right) -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start my-auto py-2">
        <!-- Composite Preview -->
        <div class="lg:col-span-7 flex flex-col items-center justify-center">
          <div id="composite-canvas-container" class="border border-[#E5E5E5] bg-[#FAFAFA] p-3 sm:p-4 flex items-center justify-center w-full min-h-[280px] sm:min-h-[360px] lg:min-h-[460px]">
          </div>
          <span class="font-mono text-xs text-[#71717A] mt-2 text-center uppercase tracking-wider">
            PRATINJAU HASIL CETAK 4R (BORDERLESS)
          </span>
        </div>

        <!-- Effect Selection Tray (Right) -->
        <div class="lg:col-span-5 space-y-4 w-full">
          <div class="card-sb space-y-4 p-4 sm:p-6 border border-[#E5E5E5] bg-white">
            <div class="flex items-center justify-between gap-2 pb-3 border-b border-[#E5E5E5]">
              <h3 class="font-headline text-sm sm:text-base font-semibold uppercase text-[#0A0A0A]">
                PILIH PRESET EFEK
              </h3>
              <span class="font-mono text-xs text-[#71717A] uppercase tracking-wider shrink-0">7 PILIHAN</span>
            </div>
            <div id="effects-selection-tray" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:flex lg:flex-col gap-2.5 lg:max-h-[400px] lg:overflow-y-auto pr-1"></div>
          </div>
        </div>
      </div>

      <!-- Footer Action -->
      <div class="mt-6 pt-4 border-t border-[#D4D4D8] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 sm:gap-4">
        <div class="font-mono text-xs text-[#71717A] text-center md:text-left">
          PASTIKAN EFEK WARNA SUDAH PAS SEBELUM MENCETAK.
        </div>
        <button id="btn-confirm-print" class="btn-sb-primary btn-kiosk min-h-[64px] px-8 sm:px-12 text-sm md:text-base font-mono uppercase tracking-wider font-semibold w-full md:w-auto cursor-pointer">
          LANJUT & CETAK FOTO &rarr;
        </button>
      </div>
    `;

    parent.appendChild(container);

    canvasContainer = container.querySelector('#composite-canvas-container');
    effectsContainer = container.querySelector('#effects-selection-tray');
    confirmBtn = container.querySelector('#btn-confirm-print');

    if (confirmBtn && onConfirm) {
      const clickHandler = preventDoubleClick(confirmBtn, async () => {
        await preloadAssets();

        // 1. Komposit siap cetak dengan filter terpilih
        const compositeDataUrl = compositeCanvas ? compositeCanvas.toDataURL('image/jpeg', 0.95) : null;

        // 2. Komposit tanpa filter (original)
        let compositeOriginalDataUrl = null;
        try {
          const originalCanvas = composeSession({
            template,
            photos: loadedPhotosCache,
            effectId: 'normal',
            templateImage: cachedTemplateImg,
            canvasWidth: CANVAS_SPECS.WIDTH,
            canvasHeight: CANVAS_SPECS.HEIGHT
          });
          compositeOriginalDataUrl = originalCanvas.toDataURL('image/jpeg', 0.95);
        } catch (origErr) {
          console.warn('[Review] Gagal membuat komposit original:', origErr);
        }

        // 3. Raw photos dengan filter
        const currentEffect = getEffect(selectedEffectId);
        let rawFilteredPhotos = [];
        try {
          rawFilteredPhotos = loadedPhotosCache.map((img) => {
            if (!img) return null;
            return applyFilterToImage(img, currentEffect.filter);
          });
        } catch (rawErr) {
          console.warn('[Review] Gagal membuat raw foto terfilter:', rawErr);
        }

        // 4. Animasi GIF foto satuan (looping stop-motion)
        let gifDataUrl = null;
        try {
          const validPhotos = loadedPhotosCache.filter(Boolean);
          if (validPhotos.length > 0) {
            const gifRes = createGifFromImages({
              images: validPhotos,
              width: 480,
              height: 640,
              delay: 600,
              filter: currentEffect.filter
            });
            gifDataUrl = gifRes.dataUrl;
          }
        } catch (gifErr) {
          console.warn('[Review] Gagal membuat GIF animasi:', gifErr);
        }

        // 5. Live Video Template (video 2-3s bergerak di bingkai template)
        let liveVideoDataUrl = null;
        let liveVideoExtension = 'mp4';
        const validVideos = (slotVideos || []).filter(Boolean);
        if (validVideos.length > 0 && typeof MediaRecorder !== 'undefined') {
          try {
            const liveRes = await composeTemplateLiveVideo({
              template,
              templateImage: cachedTemplateImg,
              slotVideos: validVideos,
              filter: currentEffect.filter,
              durationMs: 3000,
              fps: 30
            });
            liveVideoDataUrl = liveRes.dataUrl;
            liveVideoExtension = liveRes.extension;
          } catch (liveErr) {
            console.warn('[Review] Peringatan saat membuat live video template:', liveErr.message);
          }
        }

        await onConfirm({
          photos,
          compositeDataUrl,
          compositeOriginalDataUrl,
          rawFilteredPhotos,
          gifDataUrl,
          liveVideoDataUrl,
          liveVideoExtension,
          effectId: selectedEffectId
        });
      }, 'MEMPROSES CETAKAN & VIDEO...');
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
