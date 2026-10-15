/**
 * Modal / Layar Pemulihan Sesi (PRD Bagian 7 & 12)
 * Ditampilkan saat kiosk mendeteksi sesi menggantung akibat aplikasi ditutup/listrik mati mendadak
 */

export function createRecoveryModal({ session, onResume, onDiscard }) {
  let container = null;

  return {
    mount(parent) {
      container = document.createElement('div');
      container.className =
        'fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-6 select-none';

      let statusIndo = 'AKTIF';
      if (session.status === 'waiting_payment') statusIndo = 'MENUNGGU PEMBAYARAN';
      else if (session.status === 'choosing_template') statusIndo = 'MEMILIH TEMPLATE';
      else if (session.status === 'capturing') statusIndo = 'PENGAMBILAN FOTO';
      else if (session.status === 'reviewing') statusIndo = 'REVIEW & CETAK';
      else if (session.status === 'printing') statusIndo = 'PENCETAKAN';

      container.innerHTML = `
        <div class="card-raw border-[5px] border-black bg-white max-w-lg w-full p-8 space-y-6 shadow-none">
          
          <!-- Header -->
          <div class="border-b-[3px] border-black pb-4 space-y-2">
            <span class="chip-raw bg-black text-white text-xs font-mono font-bold tracking-widest uppercase">
              KETAHANAN SISTEM (PRD 12)
            </span>
            <h2 class="text-2xl font-headline uppercase text-black tracking-tight">
              DITEMUKAN SESI BELUM SELESAI
            </h2>
            <p class="font-body text-xs text-black/70">
              Aplikasi mendeteksi adanya transaksi atau sesi yang terputus sebelum selesai.
            </p>
          </div>

          <!-- Detail Sesi -->
          <div class="p-4 border-[3px] border-black bg-raw-sunken space-y-2">
            <div class="flex items-center justify-between font-mono text-xs">
              <span class="text-black/60 uppercase">ID SESI:</span>
              <span class="font-bold text-black">${session.id}</span>
            </div>
            <div class="flex items-center justify-between font-mono text-xs">
              <span class="text-black/60 uppercase">STATUS TERAKHIR:</span>
              <span class="chip-raw chip-raw-warning text-[10px] uppercase font-bold">${statusIndo}</span>
            </div>
            <div class="flex items-center justify-between font-mono text-xs">
              <span class="text-black/60 uppercase">WAKTU DIBUAT:</span>
              <span class="text-black">${session.dibuat_pada ? session.dibuat_pada.replace('T', ' ').slice(0, 19) : '-'}</span>
            </div>
          </div>

          <p class="font-body text-xs text-black/80 leading-relaxed">
            Pilih <strong>LANJUTKAN SESI</strong> untuk kembali ke tahapan terakhir, atau <strong>BATALKAN & MULAI BARU</strong> untuk menghapus sesi ini dan kembali ke layar awal.
          </p>

          <!-- Aksi Pilihan -->
          <div class="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              id="btn-discard-session"
              type="button"
              class="btn-raw-destructive flex-1 py-4 text-xs font-headline uppercase"
            >
              BATALKAN & MULAI BARU
            </button>
            <button
              id="btn-resume-session"
              type="button"
              class="btn-raw-primary flex-1 py-4 text-xs font-headline uppercase"
            >
              LANJUTKAN SESI
            </button>
          </div>
        </div>
      `;

      parent.appendChild(container);

      container.querySelector('#btn-resume-session')?.addEventListener('click', () => {
        if (typeof onResume === 'function') {
          onResume(session);
        }
      });

      container.querySelector('#btn-discard-session')?.addEventListener('click', () => {
        if (typeof onDiscard === 'function') {
          onDiscard(session);
        }
      });
    },

    unmount() {
      if (container && container.parentNode) {
        container.parentNode.removeChild(container);
        container = null;
      }
    }
  };
}
