/**
 * Welcome Screen for Kiosk (RawBlock Design System)
 * Customer entry point ("Sentuh/Klik untuk mulai")
 */

import { preventDoubleClick } from '../../shared/ui.js';

export function createWelcomeScreen({ onStart }) {
  let container = null;
  let startBtn = null;
  let clickHandler = null;

  function mount(parent) {
    container = document.createElement('div');
    container.className = 'flex flex-col items-center justify-center text-center p-8 max-w-4xl w-full';

    container.innerHTML = `
      <div class="border-[5px] border-black bg-white p-12 w-full space-y-8">
        <div class="space-y-4">
          <h1 class="text-6xl md:text-7xl font-headline uppercase tracking-tight text-black leading-none">
            Teras Photobooth
          </h1>
          <p class="text-xl md:text-2xl font-body text-black">
            Abadikan momen spesialmu dalam hitungan menit
          </p>
        </div>

        <div class="pt-4 flex justify-center">
          <button id="btn-start" class="btn-raw-primary min-h-[64px] px-12 py-5 text-2xl cursor-pointer">
            Sentuh atau Klik untuk Mulai
          </button>
        </div>

        <div class="border-t-[3px] border-black pt-4">
          <p class="font-mono text-xs uppercase tracking-wider text-black">
            PEMBAYARAN INSTAN VIA QRIS &bull; HASIL CETAK OTOMATIS 4R
          </p>
        </div>
      </div>
    `;

    parent.appendChild(container);

    startBtn = container.querySelector('#btn-start');
    if (startBtn && onStart) {
      clickHandler = preventDoubleClick(startBtn, onStart, 'MEMPROSES SESI...');
      startBtn.addEventListener('click', clickHandler);
    }
  }

  function unmount() {
    if (startBtn && clickHandler) {
      startBtn.removeEventListener('click', clickHandler);
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    container = null;
    startBtn = null;
  }

  return { mount, unmount };
}
