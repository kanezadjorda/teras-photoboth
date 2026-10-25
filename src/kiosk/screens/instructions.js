/**
 * Instructions Screen for Kiosk (RawBlock Design System)
 * Displays 4-step illustrated guide with Next/Back buttons and 60s idle timeout.
 * PRD Reference: F-26, F-29
 */

import { INSTRUCTIONS_COPY } from '../../shared/copy.js';
import { createIdleTimer, preventDoubleClick } from '../../shared/ui.js';
import { TIMEOUTS } from '../../shared/constants.js';

function getStepSvg(iconType) {
  switch (iconType) {
    case 'qris':
      return `
        <svg class="w-16 h-16 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square">
          <rect x="3" y="3" width="7" height="7"></rect>
          <rect x="14" y="3" width="7" height="7"></rect>
          <rect x="3" y="14" width="7" height="7"></rect>
          <path d="M14 14h3v3h-3z"></path>
          <path d="M20 14v3"></path>
          <path d="M14 20h6"></path>
          <path d="M7 7h.01"></path>
          <path d="M18 7h.01"></path>
          <path d="M7 18h.01"></path>
        </svg>
      `;
    case 'template':
      return `
        <svg class="w-16 h-16 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square">
          <rect x="4" y="2" width="16" height="20" rx="0"></rect>
          <rect x="7" y="5" width="10" height="4"></rect>
          <rect x="7" y="11" width="10" height="4"></rect>
          <path d="M7 17h10"></path>
        </svg>
      `;
    case 'camera':
      return `
        <svg class="w-16 h-16 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
          <circle cx="12" cy="13" r="4"></circle>
        </svg>
      `;
    case 'print':
      return `
        <svg class="w-16 h-16 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square">
          <polyline points="6 9 6 2 18 2 18 9"></polyline>
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
          <rect x="6" y="14" width="12" height="8"></rect>
        </svg>
      `;
    default:
      return '';
  }
}

export function createInstructionsScreen({ onNext, onBack, onTimeout }) {
  let container = null;
  let nextBtn = null;
  let backBtn = null;
  let nextHandler = null;
  let backHandler = null;
  let idleTimer = null;

  function mount(parent) {
    container = document.createElement('div');
    container.className =
      'flex flex-col justify-between w-full h-full max-w-6xl mx-auto p-6 box-border font-body select-none';

    const stepsHtml = INSTRUCTIONS_COPY.steps
      .map(
        (step) => `
        <div class="card-raw flex flex-col justify-between p-6 space-y-4 border-[4px] border-black bg-white shadow-[6px_6px_0px_0px_#000]">
          <div class="flex items-center justify-between pb-3 border-b-[3px] border-black">
            <span class="bg-black text-white font-headline text-xs px-2.5 py-1 tracking-wider">
              LANGKAH 0${step.step}
            </span>
          </div>

          <div class="py-4 flex justify-center items-center bg-raw-sunken border-[2px] border-black">
            ${getStepSvg(step.icon)}
          </div>

          <div class="space-y-1.5 flex-1">
            <h3 class="font-headline text-lg uppercase text-black leading-tight">
              ${step.title}
            </h3>
            <p class="font-body text-xs text-black/80 leading-relaxed">
              ${step.desc}
            </p>
          </div>
        </div>
      `
      )
      .join('');

    container.innerHTML = `
      <!-- Header -->
      <div class="flex items-center justify-between pb-4 mb-4 border-b-[5px] border-black">
        <div>
          <h1 class="text-3xl md:text-4xl font-headline uppercase text-black">
            ${INSTRUCTIONS_COPY.title}
          </h1>
          <p class="font-body text-xs text-black/70 mt-1 uppercase tracking-wider">
            ${INSTRUCTIONS_COPY.subtitle}
          </p>
        </div>
      </div>

      <!-- 4 Langkah Bergambar -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 my-auto py-2">
        ${stepsHtml}
      </div>

      <!-- Footer Navigasi -->
      <div class="mt-4 pt-4 border-t-[5px] border-black flex items-center justify-between gap-4">
        <button
          id="btn-instructions-back"
          class="btn-raw-secondary min-h-[64px] px-8 text-lg md:text-xl font-headline cursor-pointer"
        >
          ${INSTRUCTIONS_COPY.btnBack}
        </button>

        <button
          id="btn-instructions-next"
          class="btn-raw-primary min-h-[64px] px-10 md:px-12 text-lg md:text-xl font-headline cursor-pointer"
        >
          ${INSTRUCTIONS_COPY.btnNext}
        </button>
      </div>
    `;

    parent.appendChild(container);

    backBtn = container.querySelector('#btn-instructions-back');
    nextBtn = container.querySelector('#btn-instructions-next');

    if (backBtn && onBack) {
      backHandler = () => onBack();
      backBtn.addEventListener('click', backHandler);
    }

    if (nextBtn && onNext) {
      nextHandler = preventDoubleClick(nextBtn, onNext, 'MEMULAI...');
      nextBtn.addEventListener('click', nextHandler);
    }

    // Start 60s idle timeout (PRD F-29)
    idleTimer = createIdleTimer({
      timeoutSeconds: TIMEOUTS.IDLE_TIMEOUT_SECONDS || 60,
      onTimeout: () => {
        console.warn('[Instructions] Tidak ada aktivitas selama 60 detik. Kembali ke Layar Awal.');
        if (typeof onTimeout === 'function') {
          onTimeout();
        } else if (typeof onBack === 'function') {
          onBack();
        }
      }
    });
    idleTimer.start();
  }

  function unmount() {
    if (idleTimer) {
      idleTimer.stop();
      idleTimer = null;
    }
    if (backBtn && backHandler) {
      backBtn.removeEventListener('click', backHandler);
    }
    if (nextBtn && nextHandler) {
      nextBtn.removeEventListener('click', nextHandler);
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    container = null;
    backBtn = null;
    nextBtn = null;
  }

  return { mount, unmount };
}

