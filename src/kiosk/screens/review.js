/**
 * Review Screen for Kiosk (RawBlock Design System)
 * Displays composite print preview and provides 1x retake per slot.
 * PRD Reference: F-10, F-11
 */

import { renderComposite, loadImage } from '../../shared/composite.js';
import { DEFAULTS, CANVAS_SPECS } from '../../shared/constants.js';
import { preventDoubleClick } from '../../shared/ui.js';

export function createReviewScreen({
  template,
  photos = [],
  retakeCounts = {},
  onConfirm,
  onRetakeSlot,
  onCancel
}) {
  let container = null;
  let canvasContainer = null;
  let slotsContainer = null;
  let confirmBtn = null;
  let cancelBtn = null;
  let compositeCanvas = null;

  async function generateCompositePreview() {
    if (!canvasContainer) return;
    try {
      canvasContainer.innerHTML = `
        <div class="font-mono text-xs text-black p-8 text-center animate-pulse">
          MEMPROSES KOMPOSIT FOTO 4R (300 DPI)...
        </div>
      `;

      // Load template overlay PNG
      let templateImg = null;
      if (template?.file_png) {
        templateImg = await loadImage(`/templates/${template.file_png}`).catch((err) => {
          console.warn('[Review] Gagal memuat overlay PNG template:', err);
          return null;
        });
      }

      // Load all photo images
      const loadedPhotos = await Promise.all(
        photos.map((src) => (src ? loadImage(src) : null))
      );

      compositeCanvas = renderComposite({
        canvasWidth: CANVAS_SPECS.WIDTH,
        canvasHeight: CANVAS_SPECS.HEIGHT,
        templateImage: templateImg,
        slots: template?.slots || [],
        photos: loadedPhotos
      });

      compositeCanvas.className =
        'max-h-[68vh] w-auto border-[5px] border-black bg-white shadow-none object-contain';

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

  function renderSlotsList() {
    if (!slotsContainer) return;
    slotsContainer.innerHTML = '';

    const maxRetakes = DEFAULTS.MAX_RETAKES_PER_SLOT || 1;

    for (let i = 0; i < (template?.slots?.length || photos.length); i++) {
      const slotCard = document.createElement('div');
      slotCard.className = 'border-[3px] border-black bg-white p-3 flex items-center justify-between gap-3';

      const photoSrc = photos[i];
      const retakeCount = retakeCounts[i] || 0;
      const canRetake = retakeCount < maxRetakes;

      slotCard.innerHTML = `
        <div class="flex items-center gap-3">
          <div class="w-16 h-20 border-[2px] border-black bg-raw-sunken overflow-hidden flex items-center justify-center">
            ${
              photoSrc
                ? `<img src="${photoSrc}" alt="Foto ${i + 1}" class="w-full h-full object-cover" />`
                : `<span class="font-mono text-xs text-black/50">KOSONG</span>`
            }
          </div>
          <div>
            <h4 class="font-headline text-sm uppercase text-black">SLOT FOTO #${i + 1}</h4>
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
        <button id="btn-cancel-review" class="btn-raw-destructive px-5 py-2.5 text-xs font-headline">
          BATALKAN SESI
        </button>
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

        <!-- Slot Retake Controls -->
        <div class="lg:col-span-5 space-y-4">
          <div class="card-raw-elevated space-y-4">
            <h3 class="font-headline text-base uppercase text-black pb-2 border-b-[3px] border-black">
              KOREKSI FOTO PER SLOT
            </h3>
            <p class="font-body text-xs text-black/70">
              Jika ada foto yang kurang pas, tekan tombol di bawah untuk mengambil foto ulang pada slot tersebut.
            </p>
            <div id="slots-review-list" class="space-y-2 max-h-[380px] overflow-y-auto pr-1"></div>
          </div>
        </div>
      </div>

      <!-- Footer Action -->
      <div class="mt-6 pt-4 border-t-[5px] border-black flex flex-col md:flex-row items-center justify-between gap-4">
        <div class="font-mono text-xs text-black/80">
          PASTIKAN SEMUA FOTO SUDAH SESUAI KEINGINANMU SEBELUM MENCETAK.
        </div>
        <button id="btn-confirm-print" class="btn-raw-primary min-h-[64px] px-12 text-xl font-headline w-full md:w-auto">
          LANJUT & CETAK FOTO
        </button>
      </div>
    `;

    parent.appendChild(container);

    canvasContainer = container.querySelector('#composite-canvas-container');
    slotsContainer = container.querySelector('#slots-review-list');
    confirmBtn = container.querySelector('#btn-confirm-print');
    cancelBtn = container.querySelector('#btn-cancel-review');

    if (confirmBtn && onConfirm) {
      const clickHandler = preventDoubleClick(confirmBtn, async () => {
        const compositeDataUrl = compositeCanvas ? compositeCanvas.toDataURL('image/jpeg', 0.95) : null;
        await onConfirm({ photos, compositeDataUrl });
      }, 'MENYIAPKAN CETAKAN...');
      confirmBtn.addEventListener('click', clickHandler);
    }

    if (cancelBtn && onCancel) {
      cancelBtn.addEventListener('click', onCancel);
    }

    renderSlotsList();
    generateCompositePreview();
  }

  function unmount() {
    if (confirmBtn && onConfirm) confirmBtn.removeEventListener('click', onConfirm);
    if (cancelBtn && onCancel) cancelBtn.removeEventListener('click', onCancel);
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    container = null;
    canvasContainer = null;
    slotsContainer = null;
    confirmBtn = null;
    cancelBtn = null;
  }

  return { mount, unmount };
}

