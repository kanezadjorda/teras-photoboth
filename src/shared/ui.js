/**
 * Reusable UI Helpers & Protections (RawBlock Design System)
 */

/**
 * Mencegah aksi ganda (double-click) pada tombol interaktif
 * @param {HTMLButtonElement} button 
 * @param {() => Promise<void> | void} action 
 * @param {string} [loadingText]
 */
export function preventDoubleClick(button, action, loadingText = 'MEMPROSES...') {
  if (!button) return;

  const originalContent = button.innerHTML;

  return async function handleClick(event) {
    if (button.disabled || button.dataset.busy === 'true') {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }

    try {
      button.disabled = true;
      button.dataset.busy = 'true';
      button.classList.add('opacity-70', 'cursor-not-allowed');

      if (loadingText) {
        button.textContent = loadingText;
      }

      await action(event);
    } catch (err) {
      console.error('[UI Helper] Kesalahan pada aksi tombol:', err);
      // Pulihkan state jika tombol masih ada di DOM atau running in node env
      const isInDoc = typeof document === 'undefined' || (document.body && document.body.contains(button));
      if (isInDoc) {
        button.disabled = false;
        button.dataset.busy = 'false';
        button.classList.remove('opacity-70', 'cursor-not-allowed');
        button.innerHTML = originalContent;
      }
      throw err;
    }
  };
}

/**
 * Pasang monitor status koneksi internet untuk menampilkan/menyembunyikan banner peringatan
 * @param {HTMLElement} parent
 * @param {string} message
 * @returns {() => void} cleanup function
 */
export function setupOfflineMonitor(parent = document.body, message = 'KONEKSI INTERNET TERPUTUS — PEMBAYARAN QRIS TIDAK DAPAT DIBUAT (HUBUNGI OPERATOR)') {
  let banner = document.getElementById('raw-offline-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'raw-offline-banner';
    banner.className =
      'hidden fixed top-0 left-0 right-0 bg-raw-error text-white font-headline text-xs py-2 px-4 text-center uppercase z-50 border-b-[3px] border-black tracking-wider flex items-center justify-center gap-2 select-none shadow-none';
    banner.innerHTML = `
      <span class="inline-block w-2.5 h-2.5 bg-white border border-black animate-ping"></span>
      <span id="raw-offline-banner-text">${message}</span>
    `;
    parent.appendChild(banner);
  }

  function updateStatus() {
    if (navigator.onLine) {
      banner.classList.add('hidden');
    } else {
      banner.classList.remove('hidden');
    }
  }

  window.addEventListener('online', updateStatus);
  window.addEventListener('offline', updateStatus);
  updateStatus();

  return () => {
    window.removeEventListener('online', updateStatus);
    window.removeEventListener('offline', updateStatus);
    if (banner && banner.parentNode) {
      banner.parentNode.removeChild(banner);
    }
  };
}
