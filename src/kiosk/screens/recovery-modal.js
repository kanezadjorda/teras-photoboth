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
        'fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6 select-none';

      let statusIndo = 'AKTIF';
      if (session.status === 'waiting_payment') statusIndo = 'MENUNGGU PEMBAYARAN';
      else if (session.status === 'choosing_template') statusIndo = 'MEMILIH TEMPLATE';
      else if (session.status === 'capturing') statusIndo = 'PENGAMBILAN FOTO';
      else if (session.status === 'reviewing') statusIndo = 'REVIEW & CETAK';
      else if (session.status === 'printing') statusIndo = 'PENCETAKAN';

      container.innerHTML = `
        <div class="card-sb border border-[#E5E5E5] bg-white max-w-lg w-full p-8 space-y-6">
          
          <!-- Header -->
          <div class="border-b border-[#E5E5E5] pb-4 space-y-2">
            <span class="chip-sb bg-[#FAFAFA] text-[#0A0A0A] border border-[#D4D4D8] text-xs font-mono uppercase tracking-wider inline-block">
              KETAHANAN SISTEM (PRD 12)
            </span>
            <h2 class="text-h3 font-semibold uppercase text-[#0A0A0A] tracking-tight">
              DITEMUKAN SESI BELUM SELESAI
            </h2>
            <p class="text-body-sm text-[#737373]">
              Aplikasi mendeteksi adanya transaksi atau sesi yang terputus sebelum selesai.
            </p>
          </div>

          <!-- Detail Sesi -->
          <div class="p-4 border border-[#E5E5E5] bg-[#FAFAFA] space-y-2.5">
            <div class="flex items-center justify-between font-mono text-xs">
              <span class="text-[#737373] uppercase">ID SESI:</span>
              <span class="font-medium text-[#0A0A0A]">${session.id}</span>
            </div>
            <div class="flex items-center justify-between font-mono text-xs">
              <span class="text-[#737373] uppercase">STATUS TERAKHIR:</span>
              <span class="chip-sb text-[10px] uppercase font-mono px-2 py-0.5 border border-[#D4D4D8] text-[#0A0A0A]">${statusIndo}</span>
            </div>
            <div class="flex items-center justify-between font-mono text-xs">
              <span class="text-[#737373] uppercase">WAKTU DIBUAT:</span>
              <span class="text-[#0A0A0A]">${session.dibuat_pada ? session.dibuat_pada.replace('T', ' ').slice(0, 19) : '-'}</span>
            </div>
          </div>

          <p class="text-body-sm text-[#737373] leading-relaxed">
            Pilih <strong class="text-[#0A0A0A]">LANJUTKAN SESI</strong> untuk kembali ke tahapan terakhir, atau <strong class="text-[#0A0A0A]">BATALKAN & MULAI BARU</strong> untuk menghapus sesi ini dan kembali ke layar awal.
          </p>

          <!-- Aksi Pilihan -->
          <div class="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              id="btn-discard-session"
              type="button"
              class="btn-sb-secondary flex-1 py-3 text-xs font-mono uppercase tracking-wider"
            >
              BATALKAN & MULAI BARU
            </button>
            <button
              id="btn-resume-session"
              type="button"
              class="btn-sb-primary flex-1 py-3 text-xs font-mono uppercase tracking-wider"
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

