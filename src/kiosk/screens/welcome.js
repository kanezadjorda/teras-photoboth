/**
 * Welcome Screen for Kiosk (RawBlock Design System)
 * Customer entry point with live camera preview background (F-24)
 * Reusable camera stream via cameraService (F-25)
 */

import { cameraService } from '../../shared/camera.js';
import { preventDoubleClick } from '../../shared/ui.js';

export function createWelcomeScreen({ onStart }) {
  let container = null;
  let startBtn = null;
  let clickHandler = null;
  let videoBg = null;
  let fallbackBg = null;
  let unsubscribeStream = null;

  async function attachCameraStream() {
    try {
      const stream = await cameraService.start();
      if (videoBg && stream) {
        videoBg.srcObject = stream;
        await videoBg.play().catch(() => {});
        videoBg.classList.remove('hidden');
        if (fallbackBg) {
          fallbackBg.classList.add('hidden');
        }
      }
    } catch (err) {
      console.warn('[Welcome] Kamera tidak tersedia, menggunakan fallback visual statis:', err.message);
      if (videoBg) {
        videoBg.classList.add('hidden');
      }
      if (fallbackBg) {
        fallbackBg.classList.remove('hidden');
      }
    }
  }

  function mount(parent) {
    container = document.createElement('div');
    container.className = 'relative w-full h-full min-h-screen flex items-center justify-center overflow-hidden select-none';

    container.innerHTML = `
      <!-- Video Background Live Kamera (PRD F-24) -->
      <video
        id="welcome-video-bg"
        autoplay
        playsinline
        muted
        class="absolute inset-0 w-full h-full object-cover transform scale-x-[-1] z-0 hidden"
      ></video>

      <!-- Fallback Visual Statis jika kamera tidak tersedia / error (PRD F-24) -->
      <div
        id="welcome-fallback-bg"
        class="absolute inset-0 w-full h-full bg-neutral-900 bg-[radial-gradient(#ffffff15_1px,transparent_1px)] [background-size:24px_24px] z-0 flex items-center justify-center"
      >
        <div class="absolute inset-0 bg-gradient-to-tr from-black/80 via-black/40 to-black/80"></div>
      </div>

      <!-- Lapisan Gelap / Gradasi agar teks dan UI terbaca kontras (PRD F-24) -->
      <div class="absolute inset-0 bg-black/45 backdrop-brightness-75 z-10 pointer-events-none"></div>

      <!-- Konten Utama Kiosk -->
      <div class="relative z-20 flex flex-col items-center justify-center text-center p-6 sm:p-8 max-w-4xl w-full">
        <div class="border-[5px] border-black bg-white p-8 sm:p-12 w-full space-y-8 shadow-[8px_8px_0px_0px_#000]">
          <div class="space-y-4">
            <h1 class="text-5xl sm:text-6xl md:text-7xl font-headline uppercase tracking-tight text-black leading-none">
              Teras Photobooth
            </h1>
            <p class="text-lg sm:text-xl md:text-2xl font-body text-black">
              Abadikan momen spesialmu dalam hitungan menit
            </p>
          </div>

          <div class="pt-4 flex justify-center">
            <button id="btn-start" class="btn-raw-primary min-h-[64px] px-10 sm:px-12 py-5 text-xl sm:text-2xl cursor-pointer">
              Mulai Sesi Foto
            </button>
          </div>

          <div class="border-t-[3px] border-black pt-4">
            <p class="font-mono text-xs uppercase tracking-wider text-black">
              PEMBAYARAN INSTAN VIA QRIS &bull; HASIL CETAK OTOMATIS 4R
            </p>
          </div>
        </div>
      </div>
    `;

    parent.appendChild(container);

    videoBg = container.querySelector('#welcome-video-bg');
    fallbackBg = container.querySelector('#welcome-fallback-bg');
    startBtn = container.querySelector('#btn-start');

    if (startBtn && onStart) {
      clickHandler = preventDoubleClick(startBtn, onStart, 'MEMPROSES SESI...');
      startBtn.addEventListener('click', clickHandler);
    }

    // Subscribe to stream changes (e.g. device plugged in/unplugged)
    unsubscribeStream = cameraService.onStreamChange((stream) => {
      if (videoBg) {
        if (stream) {
          videoBg.srcObject = stream;
          videoBg.play().catch(() => {});
          videoBg.classList.remove('hidden');
          if (fallbackBg) fallbackBg.classList.add('hidden');
        } else {
          videoBg.classList.add('hidden');
          if (fallbackBg) fallbackBg.classList.remove('hidden');
        }
      }
    });

    // Inisialisasi kamera (stream singleton)
    attachCameraStream();
  }

  function unmount() {
    if (unsubscribeStream) {
      unsubscribeStream();
      unsubscribeStream = null;
    }
    if (startBtn && clickHandler) {
      startBtn.removeEventListener('click', clickHandler);
    }
    if (videoBg) {
      videoBg.srcObject = null;
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    // CATATAN PENTING (PRD F-25):
    // Jangan memanggil cameraService.stop() di unmount agar stream tetap aktif
    // dan dapat langsung digunakan di layar capture tanpa jeda buka-tutup kamera.
    container = null;
    startBtn = null;
    videoBg = null;
    fallbackBg = null;
  }

  return { mount, unmount };
}
