/**
 * Layar Kiosk: Modul Pencetakan Otomatis 4R & Salinan (PRD F-12)
 * Merender layout print CSS @page dan mengirim instruksi cetak senyap
 */

export function createPrintingScreen({
  compositeUrl,
  copies = 1,
  onPrinted
}) {
  let isMounted = false;
  let printContainer = null;
  let printTimeout = null;

  return {
    mount(container) {
      isMounted = true;

      // 1. Render UI Kiosk RawBlock Brutalism
      container.innerHTML = `
        <div class="w-full h-full min-h-screen bg-white flex flex-col items-center justify-center p-8 select-none">
          <div class="card-raw-elevated max-w-xl w-full flex flex-col items-center text-center p-8 bg-white border-5 border-black">
            
            <!-- Header Status -->
            <div class="chip-raw chip-raw-default mb-6 text-sm py-1.5 px-4 font-mono font-bold tracking-widest uppercase">
              STATUS PERANGKAT: MENCETAK
            </div>

            <!-- Judul Utama -->
            <h1 class="font-headline text-3xl md:text-4xl text-black uppercase tracking-tight mb-4">
              SEDANG MENCETAK HASIL FOTOMU!
            </h1>

            <p class="font-body text-base text-black/80 max-w-md mb-6 leading-relaxed">
              Kertas foto ukuran 4R sedang diproses oleh printer. Mohon tunggu beberapa saat dan jangan matikan printer.
            </p>

            <!-- Thumbnail Preview -->
            <div class="w-48 h-72 border-3 border-black overflow-hidden mb-6 bg-raw-sunken flex items-center justify-center relative">
              ${
                compositeUrl
                  ? `<img src="${compositeUrl}" alt="Preview Cetak" class="w-full h-full object-cover" />`
                  : `<div class="font-mono text-xs text-black/60">PRATINJAU FOTO</div>`
              }
              <div class="absolute bottom-2 right-2 bg-black text-white text-xs font-mono px-2 py-0.5 font-bold uppercase">
                4R 300 DPI
              </div>
            </div>

            <!-- Indikator Jumlah Salinan -->
            <div class="w-full bg-raw-sunken border-3 border-black p-3 mb-6 flex items-center justify-between font-mono text-sm">
              <span class="font-bold text-black uppercase">JUMLAH SALINAN:</span>
              <span class="bg-black text-white font-bold px-3 py-1 text-sm">${copies} LEMBAR</span>
            </div>

            <!-- Brutalist Loading Bar -->
            <div class="w-full h-6 border-3 border-black bg-white overflow-hidden p-0.5 relative">
              <div class="h-full bg-black animate-pulse w-full"></div>
            </div>

            <div class="font-mono text-xs text-black/60 mt-3 uppercase tracking-wider">
              SINKRONISASI SPOOLER PRINTER...
            </div>
          </div>
        </div>
      `;

      // 2. Siapkan elemen cetak off-screen di body untuk @media print
      // Hapus jika sebelumnya ada container sisa
      const existingContainer = document.getElementById('photobooth-print-container');
      if (existingContainer) {
        existingContainer.remove();
      }

      printContainer = document.createElement('div');
      printContainer.id = 'photobooth-print-container';

      // Render sebanyak jumlah copies (N lembar)
      const validCopies = Math.max(1, parseInt(copies, 10) || 1);
      let pagesHtml = '';
      for (let i = 0; i < validCopies; i++) {
        pagesHtml += `
          <div class="print-page">
            <img src="${compositeUrl}" alt="Cetak Salinan ${i + 1}" />
          </div>
        `;
      }
      printContainer.innerHTML = pagesHtml;
      document.body.appendChild(printContainer);

      // 3. Jalankan silent print setelah memberi waktu browser merender gambar
      printTimeout = setTimeout(async () => {
        if (!isMounted) return;

        try {
          console.log(`[Printing] Memulai pencetakan ${validCopies} salinan...`);

          if (window.photobooth?.printSilent) {
            const printResult = await window.photobooth.printSilent({
              copies: validCopies
            });
            console.log('[Printing] Hasil silent print Electron:', printResult);
          } else {
            // Fallback mode browser web
            console.log('[Printing] Fallback ke window.print()...');
            window.print();
          }
        } catch (err) {
          console.error('[Printing] Error saat memanggil print:', err);
        }

        // Beri jeda 2 detik sebelum berpindah ke Done Screen
        setTimeout(() => {
          if (isMounted && typeof onPrinted === 'function') {
            onPrinted();
          }
        }, 2000);
      }, 800);
    },

    unmount() {
      isMounted = false;
      if (printTimeout) {
        clearTimeout(printTimeout);
      }
      if (printContainer && printContainer.parentNode) {
        printContainer.remove();
        printContainer = null;
      }
    }
  };
}
