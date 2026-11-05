/**
 * Capture Screen for Kiosk (RawBlock Design System)
 * Handles per-shot sub-state lifecycle (PRD F-10):
 *   live -> countdown -> reviewing_shot
 *
 * Unlimited retake per photo before saving to disk.
 * Records short live video clip during countdown for Live Photo template creation.
 * Continue / Selesai saves photo via idempotent API and advances.
 * PRD Reference: F-08, F-09, F-06, F-10, F-25
 */

import { cameraService, captureFrame } from '../../shared/camera.js';
import { TIMEOUTS } from '../../shared/constants.js';
import { getUniquePhotoCount } from '../../shared/composite.js';
import { createCaptureStateMachine, CAPTURE_SUB_STATES } from '../../shared/capture-state.js';
import { getOptimalVideoMimeType } from '../../shared/video-composer.js';
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

  // Live video clip recording per slot
  const slotVideoBlobs = [];
  let currentMediaRecorder = null;
  let currentRecordedChunks = [];
  let pendingVideoBlob = null;

  const totalPhotos = getUniquePhotoCount(template?.slots);

  // Initialize pure state machine
  const stateMachine = createCaptureStateMachine({
    totalPhotos,
    initialPhotos: existingPhotos,
    onComplete: (allPhotos) => {
      cleanupCamera();
      if (typeof onCaptureComplete === 'function') {
        onCaptureComplete(allPhotos, slotVideoBlobs);
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
        cameraChip.className = 'chip-sb chip-sb-warning';
      } else {
        cameraChip.textContent = 'KAMERA AKTIF';
        cameraChip.className = 'chip-sb chip-sb-selected';
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
        'w-14 h-18 sm:w-16 sm:h-20 lg:w-20 lg:h-24 border border-[#D4D4D8] bg-[#FAFAFA] flex items-center justify-center overflow-hidden shrink-0 transition-colors duration-150';

      if (acceptedPhotos[i]) {
        thumb.innerHTML = `<img src="${acceptedPhotos[i]}" alt="Foto ${i + 1}" class="w-full h-full object-cover" />`;
        thumb.classList.remove('border-[#D4D4D8]');
        thumb.classList.add('border-[#0A0A0A]');
      } else if (i === currentIdx) {
        if (subState === CAPTURE_SUB_STATES.REVIEWING_SHOT && pendingShot) {
          thumb.innerHTML = `<img src="${pendingShot}" alt="Review ${i + 1}" class="w-full h-full object-cover opacity-90" />`;
          thumb.classList.remove('border-[#D4D4D8]');
          thumb.classList.add('border-2', 'border-[#0A0A0A]', 'bg-white');
        } else {
          thumb.innerHTML = `<span class="font-headline text-xs text-[#0A0A0A] font-semibold tracking-wider">AKTIF</span>`;
          thumb.classList.remove('border-[#D4D4D8]');
          thumb.classList.add('border-2', 'border-[#0A0A0A]', 'bg-white');
        }
      } else {
        thumb.innerHTML = `<span class="font-mono text-xs text-[#A1A1AA]">#${i + 1}</span>`;
      }

      thumbnailTray.appendChild(thumb);
    }
  }

  function syncViewWithSubState() {
    const subState = stateMachine.getSubState();

    updateHeaderUI();
    renderThumbnails();

    if (subState === CAPTURE_SUB_STATES.LIVE) {
      if (videoElement) videoElement.classList.remove('hidden');
      if (previewImage) {
        previewImage.classList.add('hidden');
        previewImage.src = '';
      }
      if (countdownOverlay) countdownOverlay.classList.add('hidden');

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
      const pending = stateMachine.getPendingShot();
      if (videoElement) videoElement.classList.add('hidden');
      if (previewImage) {
        previewImage.src = pending || '';
        previewImage.classList.remove('hidden');
      }
      if (countdownOverlay) countdownOverlay.classList.add('hidden');

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

    // Mulai merekam video klip untuk slot saat ini jika MediaRecorder didukung
    currentRecordedChunks = [];
    pendingVideoBlob = null;
    const activeStream = cameraService.getStream();
    if (activeStream && typeof MediaRecorder !== 'undefined') {
      try {
        const mimeType = getOptimalVideoMimeType();
        currentMediaRecorder = new MediaRecorder(activeStream, { mimeType });
        currentMediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            currentRecordedChunks.push(e.data);
          }
        };
        currentMediaRecorder.onstop = () => {
          if (currentRecordedChunks.length > 0) {
            pendingVideoBlob = new Blob(currentRecordedChunks, { type: mimeType });
          }
        };
        currentMediaRecorder.start(100);
      } catch (recErr) {
        console.warn('[Capture] Perekaman live video klip tidak tersedia:', recErr.message);
      }
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

        // Hentikan perekam video saat shutter flash
        if (currentMediaRecorder && currentMediaRecorder.state !== 'inactive') {
          try {
            currentMediaRecorder.stop();
          } catch {}
          currentMediaRecorder = null;
        }

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

    // Batalkan video klip yang tertunda saat retake
    if (currentMediaRecorder && currentMediaRecorder.state !== 'inactive') {
      try {
        currentMediaRecorder.stop();
      } catch {}
      currentMediaRecorder = null;
    }
    pendingVideoBlob = null;
    currentRecordedChunks = [];

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

    const currentShotIndex = stateMachine.getCurrentShotIndex();
    if (pendingVideoBlob) {
      slotVideoBlobs[currentShotIndex] = pendingVideoBlob;
    }
    pendingVideoBlob = null;
    currentRecordedChunks = [];

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
    if (currentMediaRecorder && currentMediaRecorder.state !== 'inactive') {
      try {
        currentMediaRecorder.stop();
      } catch {}
      currentMediaRecorder = null;
    }
    if (videoElement) {
      videoElement.srcObject = null;
    }
    stream = null;
  }

  function mount(parent) {
    container = document.createElement('div');
    container.className =
      'flex flex-col justify-between w-full min-h-screen lg:h-screen max-w-none px-4 sm:px-6 lg:px-8 py-3 sm:py-4 box-border font-body bg-white overflow-x-hidden overflow-y-auto lg:overflow-hidden select-none';

    container.innerHTML = `
      <!-- Header (StudioBlank: 1px border, clear typographic scale) -->
      <div class="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#D4D4D8] pb-3 shrink-0">
        <div class="min-w-0">
          <h1 id="slot-indicator" class="text-h1 uppercase text-[#0A0A0A]">
            FOTO 1 DARI ${totalPhotos}
          </h1>
          <p id="slot-subtext" class="text-body-sm text-[#71717A] mt-0.5">
            BERPOSISILAH DI TENGAH BINGKAI KAMERA &bull; SENYUM TERBAIKMU
          </p>
        </div>
        <div class="flex items-center gap-3 self-start sm:self-auto shrink-0">
          <span id="camera-chip" class="chip-sb chip-sb-selected">KAMERA AKTIF</span>
        </div>
      </div>

      <!-- Error Banner (Hidden by default) -->
      <div id="camera-error-banner" class="hidden w-full bg-[#DC2626] text-white font-headline text-xs py-2 px-3 text-center uppercase tracking-wider my-2 border border-[#0A0A0A]"></div>

      <!-- Main Layout: Viewport (80%) + Thumbnail Sidebar (20%) -->
      <div class="flex-1 flex flex-col lg:flex-row gap-4 items-center justify-center my-auto min-h-0 py-1 sm:py-2 w-full">
        <!-- Live Camera Viewport (80% / Dominant) -->
        <div class="relative w-full lg:flex-1 h-[42vh] sm:h-[50vh] md:h-[58vh] lg:h-[65vh] xl:h-[72vh] border border-[#0A0A0A] bg-[#0A0A0A] flex items-center justify-center overflow-hidden shrink-0">
          <video id="camera-video" autoplay playsinline muted class="w-full h-full object-cover scale-x-[-1]"></video>
          <img id="preview-image" alt="Pratinjau Foto" class="hidden w-full h-full object-cover scale-x-[-1]" />

          <!-- Semi-transparent overlay during review -->
          <div id="preview-overlay" class="hidden absolute inset-0 bg-[#0A0A0A]/40 flex items-center justify-center pointer-events-none">
            <span id="preview-text" class="font-headline text-base sm:text-xl text-[#FAFAFA] tracking-wider uppercase bg-[#0A0A0A]/80 px-4 py-2 border border-[#FAFAFA]">
              PRATINJAU HASIL FOTO
            </span>
          </div>

          <!-- Countdown Overlay (3-2-1) -->
          <div id="countdown-overlay" class="hidden absolute inset-0 bg-[#0A0A0A]/30 flex items-center justify-center pointer-events-none">
            <span id="countdown-number" class="font-headline text-7xl sm:text-9xl lg:text-[144px] text-white font-bold select-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] animate-pulse">
              3
            </span>
          </div>

          <!-- Shutter Flash Overlay -->
          <div id="flash-overlay" class="hidden absolute inset-0 bg-white pointer-events-none transition-opacity duration-100 z-50"></div>
        </div>

        <!-- Thumbnail Strip Tray (Vertical on Desktop, Horizontal on Mobile) -->
        <div class="w-full lg:w-28 xl:w-32 flex flex-col gap-2 shrink-0">
          <div class="font-mono text-xs uppercase text-[#71717A] pb-1 border-b border-[#D4D4D8] hidden lg:block tracking-wider">
            DAFTAR SLOT
          </div>
          <div id="thumbnail-tray" class="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto max-h-[140px] lg:max-h-[65vh] p-1 border border-[#E5E5E5] bg-[#FAFAFA]">
          </div>
        </div>
      </div>

      <!-- Footer Action Toolbar (StudioBlank: 64px button, clear state separation) -->
      <div class="border-t border-[#D4D4D8] pt-3 w-full shrink-0">
        <div class="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 sm:gap-4">
          <div class="font-mono text-xs text-[#71717A] text-center md:text-left">
            KAMERA DIOPTIMALKAN OTOMATIS &bull; PASTIKAN PENCAHAYAAN RUANGAN CUKUP
          </div>

          <!-- Actions: Live State -->
          <div id="live-actions" class="flex items-center gap-3 w-full md:w-auto">
            <button id="btn-trigger-photo" class="btn-sb-primary btn-kiosk min-h-[64px] px-8 sm:px-12 text-sm md:text-base font-mono uppercase tracking-wider font-semibold w-full md:w-auto cursor-pointer">
              AMBIL FOTO
            </button>
          </div>

          <!-- Actions: Reviewing Shot State (PRD F-10: Ulangi or Lanjut) -->
          <div id="review-actions" class="hidden flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full md:w-auto">
            <button id="btn-retake-photo" class="btn-sb-secondary btn-kiosk flex-1 md:flex-initial min-h-[64px] px-6 sm:px-8 text-sm md:text-base font-mono uppercase tracking-wider font-semibold cursor-pointer">
              ULANGI
            </button>
            <button id="btn-continue-photo" class="btn-sb-primary btn-kiosk flex-1 md:flex-initial min-h-[64px] px-8 sm:px-10 text-sm md:text-base font-mono uppercase tracking-wider font-semibold cursor-pointer">
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
