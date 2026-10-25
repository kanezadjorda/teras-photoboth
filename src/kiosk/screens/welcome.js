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

      <!-- Lapisan Gelap / Gradasi agar teks dan UI terbaca kontras tanpa menutupi kamera (PRD F-24) -->
      <div class="absolute inset-0 bg-gradient-to-b from-black/60 via-black/20 to-black/70 z-10 pointer-events-none"></div>

      <!-- Konten Utama Kiosk (Tanpa box background, menyatu elegan dengan live preview kamera) -->
      <div class="relative z-20 flex flex-col items-center justify-between text-center p-8 sm:p-12 w-full h-full max-w-5xl select-none">
        <!-- Bagian Atas: Branding & Tagline -->
        <div class="space-y-3 pt-6 sm:pt-10">
          <h1 class="text-5xl sm:text-6xl md:text-7xl font-headline uppercase tracking-tight text-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.85)] leading-none">
            Teras Photobooth
          </h1>
          <p class="text-lg sm:text-xl md:text-2xl font-body text-white/90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)] max-w-2xl mx-auto">
            Abadikan momen spesialmu dalam hitungan menit
          </p>
        </div>

        <!-- Bagian Tengah: Tombol Mulai yang Besar & Bersih -->
        <div class="my-auto py-6">
          <button
            id="btn-start"
            class="bg-white text-black font-headline text-xl sm:text-2xl md:text-3xl px-12 sm:px-16 py-6 min-h-[72px] border-[4px] border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:bg-black hover:text-white hover:border-white transition-all cursor-pointer uppercase tracking-wider active:translate-x-[2px] active:translate-y-[2px]"
          >
            Mulai Sesi Foto
          </button>
        </div>

        <!-- Bagian Bawah: Info Footer Bersih -->
        <div class="pb-4 sm:pb-8">
          <p class="font-mono text-xs sm:text-sm uppercase tracking-widest text-white/80 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] bg-black/40 px-5 py-2.5 border border-white/20">
            PEMBAYARAN INSTAN VIA QRIS &bull; HASIL CETAK OTOMATIS 4R
          </p>
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
