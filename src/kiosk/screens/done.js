/**
 * Layar Kiosk: Layar Selesai (Soft File & QR Galeri Web) (PRD F-20, F-30)
 * Menampilkan instruksi pengambilan cetakan dan QR Code dinamis untuk unduh soft file privat via Cloudflare R2 / Vercel
 */

import QRCode from 'qrcode';
import { TIMEOUTS } from '../../shared/constants.js';

export function createDoneScreen({
  session = null,
  sessionNo = '0001',
  galleryBaseUrl = '',
  onFinished
}) {
  let isMounted = false;
  let timerInterval = null;
  let remainingSeconds = TIMEOUTS.DONE_SCREEN_SECONDS || 15;

  return {
    mount(container) {
      isMounted = true;

      // URL galeri untuk token sesi
      const token = session?.token || '';
      const base = (galleryBaseUrl || window.location.origin).replace(/\/+$/, '');
      const galleryUrl = token ? `${base}/s/${token}` : '';

      container.innerHTML = `
        <div class="w-full h-full min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center p-6 select-none font-sans">
          <div class="card-sb max-w-2xl w-full flex flex-col items-center text-center p-8 md:p-10 bg-white border border-[#E5E5E5] space-y-6">
            
            <!-- Badge Sesi Selesai -->
            <div class="chip-sb text-xs py-1 px-3 font-mono text-[#0A0A0A] bg-[#FAFAFA] border border-[#D4D4D8] uppercase tracking-wider">
              SESI SELESAI &bull; TERIMA KASIH
            </div>

            <!-- Pesan Utama -->
            <div class="space-y-2">
              <h1 class="text-h2 font-semibold text-[#0A0A0A] tracking-tight leading-tight uppercase">
                AMBIL HASIL CETAKANMU DI PRINTER!
              </h1>
              <p class="text-body-sm text-[#737373] max-w-lg mx-auto leading-relaxed">
                Foto Anda telah selesai dicetak. Silakan ambil lembaran cetak dari tray keluaran printer.
              </p>
            </div>

            <!-- Box Info Soft File & QR Code Dinamis -->
            <div class="w-full border border-[#E5E5E5] bg-[#FAFAFA] p-6 text-left">
              <div class="flex items-center justify-between border-b border-[#E5E5E5] pb-3 mb-4">
                <span class="font-mono text-xs uppercase tracking-wider text-[#737373]">NOMOR SESI ANDA:</span>
                <span class="font-mono font-semibold text-lg text-[#0A0A0A] tracking-wider">#${sessionNo}</span>
              </div>

              <div class="flex flex-col sm:flex-row items-center gap-6">
                <!-- QR Code Container -->
                <div class="border border-[#E5E5E5] bg-white p-2 shrink-0 flex items-center justify-center w-[160px] h-[160px] shadow-sm">
                  <img id="qr-image" src="" alt="QR Code Galeri" class="w-full h-full object-contain hidden" />
                  <div id="qr-loading" class="text-caption font-mono text-[#737373] text-center">
                    MEMBUAT QR...
                  </div>
                </div>

                <!-- Petunjuk Scan -->
                <div class="space-y-2 text-center sm:text-left flex-1">
                  <div class="text-body-sm font-semibold uppercase text-[#0A0A0A]">
                    PINDAI UNTUK UNDUH SOFT FILE DIGITAL
                  </div>
                  <p class="text-caption text-[#737373] leading-relaxed">
                    Arahkan kamera HP Anda ke kode QR di samping untuk membuka halaman galeri privat. Anda dapat mengunduh foto komposit 4R dan foto satuan berkualitas tinggi tanpa perlu login.
                  </p>
                  ${galleryUrl ? `
                    <div class="pt-1">
                      <span class="font-mono text-[10px] text-[#737373] bg-white px-2 py-1 border border-[#E5E5E5] inline-block truncate max-w-full">
                        ${galleryUrl}
                      </span>
                    </div>
                  ` : ''}
                </div>
              </div>
            </div>

            <!-- Countdown Timer & Tombol Selesai -->
            <div class="w-full flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-[#E5E5E5]">
              <div class="font-mono text-xs text-[#737373] flex items-center gap-2">
                <span class="w-2 h-2 bg-[#2BB673] inline-block"></span>
                <span>KEMBALI KE AWAL DALAM <strong id="done-countdown" class="text-xs font-semibold text-[#0A0A0A]">${remainingSeconds}</strong> DETIK</span>
              </div>

              <button
                id="btn-done-finish"
                class="btn-sb-primary btn-kiosk px-8 text-xs font-mono uppercase tracking-wider w-full sm:w-auto cursor-pointer"
              >
                SELESAI SEKARANG &rarr;
              </button>
            </div>

          </div>
        </div>
      `;

      const countdownEl = container.querySelector('#done-countdown');
      const finishBtn = container.querySelector('#btn-done-finish');
      const qrImgEl = container.querySelector('#qr-image');
      const qrLoadingEl = container.querySelector('#qr-loading');

      // Generate QR Code jika URL tersedia
      if (galleryUrl) {
        QRCode.toDataURL(galleryUrl, {
          margin: 1,
          width: 160,
          color: {
            dark: '#0A0A0A',
            light: '#FFFFFF'
          }
        })
          .then((dataUrl) => {
            if (!isMounted) return;
            if (qrImgEl && qrLoadingEl) {
              qrImgEl.src = dataUrl;
              qrImgEl.classList.remove('hidden');
              qrLoadingEl.classList.add('hidden');
            }
          })
          .catch((err) => {
            console.warn('[DoneScreen] Gagal generate QR:', err);
            if (qrLoadingEl) {
              qrLoadingEl.textContent = 'SCAN DI CETAKAN';
            }
          });
      } else {
        if (qrLoadingEl) {
          qrLoadingEl.textContent = 'SCAN DI CETAKAN';
        }
      }

      const handleFinish = () => {
        if (!isMounted) return;
        isMounted = false;
        if (timerInterval) clearInterval(timerInterval);
        if (typeof onFinished === 'function') {
          onFinished();
        }
      };

      finishBtn?.addEventListener('click', handleFinish);

      // Mulai hitung mundur
      timerInterval = setInterval(() => {
        if (!isMounted) return;
        remainingSeconds -= 1;
        if (countdownEl) {
          countdownEl.textContent = remainingSeconds;
        }

        if (remainingSeconds <= 0) {
          handleFinish();
        }
      }, 1000);
    },

    unmount() {
      isMounted = false;
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
    }
  };
}
