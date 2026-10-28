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

      // 1. Render UI Kiosk StudioBlank
      container.innerHTML = `
        <div class="w-full h-full min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center p-8 select-none">
          <div class="card-sb max-w-lg w-full flex flex-col items-center text-center p-8 md:p-10 bg-white border border-[#E5E5E5]">
            
            <!-- Header Status -->
            <div class="chip-sb mb-6 text-xs py-1 px-3 font-mono text-[#737373] uppercase tracking-wider">
              STATUS PERANGKAT: MENCETAK
            </div>

            <!-- Judul Utama -->
            <h1 class="text-h2 font-semibold text-[#0A0A0A] tracking-tight mb-2">
              SEDANG MENCETAK HASIL FOTOMU!
            </h1>

            <p class="text-body-sm text-[#737373] max-w-md mb-8 leading-relaxed">
              Kertas foto ukuran 4R sedang diproses oleh printer. Mohon tunggu beberapa saat dan jangan matikan printer.
            </p>

            <!-- Thumbnail Preview -->
            <div class="w-44 h-64 border border-[#E5E5E5] overflow-hidden mb-6 bg-[#FAFAFA] flex items-center justify-center relative">
              ${
                compositeUrl
                  ? `<img src="${compositeUrl}" alt="Preview Cetak" class="w-full h-full object-cover" />`
                  : `<div class="font-mono text-xs text-[#737373]">PRATINJAU FOTO</div>`
              }
              <div class="absolute bottom-2 right-2 bg-[#0A0A0A] text-[#FAFAFA] text-[10px] font-mono px-2 py-0.5 tracking-wider">
                4R 300 DPI
              </div>
            </div>

            <!-- Indikator Jumlah Salinan -->
            <div class="w-full border border-[#E5E5E5] p-3 mb-6 flex items-center justify-between font-mono text-xs text-[#0A0A0A] bg-[#FAFAFA]">
              <span class="font-medium uppercase text-[#737373]">JUMLAH SALINAN:</span>
              <span class="bg-[#0A0A0A] text-[#FAFAFA] font-medium px-2.5 py-1 text-xs">${copies} LEMBAR</span>
            </div>

            <!-- Minimal Loading Bar -->
            <div class="w-full h-1.5 bg-[#E5E5E5] overflow-hidden relative mb-3">
              <div class="h-full bg-[#0A0A0A] animate-pulse w-full"></div>
            </div>

            <div class="text-mono text-xs text-[#737373] uppercase tracking-wider">
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
            const selectedPrinter = typeof localStorage !== 'undefined' ? localStorage.getItem('selected_printer_name') : null;
            const printResult = await window.photobooth.printSilent({
              copies: validCopies,
              deviceName: selectedPrinter || undefined
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
