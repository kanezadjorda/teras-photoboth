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
          <div class="border border-[#E5E5E5] bg-[#FAFAFA] p-6 text-center">
            <p class="font-mono text-xs text-[#737373]">BELUM ADA TEMPLATE TERSIMPAN. UNGGAH TEMPLATE BARU DI ATAS.</p>
          </div>
        `;
        return;
      }

      galleryContainer.innerHTML = '';
      for (const tpl of templates) {
        const uniqueTakes = getUniquePhotoCount(tpl.slots);
        const card = document.createElement('div');
        card.className = 'card-sb flex flex-col justify-between gap-4 p-4 bg-white border border-[#E5E5E5]';

        card.innerHTML = `
          <div>
            <div class="flex items-center justify-between pb-2 mb-2 border-b border-[#E5E5E5]">
              <h4 class="font-mono text-xs uppercase font-medium text-[#0A0A0A] truncate">${tpl.nama}</h4>
              <span class="chip-sb text-[10px] ${tpl.aktif ? 'border border-[#2BB673]/40 text-[#0A0A0A] bg-[#2BB673]/10' : 'border border-[#E5E5E5] text-[#737373]'}">
                ${tpl.aktif ? 'AKTIF' : 'NON-AKTIF'}
              </span>
            </div>
            <div class="aspect-[2/3] bg-[#FAFAFA] border border-[#E5E5E5] overflow-hidden flex items-center justify-center mb-3">
              <img src="/templates/${tpl.file_png}" alt="${tpl.nama}" class="w-full h-full object-contain" />
            </div>
            <div class="font-mono text-xs text-[#737373] space-y-1">
              <div>SLOT FOTO: <strong class="text-[#0A0A0A]">${tpl.jumlah_slot} SLOT</strong>${uniqueTakes < tpl.jumlah_slot ? ` <span class="text-[#737373] font-medium">(${uniqueTakes}X FOTO)</span>` : ''}</div>
              <div class="truncate text-[11px]">FILE: ${tpl.file_png}</div>
            </div>
          </div>

          <div class="flex items-center gap-2 pt-2 border-t border-[#E5E5E5]">
            <button class="btn-toggle-aktif btn-sb-secondary flex-1 py-1.5 text-xs font-mono uppercase">
              ${tpl.aktif ? 'NONAKTIFKAN' : 'AKTIFKAN'}
            </button>
            <button class="btn-delete-tpl btn-sb-destructive px-3 py-1.5 text-xs font-mono uppercase">
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

    ctx.fillStyle = '#FAFAFA';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#D4D4D8';
    ctx.lineWidth = 2;
    ctx.setLineDash([12, 8]);
    ctx.strokeRect(32, 32, width - 64, height - 64);
    ctx.setLineDash([]);

    ctx.fillStyle = '#0A0A0A';
    ctx.font = '600 36px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TEMPLATE 4R', width / 2, height / 2 - 35);

    ctx.font = '500 18px "IBM Plex Mono", monospace';
    ctx.fillStyle = '#737373';
    ctx.fillText('1200 × 1800 PX • 300 DPI', width / 2, height / 2 + 15);

    ctx.font = '400 16px "Inter", sans-serif';
    ctx.fillText('PILIH FILE PNG UNTUK MEMULAI', width / 2, height / 2 + 55);
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

      // Draw subtle slot rect
      ctx.strokeStyle = '#0A0A0A';
      ctx.lineWidth = 2;
      ctx.strokeRect(slot.x, slot.y, slot.w, slot.h);

      // Semi-transparent overlay to indicate cutout area
      ctx.fillStyle = 'rgba(10, 10, 10, 0.08)';
      ctx.fillRect(slot.x, slot.y, slot.w, slot.h);

      // Slot badge label
      const photoNum = getSlotPhotoIndex(slot, i);
      const badgeText = `SLOT ${i + 1} • FOTO ${photoNum}`;
      ctx.fillStyle = '#0A0A0A';
      ctx.fillRect(slot.x, slot.y, 200, 36);

      ctx.fillStyle = '#FAFAFA';
      ctx.font = '500 14px "IBM Plex Mono", monospace';
      ctx.fillText(badgeText, slot.x + 10, slot.y + 23);
    }
  }

  function renderSlotsList() {
    if (!slotsListContainer) return;
    slotsListContainer.innerHTML = '';

    if (detectedSlots.length === 0) {
      slotsListContainer.innerHTML = `
        <p class="font-mono text-xs text-[#737373] p-4 border border-[#E5E5E5] bg-[#FAFAFA] text-center">
          TIDAK ADA SLOT TERDETEKSI. SILAKAN UNGGAH TEMPLATE PNG ATAU TAMBAH MANUAL.
        </p>
      `;
      return;
    }

    detectedSlots.forEach((slot, index) => {
      const currentPhotoIdx = getSlotPhotoIndex(slot, index);
      const row = document.createElement('div');
      row.className = 'border border-[#E5E5E5] bg-white p-3 space-y-2';

      row.innerHTML = `
        <div class="flex items-center justify-between pb-1 border-b border-[#E5E5E5]">
          <span class="font-mono text-xs uppercase font-medium text-[#0A0A0A]">
            SLOT #${index + 1} <span class="slot-title-photo text-[#737373] text-[11px]">(FOTO #${currentPhotoIdx})</span>
          </span>
          <div class="flex gap-1">
            <button class="btn-move-up btn-sb-secondary px-2 py-0.5 text-xs font-mono" ${index === 0 ? 'disabled' : ''}>▲</button>
            <button class="btn-move-down btn-sb-secondary px-2 py-0.5 text-xs font-mono" ${index === detectedSlots.length - 1 ? 'disabled' : ''}>▼</button>
            <button class="btn-delete-slot btn-sb-destructive px-2 py-0.5 text-xs font-mono">✕</button>
          </div>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-5 gap-2 font-mono text-xs">
          <div>
            <label class="block text-[10px] uppercase font-medium text-[#737373] mb-0.5" title="Nomor jepretan foto yang akan mengisi slot ini">FOTO #</label>
            <input type="number" min="1" class="slot-photo-idx input-sb p-1 text-xs bg-[#FAFAFA] font-medium text-[#0A0A0A]" value="${currentPhotoIdx}" />
          </div>
          <div>
            <label class="block text-[10px] uppercase text-[#737373] mb-0.5">X</label>
            <input type="number" class="slot-x input-sb p-1 text-xs" value="${slot.x}" />
          </div>
          <div>
            <label class="block text-[10px] uppercase text-[#737373] mb-0.5">Y</label>
            <input type="number" class="slot-y input-sb p-1 text-xs" value="${slot.y}" />
          </div>
          <div>
            <label class="block text-[10px] uppercase text-[#737373] mb-0.5">W (LEBAR)</label>
            <input type="number" class="slot-w input-sb p-1 text-xs" value="${slot.w}" />
          </div>
          <div>
            <label class="block text-[10px] uppercase text-[#737373] mb-0.5">H (TINGGI)</label>
            <input type="number" class="slot-h input-sb p-1 text-xs" value="${slot.h}" />
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
    container.className = 'space-y-8 font-sans';

    container.innerHTML = `
      <!-- Sub-header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E5E5E5]">
        <div>
          <h2 class="text-h3 font-semibold uppercase text-[#0A0A0A]">MANAJEMEN & EDITOR TEMPLATE</h2>
          <p class="text-caption font-mono uppercase text-[#737373]">UNGGAH PNG 4R (1200×1800 PX) &bull; DETEKSI LUBANG FOTO OTOMATIS &bull; KOREKSI SLOT</p>
        </div>
        <button id="btn-back" class="btn-sb-secondary px-5 py-2 text-xs font-mono uppercase tracking-wider self-start sm:self-auto">
          KEMBALI KE DASHBOARD
        </button>
      </div>

      <!-- Upload & Editor Workspace -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        <!-- Left: Upload & Interactive Canvas Preview 4R Full -->
        <div class="lg:col-span-5 xl:col-span-5 space-y-4">
          <div class="card-sb flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-white border border-[#E5E5E5]">
            <div class="flex-1 min-w-0">
              <label class="block text-caption font-mono uppercase text-[#737373] mb-1">PILIH FILE TEMPLATE PNG</label>
              <input type="file" id="file-upload" accept="image/png" class="font-mono text-xs cursor-pointer w-full mt-1" />
            </div>
            <span class="chip-sb text-[10px] self-start md:self-auto shrink-0 border border-[#E5E5E5] text-[#737373]">4R (1200×1800 PX)</span>
          </div>

          <!-- Canvas Preview 4R Full tanpa scroll -->
          <div class="border border-[#E5E5E5] bg-[#FAFAFA] p-4 sm:p-6 flex flex-col items-center justify-center">
            <canvas
              id="canvas-preview"
              width="1200"
              height="1800"
              class="aspect-[2/3] h-[520px] sm:h-[560px] lg:h-[600px] max-h-[calc(100vh-280px)] w-auto max-w-full border border-[#D4D4D8] bg-white block"
            ></canvas>
            <div class="mt-3 flex items-center justify-between w-full max-w-[400px] text-[11px] font-mono text-[#737373]">
              <span>FORMAT 4R (2:3)</span>
              <span>1200 × 1800 PX &bull; 300 DPI</span>
            </div>
          </div>
        </div>

        <!-- Right: Slot Controls & Form -->
        <div class="lg:col-span-7 xl:col-span-7 space-y-6">
          <div class="card-sb space-y-4 p-6 bg-white border border-[#E5E5E5]">
            <h3 class="text-body font-semibold uppercase text-[#0A0A0A] pb-3 border-b border-[#E5E5E5]">
              INFORMASI & SLOT FOTO
            </h3>

            <div>
              <label class="block text-caption font-mono uppercase text-[#737373] mb-1">NAMA TEMPLATE</label>
              <input type="text" id="template-name" placeholder="CONTOH: STRIP 4 FOTO RETRO" class="input-sb w-full font-mono text-xs" />
            </div>

            <!-- Slots list -->
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <label class="block text-caption font-mono uppercase text-[#737373] mb-0">DAFTAR KOREKSI SLOT</label>
                <button id="btn-add-slot" class="btn-sb-secondary px-3 py-1 text-xs font-mono uppercase tracking-wider cursor-pointer">
                  + TAMBAH SLOT MANUAL
                </button>
              </div>

              <div id="slots-list" class="space-y-2 max-h-[400px] overflow-y-auto pr-1"></div>
            </div>

            <div class="pt-4 border-t border-[#E5E5E5]">
              <button id="btn-save-template" class="btn-sb-primary w-full py-3 text-xs font-mono uppercase tracking-wider cursor-pointer">
                SIMPAN TEMPLATE
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Template Gallery Section -->
      <section class="space-y-4 pt-6 border-t border-[#E5E5E5]">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 class="text-h3 font-semibold uppercase text-[#0A0A0A]">GALERI TEMPLATE TERSIMPAN</h3>
          <span class="font-mono text-xs text-[#737373]">HANYA TEMPLATE AKTIF YANG MUNCUL DI KIOSK</span>
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

