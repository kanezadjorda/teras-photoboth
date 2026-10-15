/**
 * Layar / Modal Otentikasi PIN Operator Admin (PRD F-14)
 * Melindungi akses panel admin dengan keypad angka RawBlock
 */

import { api } from '../../shared/api.js';

export function createPinModal({ onAuthenticated }) {
  let isMounted = false;
  let container = null;
  let enteredPin = '';
  let errorEl = null;
  let pinDotsContainer = null;
  let keydownHandler = null;
  let isSubmitting = false;

  function updatePinDisplay() {
    if (!pinDotsContainer) return;
    const dots = pinDotsContainer.querySelectorAll('.pin-dot');
    dots.forEach((dot, idx) => {
      if (idx < enteredPin.length) {
        dot.textContent = '●';
        dot.classList.add('bg-black', 'text-white');
        dot.classList.remove('bg-white', 'text-transparent');
      } else {
        dot.textContent = '○';
        dot.classList.remove('bg-black', 'text-white');
        dot.classList.add('bg-white', 'text-black/40');
      }
    });

    if (errorEl) {
      errorEl.classList.add('hidden');
    }

    if (enteredPin.length === 4) {
      submitPin();
    }
  }

  async function submitPin() {
    if (enteredPin.length < 4 || isSubmitting) return;
    isSubmitting = true;
    try {
      const res = await api.verifyPin(enteredPin);
      if (res.success) {
        sessionStorage.setItem('admin_auth', 'true');
        if (typeof onAuthenticated === 'function') {
          onAuthenticated();
        }
      }
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = 'PIN SALAH! SILAKAN COBA LAGI.';
        errorEl.classList.remove('hidden');
      }
      enteredPin = '';
      updatePinDisplay();
    } finally {
      isSubmitting = false;
    }
  }

  function handleKeyPress(key) {
    if (isSubmitting) return;
    if (key === 'clear') {
      enteredPin = '';
      updatePinDisplay();
    } else if (key === 'backspace') {
      enteredPin = enteredPin.slice(0, -1);
      updatePinDisplay();
    } else if (/^[0-9]$/.test(key)) {
      if (enteredPin.length < 4) {
        enteredPin += key;
        updatePinDisplay();
      }
    }
  }

  return {
    mount(parent) {
      isMounted = true;
      container = document.createElement('div');
      container.className =
        'fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 select-none';

      container.innerHTML = `
        <div class="card-raw border-[5px] border-black bg-white max-w-sm w-full p-8 space-y-6 shadow-none">
          
          <!-- Header -->
          <div class="text-center space-y-2 border-b-[3px] border-black pb-4">
            <span class="chip-raw chip-raw-default text-xs font-mono font-bold tracking-widest uppercase">
              PENGAMANAN SISTEM (F-14)
            </span>
            <h2 class="text-2xl font-headline uppercase text-black tracking-tight">
              MASUKKAN PIN STAFF
            </h2>
            <p class="font-body text-xs text-black/70">
              Panel admin dilindungi. Masukkan 4 digit PIN operator untuk melanjutkan.
            </p>
          </div>

          <!-- PIN Display (4 Kotak) -->
          <div id="pin-dots" class="flex justify-center items-center gap-4 py-2">
            <div class="pin-dot w-12 h-14 border-[3px] border-black flex items-center justify-center font-headline text-2xl">○</div>
            <div class="pin-dot w-12 h-14 border-[3px] border-black flex items-center justify-center font-headline text-2xl">○</div>
            <div class="pin-dot w-12 h-14 border-[3px] border-black flex items-center justify-center font-headline text-2xl">○</div>
            <div class="pin-dot w-12 h-14 border-[3px] border-black flex items-center justify-center font-headline text-2xl">○</div>
          </div>

          <!-- Pesan Error -->
          <div id="pin-error-msg" class="hidden border-[3px] border-black bg-raw-error text-white p-2 text-center font-headline text-xs uppercase">
            PIN SALAH! SILAKAN COBA LAGI.
          </div>

          <!-- RawBlock Numeric Keypad Grid (3 x 4) -->
          <div class="grid grid-cols-3 gap-3">
            <button type="button" data-key="1" class="keypad-btn btn-raw-secondary h-14 text-xl font-headline">1</button>
            <button type="button" data-key="2" class="keypad-btn btn-raw-secondary h-14 text-xl font-headline">2</button>
            <button type="button" data-key="3" class="keypad-btn btn-raw-secondary h-14 text-xl font-headline">3</button>

            <button type="button" data-key="4" class="keypad-btn btn-raw-secondary h-14 text-xl font-headline">4</button>
            <button type="button" data-key="5" class="keypad-btn btn-raw-secondary h-14 text-xl font-headline">5</button>
            <button type="button" data-key="6" class="keypad-btn btn-raw-secondary h-14 text-xl font-headline">6</button>

            <button type="button" data-key="7" class="keypad-btn btn-raw-secondary h-14 text-xl font-headline">7</button>
            <button type="button" data-key="8" class="keypad-btn btn-raw-secondary h-14 text-xl font-headline">8</button>
            <button type="button" data-key="9" class="keypad-btn btn-raw-secondary h-14 text-xl font-headline">9</button>

            <button type="button" data-key="clear" class="keypad-btn btn-raw-destructive h-14 text-sm font-headline">RESET</button>
            <button type="button" data-key="0" class="keypad-btn btn-raw-secondary h-14 text-xl font-headline">0</button>
            <button type="button" data-key="backspace" class="keypad-btn btn-raw-secondary h-14 text-base font-headline">⌫</button>
          </div>

          <!-- Hint Default -->
          <div class="text-center pt-2 border-t-[2px] border-black/20">
            <span class="font-mono text-[11px] text-black/50 uppercase">PIN STANDAR: 1234</span>
          </div>
        </div>
      `;

      parent.appendChild(container);

      errorEl = container.querySelector('#pin-error-msg');
      pinDotsContainer = container.querySelector('#pin-dots');

      // Click event delegation on keypad
      container.querySelectorAll('.keypad-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const key = btn.getAttribute('data-key');
          handleKeyPress(key);
        });
      });

      // Physical keyboard support
      keydownHandler = (e) => {
        if (!isMounted) return;
        if (/^[0-9]$/.test(e.key)) {
          handleKeyPress(e.key);
        } else if (e.key === 'Backspace') {
          handleKeyPress('backspace');
        } else if (e.key === 'Escape' || e.key === 'Delete') {
          handleKeyPress('clear');
        }
      };

      window.addEventListener('keydown', keydownHandler);
    },

    unmount() {
      isMounted = false;
      if (keydownHandler) {
        window.removeEventListener('keydown', keydownHandler);
        keydownHandler = null;
      }
      if (container && container.parentNode) {
        container.parentNode.removeChild(container);
        container = null;
      }
      enteredPin = '';
    }
  };
}
