/**
 * Review & Effect Screen for Kiosk (RawBlock Design System)
 * Displays composite print preview, 7 photo effect presets, and provides 1x retake per slot.
 * PRD Reference: F-10, F-11, F-27, F-28
 */

import { composeSession, renderComposite, loadImage, getSlotPhotoIndex } from '../../shared/composite.js';
import { EFFECT_LIST, getEffect } from '../../shared/effects.js';
import { DEFAULTS, CANVAS_SPECS, TIMEOUTS } from '../../shared/constants.js';
import { preventDoubleClick, createIdleTimer } from '../../shared/ui.js';

export function createReviewScreen({
  template,
  photos = [],
  retakeCounts = {},
  initialEffectId = 'normal',
  onConfirm,
  onRetakeSlot,
  onTimeout
}) {
  let container = null;
  let canvasContainer = null;
  let slotsContainer = null;
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
        'max-h-[64vh] w-auto border-[5px] border-black bg-white shadow-none object-contain';

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
      chip.className = `effect-chip flex items-center gap-2 px-3 py-2 border-[3px] border-black font-headline text-xs uppercase cursor-pointer select-none transition-none ${
        isSelected
          ? 'bg-black text-white shadow-[2px_2px_0px_0px_#000]'
          : 'bg-white text-black hover:bg-neutral-100'
      }`;

      chip.innerHTML = `
        <span class="w-6 h-6 border-[2px] border-black overflow-hidden inline-block shrink-0 bg-raw-sunken">
          ${
            samplePhotoSrc
              ? `<img src="${samplePhotoSrc}" alt="${preset.label}" class="w-full h-full object-cover" style="filter: ${preset.filter};" />`
              : `<span class="block w-full h-full bg-neutral-300"></span>`
          }
        </span>
        <span class="tracking-wider">${preset.label}</span>
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

  function renderSlotsList() {
    if (!slotsContainer) return;
    slotsContainer.innerHTML = '';

    const maxRetakes = DEFAULTS.MAX_RETAKES_PER_SLOT || 1;

    for (let i = 0; i < photos.length; i++) {
      const slotCard = document.createElement('div');
      slotCard.className = 'border-[3px] border-black bg-white p-3 flex items-center justify-between gap-3';

      const photoSrc = photos[i];
      const retakeCount = retakeCounts[i] || 0;
      const canRetake = retakeCount < maxRetakes;

      // Find which slots use this photo
      const matchingSlots = [];
      (template?.slots || []).forEach((slot, sIdx) => {
        if (getSlotPhotoIndex(slot, sIdx) === i + 1) {
          matchingSlots.push(sIdx + 1);
        }
      });

      const slotSubtext = matchingSlots.length > 1
        ? `<span class="font-mono text-[11px] text-black/60 block mt-0.5">TERPASANG DI SLOT: ${matchingSlots.join(' & ')} (DUPLIKAT)</span>`
        : matchingSlots.length === 1
          ? `<span class="font-mono text-[11px] text-black/60 block mt-0.5">SLOT #${matchingSlots[0]}</span>`
          : '';

      slotCard.innerHTML = `
        <div class="flex items-center gap-3">
          <div class="w-16 h-20 border-[2px] border-black bg-raw-sunken overflow-hidden flex items-center justify-center shrink-0">
            ${
              photoSrc
                ? `<img src="${photoSrc}" alt="Foto ${i + 1}" class="w-full h-full object-cover" />`
                : `<span class="font-mono text-xs text-black/50">KOSONG</span>`
            }
          </div>
          <div>
            <h4 class="font-headline text-sm uppercase text-black">FOTO #${i + 1}</h4>
            ${slotSubtext}
            <span class="chip-raw ${retakeCount > 0 ? 'chip-raw-warning' : 'chip-raw-default'} mt-1 text-[10px]">
              RETAKE: ${retakeCount}/${maxRetakes}
            </span>
          </div>
        </div>

        <div>
          <button class="btn-retake btn-raw-secondary px-3 py-2 text-xs font-headline whitespace-nowrap" ${
            canRetake ? '' : 'disabled'
          }>
            ${canRetake ? 'ULANG FOTO INI' : 'KUOTA HABIS'}
          </button>
        </div>
      `;

      if (canRetake) {
        slotCard.querySelector('.btn-retake').addEventListener('click', () => {
          if (onRetakeSlot) {
            onRetakeSlot(i);
          }
        });
      }

      slotsContainer.appendChild(slotCard);
    }
  }

  function mount(parent) {
    container = document.createElement('div');
    container.className =
      'flex flex-col justify-between w-full h-full max-w-6xl mx-auto p-6 box-border font-body overflow-y-auto';

    container.innerHTML = `
      <!-- Header -->
      <div class="flex items-center justify-between pb-4 mb-4 border-b-[5px] border-black">
        <div>
          <h1 class="text-3xl md:text-4xl font-headline uppercase text-black">
            REVIEW FOTO KAMU
          </h1>
          <p class="font-body text-xs text-black/70 mt-1">
            PERIKSA HASIL FOTO SEBELUM DICETAK &bull; SETIAP FOTO BISA DIULANG MAKSIMAL 1X
          </p>
        </div>
      </div>

      <!-- Main Layout: Composite Preview (Left/Center) & Slot Controls (Right) -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start my-auto">
        <!-- Composite Preview -->
        <div class="lg:col-span-7 flex flex-col items-center justify-center">
          <div id="composite-canvas-container" class="border-[5px] border-black bg-raw-sunken p-4 flex items-center justify-center w-full min-h-[480px]">
          </div>
          <span class="font-mono text-xs text-black/60 mt-2 uppercase">
            PRATINJAU HASIL CETAK 4R (BORDERLESS)
          </span>
        </div>

        <!-- Slot & Effect Controls (Right) -->
        <div class="lg:col-span-5 space-y-4">
          <!-- 1. Photo Effect Presets (PRD F-27) -->
          <div class="card-raw-elevated space-y-3 p-4 border-[4px] border-black bg-white shadow-[4px_4px_0px_0px_#000]">
            <div class="flex items-center justify-between pb-2 border-b-[3px] border-black">
              <h3 class="font-headline text-sm uppercase text-black">
                PILIH EFEK / FILTER FOTO
              </h3>
              <span class="font-mono text-[11px] text-black/60 uppercase">7 PRESET</span>
            </div>
            <div id="effects-selection-tray" class="flex flex-wrap gap-2"></div>
          </div>

          <!-- 2. Slot Retake Controls -->
          <div class="card-raw-elevated space-y-3 p-4 border-[4px] border-black bg-white shadow-[4px_4px_0px_0px_#000]">
            <h3 class="font-headline text-sm uppercase text-black pb-2 border-b-[3px] border-black">
              KOREKSI FOTO PER SLOT
            </h3>
            <p class="font-body text-xs text-black/70">
              Ulang foto jika belum pas (maksimal 1x per slot).
            </p>
            <div id="slots-review-list" class="space-y-2 max-h-[220px] overflow-y-auto pr-1"></div>
          </div>
        </div>
      </div>

      <!-- Footer Action -->
      <div class="mt-6 pt-4 border-t-[5px] border-black flex flex-col md:flex-row items-center justify-between gap-4">
        <div class="font-mono text-xs text-black/80">
          PASTIKAN EFEK & FOTO SUDAH SESUAI KEINGINANMU SEBELUM MENCETAK.
        </div>
        <button id="btn-confirm-print" class="btn-raw-primary min-h-[64px] px-12 text-xl font-headline w-full md:w-auto">
          LANJUT & CETAK FOTO
        </button>
      </div>
    `;

    parent.appendChild(container);

    canvasContainer = container.querySelector('#composite-canvas-container');
    slotsContainer = container.querySelector('#slots-review-list');
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
    renderSlotsList();
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
    if (confirmBtn && onConfirm) confirmBtn.removeEventListener('click', onConfirm);
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    container = null;
    canvasContainer = null;
    slotsContainer = null;
    effectsContainer = null;
    confirmBtn = null;
  }

  return { mount, unmount };
}

