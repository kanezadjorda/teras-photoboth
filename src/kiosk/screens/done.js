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
        <div class="w-full h-full min-h-screen bg-white flex flex-col items-center justify-center p-8 select-none">
          <div class="card-raw-elevated max-w-2xl w-full flex flex-col items-center text-center p-10 bg-white border-5 border-black">
            
            <!-- Badge Sesi Selesai -->
            <div class="chip-raw chip-raw-active mb-6 text-sm py-2 px-5 font-mono font-bold tracking-widest uppercase">
              SESI SELESAI • TERIMA KASIH
            </div>

            <!-- Pesan Utama -->
            <h1 class="font-headline text-3xl md:text-5xl text-black uppercase tracking-tight mb-4 leading-tight">
              AMBIL HASIL CETAKANMU DI PRINTER!
            </h1>

            <p class="font-body text-lg text-black/85 max-w-lg mb-8 leading-relaxed">
              Foto Anda telah selesai dicetak. Silakan ambil lembaran cetak dari tray keluaran printer.
            </p>

            <!-- Box Info Soft File & Nomor Sesi -->
            <div class="w-full bg-raw-sunken border-3 border-black p-6 mb-8 text-left space-y-4">
              <div class="flex items-center justify-between border-b-2 border-black/20 pb-3">
                <span class="font-mono text-xs uppercase tracking-wider text-black/70">NOMOR SESI ANDA:</span>
                <span class="font-headline text-2xl text-black tracking-wider">#${sessionNo}</span>
              </div>
              <div class="flex items-start gap-4 pt-1">
                <div class="bg-black text-white font-mono text-xl font-bold w-10 h-10 flex items-center justify-center shrink-0 border-2 border-black">
                  QR
                </div>
                <div>
                  <div class="font-headline text-sm uppercase text-black mb-1">
                    UNDUH SOFT FILE DIGITAL
                  </div>
                  <div class="font-body text-xs text-black/70 leading-normal">
                    Pindai (scan) kode QR yang tercetak di sudut lembar foto Anda menggunakan kamera HP untuk mengunduh soft file foto beresolusi tinggi langsung dari Google Drive.
                  </div>
                </div>
              </div>
            </div>

            <!-- Countdown Timer & Tombol Selesai -->
            <div class="w-full flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              <div class="font-mono text-sm text-black flex items-center gap-2">
                <span class="w-3 h-3 bg-raw-success inline-block"></span>
                <span>KEMBALI KE AWAL DALAM <strong id="done-countdown" class="text-base">${remainingSeconds}</strong> DETIK</span>
              </div>

              <button
                id="btn-done-finish"
                class="btn-raw-primary min-h-14 px-8 text-base w-full sm:w-auto"
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
