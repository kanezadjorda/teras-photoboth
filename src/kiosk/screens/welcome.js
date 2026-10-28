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
        class="absolute inset-0 w-full h-full bg-[#0A0A0A] z-0 flex items-center justify-center"
      >
        <div class="w-full h-full border border-white/5 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:32px_32px]"></div>
      </div>

      <!-- Lapisan Gelap / Gradasi Halus agar teks dan UI terbaca jelas di atas kamera -->
      <div class="absolute inset-0 bg-gradient-to-b from-black/70 via-black/30 to-black/80 z-10 pointer-events-none"></div>

      <!-- Konten Utama Kiosk (StudioBlank: ultra-minimal, ruang bernapas lapang, tanpa shadow/radius) -->
      <div class="relative z-20 flex flex-col items-center justify-between text-center p-8 sm:p-12 md:p-16 w-full h-full max-w-5xl select-none">
        <!-- Bagian Atas: Branding & Tagline -->
        <div class="space-y-3 pt-8 sm:pt-12">
          <span class="inline-block font-mono text-xs tracking-[0.2em] uppercase text-white/60 mb-2 border border-white/20 px-3 py-1">
            PHOTOBOOTH OTOMATIS
          </span>
          <h1 class="text-hero uppercase tracking-tight text-white leading-none">
            Teras Photobooth
          </h1>
          <p class="text-body md:text-lg text-white/80 max-w-xl mx-auto font-light leading-relaxed">
            Abadikan momen spesialmu dalam hitungan menit
          </p>
        </div>

        <!-- Bagian Tengah: Tombol Mulai (StudioBlank: flat sharp rectangle, hover inversion) -->
        <div class="my-auto py-8">
          <button
            id="btn-start"
            class="btn-sb-primary btn-kiosk min-h-[64px] px-12 md:px-16 text-base md:text-lg font-mono tracking-wider font-semibold uppercase cursor-pointer transition-colors duration-150"
          >
            Mulai Sesi Foto &rarr;
          </button>
        </div>

        <!-- Bagian Bawah: Info Footer Bersih -->
        <div class="pb-6 sm:pb-8">
          <div class="font-mono text-xs uppercase tracking-[0.15em] text-white/80 bg-black/60 px-5 py-2.5 border border-white/20 inline-flex items-center gap-3">
            <span>PEMBAYARAN INSTAN QRIS</span>
            <span class="text-white/40">&bull;</span>
            <span>CETAK OTOMATIS 4R</span>
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
