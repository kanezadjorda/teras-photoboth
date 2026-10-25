/**
 * Capture Screen for Kiosk (RawBlock Design System)
 * Handles per-shot sub-state lifecycle (PRD F-10):
 *   live -> countdown -> reviewing_shot
 *
 * Unlimited retake per photo before saving to disk.
 * Continue / Selesai saves photo via idempotent API and advances.
 * PRD Reference: F-08, F-09, F-06, F-10, F-25
 */

import { cameraService, captureFrame } from '../../shared/camera.js';
import { TIMEOUTS } from '../../shared/constants.js';
import { getUniquePhotoCount } from '../../shared/composite.js';
import { createCaptureStateMachine, CAPTURE_SUB_STATES } from '../../shared/capture-state.js';
import { api } from '../../shared/api.js';

export function createCaptureScreen({
  session = null,
  template,
  countdownSeconds = TIMEOUTS.COUNTDOWN_SECONDS || 3,
  existingPhotos = [],
  onCaptureComplete,
  // Backward-compatible fallback for legacy calls:
  retakeSlotIndex = undefined
}) {
  let container = null;
  let videoElement = null;
  let previewOverlay = null;
  let previewImage = null;
  let previewText = null;
  let countdownOverlay = null;
  let countdownNumber = null;
  let flashOverlay = null;
  let slotIndicator = null;
  let slotSubtext = null;
  let cameraChip = null;
  let cameraErrorBanner = null;

  let liveActions = null;
  let reviewActions = null;
  let triggerBtn = null;
  let retakeBtn = null;
  let continueBtn = null;
  let thumbnailTray = null;

  let stream = null;
  let countdownTimer = null;
  let isSaving = false;

  const totalPhotos = getUniquePhotoCount(template?.slots);

  // Initialize pure state machine
  const stateMachine = createCaptureStateMachine({
    totalPhotos,
    initialPhotos: existingPhotos,
    onComplete: (allPhotos) => {
      cleanupCamera();
      if (typeof onCaptureComplete === 'function') {
        onCaptureComplete(allPhotos);
      }
    }
  });

  function updateHeaderUI() {
    const currentIdx = stateMachine.getCurrentShotIndex();
    const subState = stateMachine.getSubState();

    if (slotIndicator) {
      slotIndicator.textContent = `FOTO ${currentIdx + 1} DARI ${totalPhotos}`;
    }

    if (slotSubtext) {
      if (subState === CAPTURE_SUB_STATES.REVIEWING_SHOT) {
        slotSubtext.textContent = 'PERIKSA HASIL FOTO \u2022 PILIH ULANGI ATAU LANJUT';
      } else if (subState === CAPTURE_SUB_STATES.COUNTDOWN) {
        slotSubtext.textContent = 'BERSIAP-SIAP... SENYUM TERBAIKMU!';
      } else {
        slotSubtext.textContent = 'BERPOSISILAH DI TENGAH BINGKAI KAMERA \u2022 SENYUM TERBAIKMU';
      }
    }

    if (cameraChip) {
      if (subState === CAPTURE_SUB_STATES.REVIEWING_SHOT) {
        cameraChip.textContent = 'PRATINJAU HASIL';
        cameraChip.className = 'chip-raw chip-raw-warning';
      } else {
        cameraChip.textContent = 'KAMERA AKTIF';
        cameraChip.className = 'chip-raw chip-raw-active';
      }
    }
  }

  function renderThumbnails() {
    if (!thumbnailTray) return;
    thumbnailTray.innerHTML = '';

    const currentIdx = stateMachine.getCurrentShotIndex();
    const acceptedPhotos = stateMachine.getAcceptedPhotos();
    const subState = stateMachine.getSubState();
    const pendingShot = stateMachine.getPendingShot();

    for (let i = 0; i < totalPhotos; i++) {
      const thumb = document.createElement('div');
      thumb.className =
        'w-16 h-20 md:w-20 md:h-24 border-[3px] border-black bg-raw-sunken flex items-center justify-center overflow-hidden shrink-0';

      if (acceptedPhotos[i]) {
        thumb.innerHTML = `<img src="${acceptedPhotos[i]}" alt="Foto ${i + 1}" class="w-full h-full object-cover" />`;
      } else if (i === currentIdx) {
        if (subState === CAPTURE_SUB_STATES.REVIEWING_SHOT && pendingShot) {
          thumb.innerHTML = `<img src="${pendingShot}" alt="Review ${i + 1}" class="w-full h-full object-cover opacity-80" />`;
          thumb.classList.add('border-black', 'bg-amber-100');
        } else {
          thumb.innerHTML = `<span class="font-headline text-xs text-black border-b-[2px] border-black">AKTIF</span>`;
          thumb.classList.add('bg-white');
        }
      } else {
        thumb.innerHTML = `<span class="font-mono text-xs text-black/40">#${i + 1}</span>`;
      }

      thumbnailTray.appendChild(thumb);
    }
  }

  function syncViewWithSubState() {
    const subState = stateMachine.getSubState();

    updateHeaderUI();
    renderThumbnails();

    if (subState === CAPTURE_SUB_STATES.LIVE) {
      // Show live video, hide captured photo
      if (videoElement) videoElement.classList.remove('hidden');
      if (previewImage) {
        previewImage.classList.add('hidden');
        previewImage.src = '';
      }
      if (countdownOverlay) countdownOverlay.classList.add('hidden');

      // Controls
      if (liveActions) liveActions.classList.remove('hidden');
      if (reviewActions) reviewActions.classList.add('hidden');
      if (triggerBtn) {
        triggerBtn.disabled = false;
        triggerBtn.textContent = 'AMBIL FOTO';
      }
    } else if (subState === CAPTURE_SUB_STATES.COUNTDOWN) {
      if (videoElement) videoElement.classList.remove('hidden');
      if (previewImage) previewImage.classList.add('hidden');
      if (countdownOverlay) countdownOverlay.classList.remove('hidden');

      if (liveActions) liveActions.classList.remove('hidden');
      if (reviewActions) reviewActions.classList.add('hidden');
      if (triggerBtn) triggerBtn.disabled = true;
    } else if (subState === CAPTURE_SUB_STATES.REVIEWING_SHOT) {
      // Freeze preview: hide video, show captured shot at exact preview dimensions
      const pending = stateMachine.getPendingShot();
      if (videoElement) videoElement.classList.add('hidden');
      if (previewImage) {
        previewImage.src = pending || '';
        previewImage.classList.remove('hidden');
      }
      if (countdownOverlay) countdownOverlay.classList.add('hidden');

      // Controls: Show Ulangi & Lanjut / Selesai
      if (liveActions) liveActions.classList.add('hidden');
      if (reviewActions) reviewActions.classList.remove('hidden');

      if (retakeBtn) {
        retakeBtn.disabled = false;
      }
      if (continueBtn) {
        continueBtn.disabled = false;
        continueBtn.textContent = stateMachine.isLastShot() ? 'SELESAI' : 'LANJUT';
      }
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

  function startCountdown() {
    if (stateMachine.getSubState() !== CAPTURE_SUB_STATES.LIVE) return;

    try {
      stateMachine.startCountdown();
    } catch {
      return;
    }

    let count = countdownSeconds;
    if (countdownNumber) countdownNumber.textContent = count;
    syncViewWithSubState();

    countdownTimer = setInterval(() => {
      count--;
      if (count > 0) {
        if (countdownNumber) countdownNumber.textContent = count;
      } else {
        clearInterval(countdownTimer);
        countdownTimer = null;

        triggerShutterFlash();
        try {
          const frameData = captureFrame(videoElement, { mirror: true });
          stateMachine.captureFrame(frameData);
          syncViewWithSubState();
        } catch (err) {
          console.error('[Capture] Gagal mengambil frame foto:', err);
          stateMachine.retake();
          syncViewWithSubState();
        }
      }
    }, 1000);
  }

  function handleRetake() {
    if (isSaving || stateMachine.getSubState() !== CAPTURE_SUB_STATES.REVIEWING_SHOT) return;
    console.log(`[Capture] Pelanggan memilih Ulangi foto #${stateMachine.getCurrentShotIndex() + 1}`);
    stateMachine.retake();
    syncViewWithSubState();
  }

  async function handleContinue() {
    if (isSaving || stateMachine.getSubState() !== CAPTURE_SUB_STATES.REVIEWING_SHOT) return;
    isSaving = true;

    if (continueBtn) {
      continueBtn.disabled = true;
      continueBtn.textContent = 'MENYIMPAN...';
    }
    if (retakeBtn) {
      retakeBtn.disabled = true;
    }

    try {
      await stateMachine.confirmShot(async ({ index, photo }) => {
        // Save to disk & database via idempotent API (PRD F-10, F-17)
        if (session && session.id && !session.id.startsWith('mock_')) {
          try {
            await api.saveSinglePhoto(session.id, { index, photo });
            console.log(`[Capture] Foto #${index + 1} berhasil disimpan ke disk.`);
          } catch (apiErr) {
            console.warn(`[Capture] Warning saat simpan foto #${index + 1}:`, apiErr.message);
          }
        }
      });
    } catch (err) {
      console.error('[Capture] Gagal melanjutkan foto:', err);
    } finally {
      isSaving = false;
      if (!stateMachine.isAllCompleted()) {
        syncViewWithSubState();
      }
    }
  }

  async function initCamera() {
    try {
      // Reuses singleton MediaStream from cameraService (PRD F-25)
      stream = await cameraService.start();
      if (videoElement && stream) {
        videoElement.srcObject = stream;
        await videoElement.play().catch(() => {});
      }
    } catch (err) {
      console.error('[Capture] Gagal menginisialisasi kamera:', err);
      if (cameraErrorBanner) {
        cameraErrorBanner.classList.remove('hidden');
        cameraErrorBanner.textContent = 'KAMERA TIDAK TERDETEKSI. PERIKSA SAMBUNGAN PERANGKAT.';
      }
    }
  }

  function cleanupCamera() {
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
    if (videoElement) {
      videoElement.srcObject = null;
    }
    stream = null;
  }

  function mount(parent) {
    container = document.createElement('div');
    container.className =
      'flex flex-col justify-between w-full h-screen max-w-none px-6 py-4 box-border font-body bg-white overflow-hidden select-none';

    container.innerHTML = `
      <!-- Header -->
      <div class="w-full flex items-center justify-between border-b-[5px] border-black pb-3 shrink-0">
        <div>
          <h1 id="slot-indicator" class="text-3xl md:text-4xl font-headline uppercase text-black">
            FOTO 1 DARI ${totalPhotos}
          </h1>
          <p id="slot-subtext" class="font-body text-xs text-black/70">
            BERPOSISILAH DI TENGAH BINGKAI KAMERA &bull; SENYUM TERBAIKMU
          </p>
        </div>
        <div class="flex items-center gap-3">
          <span id="camera-chip" class="chip-raw chip-raw-active">KAMERA AKTIF</span>
        </div>
      </div>

      <!-- Error Banner (Hidden by default) -->
      <div id="camera-error-banner" class="hidden w-full bg-raw-error text-white font-headline text-center p-3 mb-2 border-[3px] border-black"></div>

      <!-- Video & Shot Viewport Frame: Exact 16:9 Aspect Ratio Container -->
      <div class="flex-1 w-full min-h-0 py-2 flex items-center justify-center overflow-hidden">
        <div class="relative h-full max-w-full aspect-[16/9] border-[5px] border-black bg-black flex items-center justify-center overflow-hidden">
          <!-- 1. Live Camera Video -->
          <video id="camera-video" autoplay playsinline muted class="w-full h-full object-cover -scale-x-100"></video>

          <!-- 2. Captured Shot Image (Exact same dimensions as video preview - PRD F-10) -->
          <img id="preview-image" src="" alt="Pratinjau Hasil Foto" class="hidden w-full h-full object-cover" />

          <!-- Compatibility Overlay for selectors -->
          <div id="preview-overlay" class="hidden absolute inset-0 pointer-events-none">
            <p id="preview-text" class="hidden"></p>
          </div>

          <!-- Countdown Overlay -->
          <div id="countdown-overlay" class="hidden absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <span id="countdown-number" class="font-headline text-[180px] md:text-[240px] text-white drop-shadow-[0_10px_24px_rgba(0,0,0,0.95)] leading-none select-none tracking-normal">3</span>
          </div>

          <!-- Shutter Flash Effect -->
          <div id="flash-overlay" class="hidden absolute inset-0 bg-white z-30 pointer-events-none"></div>
        </div>
      </div>

      <!-- Bottom Controls & Thumbnails -->
      <div class="w-full flex items-center justify-between pt-3 border-t-[3px] border-black gap-6 shrink-0">
        <!-- Thumbnail Tray (Accepted photos & progress) -->
        <div id="thumbnail-tray" class="flex items-center gap-2 md:gap-3 overflow-x-auto py-1"></div>

        <!-- Action Controls -->
        <div class="flex items-center gap-3 shrink-0">
          <!-- Live Mode Actions -->
          <div id="live-actions" class="flex items-center">
            <button id="btn-trigger-photo" class="btn-raw-primary min-h-[64px] px-10 text-xl font-headline cursor-pointer">
              AMBIL FOTO
            </button>
          </div>

          <!-- Review Mode Actions (PRD F-10) -->
          <div id="review-actions" class="hidden flex items-center gap-3">
            <button id="btn-retake-photo" class="btn-raw-secondary min-h-[64px] px-8 text-xl font-headline cursor-pointer">
              ULANGI
            </button>
            <button id="btn-continue-photo" class="btn-raw-primary min-h-[64px] px-10 text-xl font-headline cursor-pointer">
              LANJUT
            </button>
          </div>
        </div>
      </div>
    `;

    parent.appendChild(container);

    videoElement = container.querySelector('#camera-video');
    previewImage = container.querySelector('#preview-image');
    previewOverlay = container.querySelector('#preview-overlay');
    previewText = container.querySelector('#preview-text');
    countdownOverlay = container.querySelector('#countdown-overlay');
    countdownNumber = container.querySelector('#countdown-number');
    flashOverlay = container.querySelector('#flash-overlay');
    slotIndicator = container.querySelector('#slot-indicator');
    slotSubtext = container.querySelector('#slot-subtext');
    cameraChip = container.querySelector('#camera-chip');
    cameraErrorBanner = container.querySelector('#camera-error-banner');

    liveActions = container.querySelector('#live-actions');
    reviewActions = container.querySelector('#review-actions');
    triggerBtn = container.querySelector('#btn-trigger-photo');
    retakeBtn = container.querySelector('#btn-retake-photo');
    continueBtn = container.querySelector('#btn-continue-photo');
    thumbnailTray = container.querySelector('#thumbnail-tray');

    if (triggerBtn) {
      triggerBtn.addEventListener('click', startCountdown);
    }
    if (retakeBtn) {
      retakeBtn.addEventListener('click', handleRetake);
    }
    if (continueBtn) {
      continueBtn.addEventListener('click', handleContinue);
    }

    syncViewWithSubState();
    initCamera();
  }

  function unmount() {
    cleanupCamera();
    if (triggerBtn) triggerBtn.removeEventListener('click', startCountdown);
    if (retakeBtn) retakeBtn.removeEventListener('click', handleRetake);
    if (continueBtn) continueBtn.removeEventListener('click', handleContinue);

    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    container = null;
    videoElement = null;
    previewImage = null;
    triggerBtn = null;
    retakeBtn = null;
    continueBtn = null;
  }

  return { mount, unmount };
}
