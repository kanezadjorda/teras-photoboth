/**
 * Welcome Screen for Kiosk
 * Customer entry point ("Sentuh/Klik untuk mulai")
 */

export function createWelcomeScreen({ onStart }) {
  let container = null;
  let startBtn = null;

  function mount(parent) {
    container = document.createElement('div');
    container.className = 'flex flex-col items-center justify-center gap-8 text-center p-8';

    container.innerHTML = `
      <div class="space-y-4">
        <h1 class="text-6xl font-extrabold tracking-tight text-dark">
          Teras Photobooth
        </h1>
        <p class="text-2xl text-dark/70 font-medium">
          Abadikan momen spesialmu dalam hitungan menit
        </p>
      </div>

      <button id="btn-start" class="mt-8 px-12 h-20 text-2xl font-bold bg-primary text-white rounded-2xl shadow-lg hover:opacity-95 active:scale-95 transition-all duration-150 cursor-pointer min-h-[64px] flex items-center justify-center">
        Sentuh atau Klik untuk Mulai
      </button>

      <p class="text-base text-dark/50">
        Pembayaran instan via QRIS
      </p>
    `;

    parent.appendChild(container);

    startBtn = container.querySelector('#btn-start');
    if (startBtn && onStart) {
      startBtn.addEventListener('click', onStart);
    }
  }

  function unmount() {
    if (startBtn && onStart) {
      startBtn.removeEventListener('click', onStart);
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    container = null;
    startBtn = null;
  }

  return { mount, unmount };
}

