/**
 * Template Editor & Management Screen (RawBlock Design System)
 * Handles template upload, auto slot detection, and slot manual correction.
 * PRD Reference: F-05, F-07, F-22, F-23
 */

import { api } from '../../shared/api.js';
import { detectTransparentSlots } from '../../shared/slot-detector.js';
import { CANVAS_SPECS } from '../../shared/constants.js';
import { getUniquePhotoCount, getSlotPhotoIndex } from '../../shared/composite.js';

export function createTemplateEditor({ onBack }) {
  let container = null;
  let fileInput = null;
  let previewCanvas = null;
  let slotsListContainer = null;
  let templateNameInput = null;
  let saveBtn = null;
  let addSlotBtn = null;
  let galleryContainer = null;

  let loadedBase64 = null;
  let detectedSlots = [];
  let currentImage = null;

  async function loadTemplateGallery() {
    if (!galleryContainer) return;
    try {
      const res = await api.getTemplates(true); // all=true
      const templates = res.data || [];

      if (templates.length === 0) {
        galleryContainer.innerHTML = `
          <div class="border-[3px] border-black bg-raw-sunken p-6 text-center">
            <p class="font-mono text-sm text-black/60">BELUM ADA TEMPLATE TERSIMPAN. UNGGAH TEMPLATE BARU DI ATAS.</p>
          </div>
        `;
        return;
      }

      galleryContainer.innerHTML = '';
      for (const tpl of templates) {
        const uniqueTakes = getUniquePhotoCount(tpl.slots);
        const card = document.createElement('div');
        card.className = 'card-raw flex flex-col justify-between gap-4';

        card.innerHTML = `
          <div>
            <div class="flex items-center justify-between pb-2 mb-2 border-b-[2px] border-black">
              <h4 class="font-headline text-base uppercase text-black truncate">${tpl.nama}</h4>
              <span class="chip-raw ${tpl.aktif ? 'chip-raw-active' : 'chip-raw-default'}">
                ${tpl.aktif ? 'AKTIF' : 'NON-AKTIF'}
              </span>
            </div>
            <div class="aspect-[2/3] bg-raw-sunken border-[2px] border-black overflow-hidden flex items-center justify-center mb-3">
              <img src="/templates/${tpl.file_png}" alt="${tpl.nama}" class="w-full h-full object-contain" />
            </div>
            <div class="font-mono text-xs text-black/80 space-y-1">
              <div>SLOT FOTO: <strong class="text-black">${tpl.jumlah_slot} SLOT</strong>${uniqueTakes < tpl.jumlah_slot ? ` <span class="text-black/60 font-bold">(${uniqueTakes}X FOTO)</span>` : ''}</div>
              <div>FILE: ${tpl.file_png}</div>
            </div>
          </div>

          <div class="flex items-center gap-2 pt-2 border-t-[2px] border-black">
            <button class="btn-toggle-aktif btn-raw-secondary flex-1 py-2 text-xs">
              ${tpl.aktif ? 'NONAKTIFKAN' : 'AKTIFKAN'}
            </button>
            <button class="btn-delete-tpl btn-raw-destructive px-3 py-2 text-xs">
              HAPUS
            </button>
          </div>
        `;

        // Toggle active
        card.querySelector('.btn-toggle-aktif').addEventListener('click', async () => {
          try {
            await api.updateTemplate(tpl.id, { aktif: !tpl.aktif });
            loadTemplateGallery();
          } catch (err) {
            alert('Gagal mengubah status: ' + err.message);
          }
        });

        // Delete template
        card.querySelector('.btn-delete-tpl').addEventListener('click', async () => {
          if (confirm(`Yakin ingin menghapus template "${tpl.nama}"?`)) {
            try {
              await api.deleteTemplate(tpl.id);
              loadTemplateGallery();
            } catch (err) {
              alert('Gagal menghapus template: ' + err.message);
            }
          }
        });

        galleryContainer.appendChild(card);
      }
    } catch (err) {
      console.error('[TemplateEditor] Gagal memuat galeri:', err);
    }
  }

  function drawEmptyPlaceholder() {
    if (!previewCanvas) return;
    const ctx = previewCanvas.getContext('2d');
    const width = previewCanvas.width || CANVAS_SPECS.WIDTH;
    const height = previewCanvas.height || CANVAS_SPECS.HEIGHT;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 6;
    ctx.setLineDash([20, 14]);
    ctx.strokeRect(24, 24, width - 48, height - 48);
    ctx.setLineDash([]);

    ctx.fillStyle = '#000000';
    ctx.font = 'bold 44px "Archivo Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TEMPLATE 4R', width / 2, height / 2 - 40);

    ctx.font = 'bold 22px "Space Mono", monospace';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillText('1200 × 1800 PX • 300 DPI', width / 2, height / 2 + 15);

    ctx.font = '20px "Work Sans", sans-serif';
    ctx.fillText('PILIH FILE PNG UNTUK MEMULAI', width / 2, height / 2 + 65);
  }

  function redrawCanvasWithSlots() {
    if (!previewCanvas) return;
    if (!currentImage) {
      drawEmptyPlaceholder();
      return;
    }
    const ctx = previewCanvas.getContext('2d');
    const width = previewCanvas.width;
    const height = previewCanvas.height;

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(currentImage, 0, 0, width, height);

    // Draw slot bounding boxes
    for (let i = 0; i < detectedSlots.length; i++) {
      const slot = detectedSlots[i];

      // Draw dashed slot rect
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 4;
      ctx.strokeRect(slot.x, slot.y, slot.w, slot.h);

      // Semi-transparent overlay to indicate cutout area
      ctx.fillStyle = 'rgba(255, 165, 0, 0.25)'; // RawBlock accent/warning tint
      ctx.fillRect(slot.x, slot.y, slot.w, slot.h);

      // Slot badge label
      const photoNum = getSlotPhotoIndex(slot, i);
      const badgeText = `SLOT ${i + 1} • FOTO ${photoNum}`;
      ctx.fillStyle = '#000000';
      ctx.fillRect(slot.x, slot.y, 210, 42);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 18px "Archivo Black", sans-serif';
      ctx.fillText(badgeText, slot.x + 12, slot.y + 28);
    }
  }

  function renderSlotsList() {
    if (!slotsListContainer) return;
    slotsListContainer.innerHTML = '';

    if (detectedSlots.length === 0) {
      slotsListContainer.innerHTML = `
        <p class="font-mono text-xs text-black/60 p-4 border-[2px] border-black bg-raw-sunken text-center">
          TIDAK ADA SLOT TERDETEKSI. SILAKAN UNGGAH TEMPLATE PNG ATAU TAMBAH MANUAL.
        </p>
      `;
      return;
    }

    detectedSlots.forEach((slot, index) => {
      const currentPhotoIdx = getSlotPhotoIndex(slot, index);
      const row = document.createElement('div');
      row.className = 'border-[3px] border-black bg-white p-3 space-y-2';

      row.innerHTML = `
        <div class="flex items-center justify-between pb-1 border-b-[2px] border-black">
          <span class="font-headline text-xs uppercase text-black">
            SLOT #${index + 1} <span class="slot-title-photo font-mono text-[11px] text-black/60">(FOTO #${currentPhotoIdx})</span>
          </span>
          <div class="flex gap-1">
            <button class="btn-move-up btn-raw-secondary px-2 py-1 text-xs" ${index === 0 ? 'disabled' : ''}>▲</button>
            <button class="btn-move-down btn-raw-secondary px-2 py-1 text-xs" ${index === detectedSlots.length - 1 ? 'disabled' : ''}>▼</button>
            <button class="btn-delete-slot btn-raw-destructive px-2 py-1 text-xs">✕</button>
          </div>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-5 gap-2 font-mono text-xs">
          <div>
            <label class="block text-[10px] uppercase font-bold text-black mb-0.5" title="Nomor jepretan foto yang akan mengisi slot ini">FOTO #</label>
            <input type="number" min="1" class="slot-photo-idx input-raw p-1 text-xs bg-raw-sunken font-bold text-black" value="${currentPhotoIdx}" />
          </div>
          <div>
            <label class="block text-[10px] uppercase font-bold text-black/60 mb-0.5">X</label>
            <input type="number" class="slot-x input-raw p-1 text-xs" value="${slot.x}" />
          </div>
          <div>
            <label class="block text-[10px] uppercase font-bold text-black/60 mb-0.5">Y</label>
            <input type="number" class="slot-y input-raw p-1 text-xs" value="${slot.y}" />
          </div>
          <div>
            <label class="block text-[10px] uppercase font-bold text-black/60 mb-0.5">W (LEBAR)</label>
            <input type="number" class="slot-w input-raw p-1 text-xs" value="${slot.w}" />
          </div>
          <div>
            <label class="block text-[10px] uppercase font-bold text-black/60 mb-0.5">H (TINGGI)</label>
            <input type="number" class="slot-h input-raw p-1 text-xs" value="${slot.h}" />
          </div>
        </div>
      `;

      // Live update on input change
      const updateInputs = () => {
        const photoInp = parseInt(row.querySelector('.slot-photo-idx').value, 10);
        slot.photo_index = Number.isFinite(photoInp) && photoInp > 0 ? photoInp : index + 1;
        slot.x = Number(row.querySelector('.slot-x').value) || 0;
        slot.y = Number(row.querySelector('.slot-y').value) || 0;
        slot.w = Number(row.querySelector('.slot-w').value) || 100;
        slot.h = Number(row.querySelector('.slot-h').value) || 100;

        const titlePhoto = row.querySelector('.slot-title-photo');
        if (titlePhoto) {
          titlePhoto.textContent = `(FOTO #${slot.photo_index})`;
        }
        redrawCanvasWithSlots();
      };

      row.querySelectorAll('input').forEach((inp) => inp.addEventListener('input', updateInputs));

      // Reordering
      row.querySelector('.btn-move-up').addEventListener('click', () => {
        if (index > 0) {
          const temp = detectedSlots[index - 1];
          detectedSlots[index - 1] = detectedSlots[index];
          detectedSlots[index] = temp;
          renderSlotsList();
          redrawCanvasWithSlots();
        }
      });

      row.querySelector('.btn-move-down').addEventListener('click', () => {
        if (index < detectedSlots.length - 1) {
          const temp = detectedSlots[index + 1];
          detectedSlots[index + 1] = detectedSlots[index];
          detectedSlots[index] = temp;
          renderSlotsList();
          redrawCanvasWithSlots();
        }
      });

      // Delete slot
      row.querySelector('.btn-delete-slot').addEventListener('click', () => {
        detectedSlots.splice(index, 1);
        renderSlotsList();
        redrawCanvasWithSlots();
      });

      slotsListContainer.appendChild(row);
    });
  }

  function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== 'image/png') {
      alert('Harap pilih berkas gambar berformat PNG!');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      loadedBase64 = event.target.result;

      const img = new Image();
      img.onload = () => {
        currentImage = img;
        previewCanvas.width = CANVAS_SPECS.WIDTH;
        previewCanvas.height = CANVAS_SPECS.HEIGHT;

        // Temporary canvas to extract ImageData
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = CANVAS_SPECS.WIDTH;
        tempCanvas.height = CANVAS_SPECS.HEIGHT;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(img, 0, 0, CANVAS_SPECS.WIDTH, CANVAS_SPECS.HEIGHT);

        const imgData = tempCtx.getImageData(0, 0, CANVAS_SPECS.WIDTH, CANVAS_SPECS.HEIGHT);

        // Run auto-detection algorithm
        detectedSlots = detectTransparentSlots(imgData, { scale: 4, minAreaFraction: 0.02 }).map((s, idx) => ({
          ...s,
          photo_index: idx + 1
        }));

        if (!templateNameInput.value) {
          templateNameInput.value = file.name.replace(/\.[^/.]+$/, '').toUpperCase();
        }

        renderSlotsList();
        redrawCanvasWithSlots();
      };
      img.src = loadedBase64;
    };
    reader.readAsDataURL(file);
  }

  async function handleSaveTemplate() {
    const name = templateNameInput?.value?.trim();
    if (!name) {
      alert('Nama template wajib diisi!');
      return;
    }
    if (!loadedBase64) {
      alert('Silakan pilih berkas PNG template terlebih dahulu!');
      return;
    }
    if (detectedSlots.length === 0) {
      if (!confirm('Template ini tidak memiliki slot foto. Tetap simpan?')) {
        return;
      }
    }

    try {
      saveBtn.disabled = true;
      saveBtn.textContent = 'MENYIMPAN...';

      await api.createTemplate({
        nama: name,
        file_png: loadedBase64,
        slots: detectedSlots,
        aktif: 1
      });

      alert('Template berhasil disimpan!');
      // Reset upload form
      loadedBase64 = null;
      currentImage = null;
      detectedSlots = [];
      templateNameInput.value = '';
      drawEmptyPlaceholder();
      renderSlotsList();

      // Refresh gallery
      loadTemplateGallery();
    } catch (err) {
      alert('Gagal menyimpan template: ' + err.message);
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'SIMPAN TEMPLATE';
      }
    }
  }

  function mount(parent) {
    container = document.createElement('div');
    container.className = 'space-y-8 font-body';

    container.innerHTML = `
      <!-- Sub-header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-[5px] border-black">
        <div>
          <h2 class="text-xl sm:text-2xl font-headline uppercase text-black">MANAJEMEN & EDITOR TEMPLATE</h2>
          <p class="font-body text-xs sm:text-sm text-black/70">UNGGAH PNG 4R (1200×1800 PX) &bull; DETEKSI LUBANG FOTO OTOMATIS &bull; KOREKSI SLOT</p>
        </div>
        <button id="btn-back" class="btn-raw-secondary px-6 py-2.5 text-xs font-headline self-start sm:self-auto">
          KEMBALI KE DASHBOARD
        </button>
      </div>

      <!-- Upload & Editor Workspace -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        <!-- Left: Upload & Interactive Canvas Preview 4R Full -->
        <div class="lg:col-span-5 xl:col-span-5 space-y-4">
          <div class="card-raw flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-white">
            <div class="flex-1 min-w-0">
              <label class="label-raw text-xs">PILIH FILE TEMPLATE PNG</label>
              <input type="file" id="file-upload" accept="image/png" class="font-mono text-xs cursor-pointer w-full mt-1" />
            </div>
            <span class="chip-raw chip-raw-warning text-[10px] self-start md:self-auto shrink-0">4R (1200×1800 PX)</span>
          </div>

          <!-- Canvas Preview 4R Full tanpa scroll -->
          <div class="border-[5px] border-black bg-raw-sunken p-4 sm:p-6 flex flex-col items-center justify-center">
            <canvas
              id="canvas-preview"
              width="1200"
              height="1800"
              class="aspect-[2/3] h-[520px] sm:h-[560px] lg:h-[600px] max-h-[calc(100vh-280px)] w-auto max-w-full border-[3px] border-black bg-white shadow-none block"
            ></canvas>
            <div class="mt-3 flex items-center justify-between w-full max-w-[400px] text-[11px] font-mono text-black/70">
              <span>FORMAT 4R (2:3)</span>
              <span>1200 × 1800 PX &bull; 300 DPI</span>
            </div>
          </div>
        </div>

        <!-- Right: Slot Controls & Form -->
        <div class="lg:col-span-7 xl:col-span-7 space-y-6">
          <div class="card-raw-elevated space-y-4 p-4 sm:p-6 bg-white">
            <h3 class="font-headline text-lg uppercase text-black pb-2 border-b-[3px] border-black">
              INFORMASI & SLOT FOTO
            </h3>

            <div>
              <label class="label-raw">NAMA TEMPLATE</label>
              <input type="text" id="template-name" placeholder="CONTOH: STRIP 4 FOTO RETRO" class="input-raw w-full" />
            </div>

            <!-- Slots list -->
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <label class="label-raw text-xs mb-0">DAFTAR KOREKSI SLOT</label>
                <button id="btn-add-slot" class="btn-raw-secondary px-3 py-1 text-xs font-headline cursor-pointer">
                  + TAMBAH SLOT MANUAL
                </button>
              </div>

              <div id="slots-list" class="space-y-2 max-h-[400px] overflow-y-auto pr-1"></div>
            </div>

            <div class="pt-4 border-t-[3px] border-black">
              <button id="btn-save-template" class="btn-raw-primary w-full py-4 text-base font-headline cursor-pointer">
                SIMPAN TEMPLATE
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Template Gallery Section -->
      <section class="space-y-4 pt-6 border-t-[5px] border-black">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 class="font-headline text-lg sm:text-xl uppercase text-black">GALERI TEMPLATE TERSIMPAN</h3>
          <span class="font-mono text-xs text-black/60">HANYA TEMPLATE AKTIF YANG MUNCUL DI KIOSK</span>
        </div>
        <div id="template-gallery" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6"></div>
      </section>
    `;

    parent.appendChild(container);

    fileInput = container.querySelector('#file-upload');
    previewCanvas = container.querySelector('#canvas-preview');
    slotsListContainer = container.querySelector('#slots-list');
    templateNameInput = container.querySelector('#template-name');
    saveBtn = container.querySelector('#btn-save-template');
    addSlotBtn = container.querySelector('#btn-add-slot');
    galleryContainer = container.querySelector('#template-gallery');

    const backBtn = container.querySelector('#btn-back');
    if (backBtn && onBack) {
      backBtn.addEventListener('click', onBack);
    }

    if (fileInput) {
      fileInput.addEventListener('change', handleFileUpload);
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', handleSaveTemplate);
    }

    if (addSlotBtn) {
      addSlotBtn.addEventListener('click', () => {
        // Add a default centered slot
        detectedSlots.push({
          x: 100,
          y: 100 + detectedSlots.length * 200,
          w: 500,
          h: 380,
          photo_index: detectedSlots.length + 1
        });
        renderSlotsList();
        redrawCanvasWithSlots();
      });
    }

    drawEmptyPlaceholder();
    renderSlotsList();
    loadTemplateGallery();
  }

  function unmount() {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    container = null;
    fileInput = null;
    previewCanvas = null;
    slotsListContainer = null;
    templateNameInput = null;
    saveBtn = null;
    addSlotBtn = null;
    galleryContainer = null;
  }

  return { mount, unmount };
}

