/**
 * Capture Screen for Kiosk (RawBlock Design System)
 * Handles live preview (mirrored), 3-2-1 countdown, shutter flash, quick preview, and retake mode.
 * PRD Reference: F-08, F-09, F-06, F-10
 */

import { cameraService, captureFrame } from '../../shared/camera.js';
import { TIMEOUTS } from '../../shared/constants.js';
import { getUniquePhotoCount } from '../../shared/composite.js';

export function createCaptureScreen({
  template,
  countdownSeconds = TIMEOUTS.COUNTDOWN_SECONDS || 3,
  retakeSlotIndex = undefined,
  existingPhotos = [],
  onCaptureComplete
}) {
  let container = null;
  let videoElement = null;
  let countdownOverlay = null;
  let countdownNumber = null;
  let flashOverlay = null;
  let previewOverlay = null;
  let previewImage = null;
  let previewText = null;
  let triggerBtn = null;
  let thumbnailTray = null;
  let slotIndicator = null;

  let stream = null;
  let countdownTimer = null;
  let isCapturing = false;

  const isRetakeMode = retakeSlotIndex !== undefined;
  const totalPhotos = getUniquePhotoCount(template?.slots);
  let currentSlotIndex = isRetakeMode ? retakeSlotIndex : 0;
  const capturedPhotos = [...existingPhotos];

  function updateSlotIndicator() {
    if (!slotIndicator) return;
    if (isRetakeMode) {
      slotIndicator.textContent = `MENGULANG FOTO #${currentSlotIndex + 1}`;
    } else {
      slotIndicator.textContent = `FOTO ${currentSlotIndex + 1} DARI ${totalPhotos}`;
    }
  }

  function renderThumbnails() {
    if (!thumbnailTray) return;
    thumbnailTray.innerHTML = '';
    for (let i = 0; i < totalPhotos; i++) {
      const thumb = document.createElement('div');
      thumb.className =
        'w-20 h-24 border-[3px] border-black bg-raw-sunken flex items-center justify-center overflow-hidden';

      if (capturedPhotos[i]) {
        thumb.innerHTML = `<img src="${capturedPhotos[i]}" alt="Foto ${i + 1}" class="w-full h-full object-cover" />`;
      } else if (i === currentSlotIndex) {
        thumb.innerHTML = `<span class="font-headline text-xs text-black border-b-[2px] border-black">AKTIF</span>`;
      } else {
        thumb.innerHTML = `<span class="font-mono text-xs text-black/40">#${i + 1}</span>`;
      }
      thumbnailTray.appendChild(thumb);
    }
  }

  function triggerShutterFlash() {
    if (!flashOverlay) return;
    flashOverlay.classList.remove('hidden');
    setTimeout(() => {
      if (flashOverlay) {
        flashOverlay.classList.add('hidden');
      }
    }, 100);
  }

  function showQuickPreview(photoData, slotNum, onDone) {
    if (!previewOverlay || !previewImage) {
      onDone();
      return;
    }

    previewImage.src = photoData;
    if (previewText) {
      previewText.textContent = `FOTO #${slotNum} TERSIMPAN!`;
    }
    previewOverlay.classList.remove('hidden');

    setTimeout(() => {
      if (previewOverlay) {
        previewOverlay.classList.add('hidden');
      }
      onDone();
    }, 1500); // 1.5s quick preview per Task 3.2
  }

  function takePhoto() {
    if (isCapturing || !videoElement) return;
    isCapturing = true;
    if (triggerBtn) triggerBtn.disabled = true;

    let count = countdownSeconds;
    if (countdownOverlay && countdownNumber) {
      countdownNumber.textContent = count;
      countdownOverlay.classList.remove('hidden');
    }

    countdownTimer = setInterval(() => {
      count--;
      if (count > 0) {
        if (countdownNumber) countdownNumber.textContent = count;
      } else {
        clearInterval(countdownTimer);
        countdownTimer = null;
        if (countdownOverlay) countdownOverlay.classList.add('hidden');

        // Shutter flash & frame capture
        triggerShutterFlash();
        try {
          const photoData = captureFrame(videoElement, { mirror: true });

          if (isRetakeMode) {
            capturedPhotos[retakeSlotIndex] = photoData;
          } else {
            capturedPhotos.push(photoData);
          }

          renderThumbnails();

          // 1.5s quick preview
          showQuickPreview(photoData, currentSlotIndex + 1, () => {
            if (isRetakeMode) {
              // Finish retake
              cleanupCamera();
              if (onCaptureComplete) {
                onCaptureComplete(photoData, retakeSlotIndex);
              }
            } else {
              currentSlotIndex++;
              if (currentSlotIndex < totalPhotos) {
                updateSlotIndicator();
                isCapturing = false;
                if (triggerBtn) triggerBtn.disabled = false;
              } else {
                // Selesai seluruh jepretan foto
                cleanupCamera();
                if (onCaptureComplete) {
                  onCaptureComplete(capturedPhotos);
                }
              }
            }
          });
        } catch (err) {
          console.error('[Capture] Gagal mengambil frame foto:', err);
          isCapturing = false;
          if (triggerBtn) triggerBtn.disabled = false;
        }
      }
    }, 1000);
  }

  async function initCamera() {
    try {
      // Reuses the singleton MediaStream already active from Welcome (PRD F-25)
      stream = await cameraService.start();
      if (videoElement && stream) {
        videoElement.srcObject = stream;
        await videoElement.play().catch(() => {});
      }
    } catch (err) {
      console.error('[Capture] Gagal menginisialisasi kamera:', err);
      if (container) {
        const errorBanner = container.querySelector('#camera-error-banner');
        if (errorBanner) {
          errorBanner.classList.remove('hidden');
          errorBanner.textContent = 'KAMERA TIDAK TERDETEKSI. PERIKSA SAMBUNGAN PERANGKAT.';
        }
      }
    }
  }

  function cleanupCamera() {
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
    // Do NOT stop singleton stream tracks, detach element srcObject only (PRD F-25)
    if (videoElement) {
      videoElement.srcObject = null;
    }
    stream = null;
  }

  function mount(parent) {
    container = document.createElement('div');
    container.className =
      'flex flex-col justify-between w-full h-screen max-w-none px-6 py-4 box-border font-body bg-white overflow-hidden';

    container.innerHTML = `
      <!-- Header -->
      <div class="w-full flex items-center justify-between border-b-[5px] border-black pb-3 shrink-0">
        <div>
          <h1 id="slot-indicator" class="text-3xl md:text-4xl font-headline uppercase text-black">
            ${isRetakeMode ? `MENGULANG FOTO #${retakeSlotIndex + 1}` : `FOTO 1 DARI ${totalPhotos}`}
          </h1>
          <p class="font-body text-xs text-black/70">
            ${
              isRetakeMode
                ? 'AMBIL FOTO PENGGANTI UNTUK SLOT INI &bull; HANYA 1X KESEMPATAN'
                : 'BERPOSISILAH DI TENGAH BINGKAI KAMERA &bull; SENYUM TERBAIKMU'
            }
          </p>
        </div>
        <div class="flex items-center gap-3">
          <span class="chip-raw chip-raw-active">KAMERA AKTIF</span>
        </div>
      </div>

      <!-- Error Banner (Hidden by default) -->
      <div id="camera-error-banner" class="hidden w-full bg-raw-error text-white font-headline text-center p-3 mb-2 border-[3px] border-black"></div>

      <!-- Video Viewport Frame: Flexible & Expanding to Available Viewport Space -->
      <div class="flex-1 w-full min-h-0 py-2 flex items-center justify-center overflow-hidden">
        <div class="relative h-full max-w-full aspect-[16/9] border-[5px] border-black bg-black flex items-center justify-center overflow-hidden">
          <video id="camera-video" autoplay playsinline muted class="w-full h-full object-cover -scale-x-100"></video>

          <!-- Countdown Overlay: Pure bright typography without box/backdrop -->
          <div id="countdown-overlay" class="hidden absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <span id="countdown-number" class="font-headline text-[180px] md:text-[240px] text-white drop-shadow-[0_10px_24px_rgba(0,0,0,0.95)] leading-none select-none tracking-normal">3</span>
          </div>

          <!-- 1.5s Quick Preview Overlay -->
          <div id="preview-overlay" class="hidden absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-25 p-4 space-y-3">
            <div class="border-[5px] border-black bg-white p-2 max-h-[70%] aspect-video overflow-hidden">
              <img id="preview-image" src="" alt="Pratinjau" class="w-full h-full object-contain" />
            </div>
            <p id="preview-text" class="font-headline text-xl text-white uppercase tracking-wider">
              FOTO TERSIMPAN!
            </p>
          </div>

          <!-- Shutter Flash Effect -->
          <div id="flash-overlay" class="hidden absolute inset-0 bg-white z-30 pointer-events-none"></div>
        </div>
      </div>

      <!-- Bottom Controls & Thumbnails -->
      <div class="w-full flex items-center justify-between pt-3 border-t-[3px] border-black gap-6 shrink-0">
        <!-- Thumbnail Slot Tray -->
        <div id="thumbnail-tray" class="flex items-center gap-3"></div>

        <!-- Action Button -->
        <button id="btn-trigger-photo" class="btn-raw-primary min-h-[64px] px-10 text-xl font-headline cursor-pointer">
          ${isRetakeMode ? 'AMBIL FOTO PENGGANTI' : 'AMBIL FOTO'}
        </button>
      </div>
    `;

    parent.appendChild(container);

    videoElement = container.querySelector('#camera-video');
    countdownOverlay = container.querySelector('#countdown-overlay');
    countdownNumber = container.querySelector('#countdown-number');
    flashOverlay = container.querySelector('#flash-overlay');
    previewOverlay = container.querySelector('#preview-overlay');
    previewImage = container.querySelector('#preview-image');
    previewText = container.querySelector('#preview-text');
    triggerBtn = container.querySelector('#btn-trigger-photo');
    thumbnailTray = container.querySelector('#thumbnail-tray');
    slotIndicator = container.querySelector('#slot-indicator');

    updateSlotIndicator();
    renderThumbnails();

    if (triggerBtn) {
      triggerBtn.addEventListener('click', takePhoto);
    }

    initCamera();
  }

  function unmount() {
    cleanupCamera();
    if (triggerBtn) triggerBtn.removeEventListener('click', takePhoto);
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    container = null;
    videoElement = null;
    triggerBtn = null;
  }

  return { mount, unmount };
}
