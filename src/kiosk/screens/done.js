/**
 * Layar Kiosk: Layar Selesai (Soft File & QR Drive) (PRD F-20, F-19)
 * Memberikan instruksi pengambilan cetakan dan unduh soft file serta countdown 10 detik
 */

import { TIMEOUTS } from '../../shared/constants.js';

export function createDoneScreen({
  sessionNo = '0001',
  onFinished
}) {
  let isMounted = false;
  let timerInterval = null;
  let remainingSeconds = TIMEOUTS.DONE_SCREEN_SECONDS || 10;

  return {
    mount(container) {
      isMounted = true;

      container.innerHTML = `
        <div class="w-full h-full min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center p-8 select-none">
          <div class="card-sb max-w-xl w-full flex flex-col items-center text-center p-8 md:p-10 bg-white border border-[#E5E5E5]">
            
            <!-- Badge Sesi Selesai -->
            <div class="chip-sb mb-6 text-xs py-1 px-3 font-mono text-[#0A0A0A] bg-[#FAFAFA] border border-[#D4D4D8] uppercase tracking-wider">
              SESI SELESAI • TERIMA KASIH
            </div>

            <!-- Pesan Utama -->
            <h1 class="text-h2 font-semibold text-[#0A0A0A] tracking-tight mb-2 leading-tight">
              AMBIL HASIL CETAKANMU DI PRINTER!
            </h1>

            <p class="text-body-sm text-[#737373] max-w-lg mb-8 leading-relaxed">
              Foto Anda telah selesai dicetak. Silakan ambil lembaran cetak dari tray keluaran printer.
            </p>

            <!-- Box Info Soft File & Nomor Sesi -->
            <div class="w-full border border-[#E5E5E5] bg-[#FAFAFA] p-6 mb-8 text-left space-y-4">
              <div class="flex items-center justify-between border-b border-[#E5E5E5] pb-3">
                <span class="font-mono text-xs uppercase tracking-wider text-[#737373]">NOMOR SESI ANDA:</span>
                <span class="font-mono font-semibold text-xl text-[#0A0A0A] tracking-wider">#${sessionNo}</span>
              </div>
              <div class="flex items-start gap-4 pt-1">
                <div class="bg-[#0A0A0A] text-[#FAFAFA] font-mono text-xs font-semibold w-8 h-8 flex items-center justify-center shrink-0">
                  QR
                </div>
                <div>
                  <div class="text-body-sm font-semibold uppercase text-[#0A0A0A] mb-1">
                    UNDUH SOFT FILE DIGITAL
                  </div>
                  <div class="text-caption text-[#737373] leading-relaxed">
                    Pindai (scan) kode QR yang tercetak di sudut lembar foto Anda menggunakan kamera HP untuk mengunduh soft file foto beresolusi tinggi langsung dari Google Drive.
                  </div>
                </div>
              </div>
            </div>

            <!-- Countdown Timer & Tombol Selesai -->
            <div class="w-full flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              <div class="font-mono text-xs text-[#737373] flex items-center gap-2">
                <span class="w-2 h-2 bg-[#2BB673] inline-block"></span>
                <span>KEMBALI KE AWAL DALAM <strong id="done-countdown" class="text-xs font-semibold text-[#0A0A0A]">${remainingSeconds}</strong> DETIK</span>
              </div>

              <button
                id="btn-done-finish"
                class="btn-sb-primary btn-kiosk px-8 text-xs font-mono uppercase tracking-wider w-full sm:w-auto"
              >
                SELESAI SEKARANG &rarr;
              </button>
            </div>

          </div>
        </div>
      `;

      const countdownEl = container.querySelector('#done-countdown');
      const finishBtn = container.querySelector('#btn-done-finish');

      const handleFinish = () => {
        if (!isMounted) return;
        isMounted = false;
        if (timerInterval) clearInterval(timerInterval);
        if (typeof onFinished === 'function') {
          onFinished();
        }
      };

      finishBtn?.addEventListener('click', handleFinish);

      // Mulai hitung mundur 10 detik
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
