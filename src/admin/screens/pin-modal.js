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
        dot.classList.add('bg-[#0A0A0A]', 'text-[#FAFAFA]', 'border-[#0A0A0A]');
        dot.classList.remove('bg-[#FAFAFA]', 'text-[#A3A3A3]', 'border-[#D4D4D8]');
      } else {
        dot.textContent = '○';
        dot.classList.remove('bg-[#0A0A0A]', 'text-[#FAFAFA]', 'border-[#0A0A0A]');
        dot.classList.add('bg-[#FAFAFA]', 'text-[#A3A3A3]', 'border-[#D4D4D8]');
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
        'fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 select-none backdrop-blur-xs';

      container.innerHTML = `
        <div class="card-sb border border-[#E5E5E5] bg-white max-w-sm w-full p-8 space-y-6">
          
          <!-- Header -->
          <div class="text-center space-y-2 border-b border-[#E5E5E5] pb-4">
            <span class="chip-sb text-xs font-mono text-[#737373] border border-[#E5E5E5] uppercase tracking-wider inline-block">
              PENGAMANAN SISTEM (F-14)
            </span>
            <h2 class="text-h3 font-semibold text-[#0A0A0A] tracking-tight uppercase">
              MASUKKAN PIN STAFF
            </h2>
            <p class="text-body-sm text-[#737373]">
              Panel admin dilindungi. Masukkan 4 digit PIN operator untuk melanjutkan.
            </p>
          </div>

          <!-- PIN Display (4 Kotak) -->
          <div id="pin-dots" class="flex justify-center items-center gap-3 py-2">
            <div class="pin-dot w-12 h-14 border border-[#D4D4D8] flex items-center justify-center font-mono text-xl bg-[#FAFAFA] text-[#A3A3A3]">○</div>
            <div class="pin-dot w-12 h-14 border border-[#D4D4D8] flex items-center justify-center font-mono text-xl bg-[#FAFAFA] text-[#A3A3A3]">○</div>
            <div class="pin-dot w-12 h-14 border border-[#D4D4D8] flex items-center justify-center font-mono text-xl bg-[#FAFAFA] text-[#A3A3A3]">○</div>
            <div class="pin-dot w-12 h-14 border border-[#D4D4D8] flex items-center justify-center font-mono text-xl bg-[#FAFAFA] text-[#A3A3A3]">○</div>
          </div>

          <!-- Pesan Error -->
          <div id="pin-error-msg" class="hidden border border-[#E5484D] bg-[#E5484D]/10 text-[#E5484D] p-2 text-center font-mono text-xs uppercase">
            PIN SALAH! SILAKAN COBA LAGI.
          </div>

          <!-- StudioBlank Numeric Keypad Grid (3 x 4) -->
          <div class="grid grid-cols-3 gap-2">
            <button type="button" data-key="1" class="keypad-btn btn-sb-secondary h-12 text-lg font-mono font-medium">1</button>
            <button type="button" data-key="2" class="keypad-btn btn-sb-secondary h-12 text-lg font-mono font-medium">2</button>
            <button type="button" data-key="3" class="keypad-btn btn-sb-secondary h-12 text-lg font-mono font-medium">3</button>

            <button type="button" data-key="4" class="keypad-btn btn-sb-secondary h-12 text-lg font-mono font-medium">4</button>
            <button type="button" data-key="5" class="keypad-btn btn-sb-secondary h-12 text-lg font-mono font-medium">5</button>
            <button type="button" data-key="6" class="keypad-btn btn-sb-secondary h-12 text-lg font-mono font-medium">6</button>

            <button type="button" data-key="7" class="keypad-btn btn-sb-secondary h-12 text-lg font-mono font-medium">7</button>
            <button type="button" data-key="8" class="keypad-btn btn-sb-secondary h-12 text-lg font-mono font-medium">8</button>
            <button type="button" data-key="9" class="keypad-btn btn-sb-secondary h-12 text-lg font-mono font-medium">9</button>

            <button type="button" data-key="clear" class="keypad-btn btn-sb-ghost h-12 text-xs font-mono text-[#E5484D]">RESET</button>
            <button type="button" data-key="0" class="keypad-btn btn-sb-secondary h-12 text-lg font-mono font-medium">0</button>
            <button type="button" data-key="backspace" class="keypad-btn btn-sb-secondary h-12 text-base font-mono">⌫</button>
          </div>

          <!-- Hint Default -->
          <div class="text-center pt-2 border-t border-[#E5E5E5]">
            <span class="font-mono text-[11px] text-[#737373] uppercase">PIN STANDAR: 1234</span>
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
