import { api } from '../../shared/api.js';
import { pageHeader, formatRupiah } from '../ui-helpers.js';

export function createReportsScreen() {
  let container = null;
  let isReprinting = false;

  async function loadEventFilter(el) {
    const select = el.querySelector('#select-report-event');
    if (!select) return;
    try {
      const res = await api.getEvents();
      if (!res.success || !res.data) return;
      const currentVal = select.value || '';
      const options = [
        '<option value="">SEMUA EVENT</option>',
        ...res.data.map(
          (e) => `<option value="${e.id}" ${e.id === currentVal ? 'selected' : ''}>${e.nama}${e.aktif ? ' [AKTIF]' : ''}</option>`
        )
      ];
      select.innerHTML = options.join('');
    } catch (err) {
      console.warn('Gagal memuat filter event:', err.message);
    }
  }

  async function loadDailyReport() {
    if (!container) return;
    try {
      const eventId = container.querySelector('#select-report-event')?.value || '';
      const res = await api.getDailyReport(eventId);
      if (!res.success || !res.data) return;
      const { today, all_time } = res.data;

      const todaySessionsEl = container.querySelector('#report-today-sessions');
      const todayPaidEl = container.querySelector('#report-today-paid');
      const todayRevenueEl = container.querySelector('#report-today-revenue');

      const alltimeSessionsEl = container.querySelector('#report-alltime-sessions');
      const alltimePaidEl = container.querySelector('#report-alltime-paid');
      const alltimeRevenueEl = container.querySelector('#report-alltime-revenue');

      if (todaySessionsEl) todaySessionsEl.textContent = `${today.total_sessions} SESI`;
      if (todayPaidEl) todayPaidEl.textContent = `${today.paid_sessions} LUNAS`;
      if (todayRevenueEl) todayRevenueEl.textContent = formatRupiah(today.revenue);

      if (alltimeSessionsEl) alltimeSessionsEl.textContent = `${all_time.total_sessions} SESI`;
      if (alltimePaidEl) alltimePaidEl.textContent = `${all_time.paid_sessions} LUNAS`;
      if (alltimeRevenueEl) alltimeRevenueEl.textContent = formatRupiah(all_time.revenue);
    } catch (err) {
      console.warn('Gagal memuat laporan harian:', err.message);
    }
  }

  async function loadHistory() {
    if (!container) return;
    const tableBody = container.querySelector('#history-table-body');
    if (!tableBody) return;

    try {
      const eventId = container.querySelector('#select-report-event')?.value || '';
      const res = await api.getHistory(eventId);
      if (!res.success || !res.data) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="8" class="p-4 text-center text-raw-error font-body">Gagal memuat riwayat transaksi</td>
          </tr>
        `;
        return;
      }

      const rows = res.data;
      if (rows.length === 0) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="8" class="p-4 text-center text-black/60 font-body">Belum ada riwayat transaksi sesi</td>
          </tr>
        `;
        return;
      }

      tableBody.innerHTML = rows
        .map((r) => {
          const sessionNo = r.formatted_session_no || String(r.session_no).padStart(4, '0');
          const eventName = r.event_nama || 'Event Reguler';
          const dateStr = r.dibuat_pada ? r.dibuat_pada.replace('T', ' ').slice(0, 19) : '-';
          const templateName = r.template_nama || 'Belum Dipilih';
          const nominalStr = formatRupiah(r.nominal);

          let sessionBadge = 'chip-sb border border-[#E5E5E5] text-[#737373]';
          if (r.session_status === 'done') sessionBadge = 'chip-sb border border-[#2BB673]/40 text-[#0A0A0A] bg-[#2BB673]/10';
          else if (r.session_status === 'cancelled') sessionBadge = 'chip-sb border border-[#E5484D]/40 text-[#E5484D] bg-[#E5484D]/10';
          else if (r.session_status === 'capturing' || r.session_status === 'reviewing') sessionBadge = 'chip-sb border border-[#FFD166]/40 text-[#0A0A0A] bg-[#FFD166]/10';

          let payBadge = 'chip-sb border border-[#E5E5E5] text-[#737373]';
          if (r.payment_status === 'lunas' || r.payment_status === 'paid') {
            payBadge = 'chip-sb border border-[#2BB673]/40 text-[#0A0A0A] bg-[#2BB673]/10';
          } else if (
            r.payment_status === 'batal' ||
            r.payment_status === 'gagal' ||
            r.payment_status === 'failed' ||
            r.payment_status === 'expired' ||
            r.payment_status === 'cancelled'
          ) {
            payBadge = 'chip-sb border border-[#E5484D]/40 text-[#E5484D] bg-[#E5484D]/10';
          } else if (
            r.payment_status === 'menunggu' ||
            r.payment_status === 'unpaid' ||
            r.payment_status === 'pending'
          ) {
            payBadge = 'chip-sb border border-[#FFD166]/40 text-[#0A0A0A] bg-[#FFD166]/10';
          }

          const canReprint = Boolean(r.composite_path);
          const reprintBtn = canReprint
            ? `<button type="button" class="btn-sb-secondary text-xs px-3 py-1 font-mono uppercase btn-reprint" data-session-id="${r.id}" data-session-no="${sessionNo}">
                CETAK ULANG
              </button>`
            : '<span class="text-[#737373] text-[11px] font-mono">-</span>';

          return `
            <tr class="hover:bg-[#FAFAFA] border-b border-[#E5E5E5] transition-colors">
              <td class="p-3 sm:p-4 font-semibold text-[#0A0A0A] font-mono text-xs sm:text-sm whitespace-nowrap">${sessionNo}</td>
              <td class="p-3 sm:p-4 text-[#737373] font-mono text-[11px] sm:text-xs">${eventName}</td>
              <td class="p-3 sm:p-4 text-[#737373] font-mono text-[11px] sm:text-xs whitespace-nowrap">${dateStr}</td>
              <td class="p-3 sm:p-4 text-[#0A0A0A] font-mono text-xs sm:text-sm">${templateName}</td>
              <td class="p-3 sm:p-4 font-mono font-medium text-[#0A0A0A] text-xs sm:text-sm whitespace-nowrap">${nominalStr}</td>
              <td class="p-3 sm:p-4 whitespace-nowrap">
                <span class="${sessionBadge} uppercase text-[11px]">${r.session_status || '-'}</span>
              </td>
              <td class="p-3 sm:p-4 whitespace-nowrap">
                <span class="${payBadge} uppercase text-[11px]">${r.payment_status || '-'}</span>
              </td>
              <td class="p-3 sm:p-4 text-center whitespace-nowrap">${reprintBtn}</td>
            </tr>
          `;
        })
        .join('');
    } catch (err) {
      console.warn('Gagal memuat history:', err.message);
      tableBody.innerHTML = `
        <tr>
          <td colspan="8" class="p-4 text-center text-raw-error font-body">Kesalahan memuat riwayat: ${err.message}</td>
        </tr>
      `;
    }
  }

  async function handleReprint(sessionId, sessionNo, btn) {
    if (isReprinting) return;
    if (!confirm(`Cetak ulang foto untuk Sesi #${sessionNo}?`)) {
      return;
    }
    isReprinting = true;
    const origText = btn ? btn.textContent : '';
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'MENCETAK...';
      btn.classList.add('opacity-50');
    }

    try {
      const res = await api.reprintSession(sessionId);
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Data foto tidak tersedia');
      }

      const existingContainer = document.getElementById('photobooth-print-container');
      if (existingContainer) existingContainer.remove();

      const printContainer = document.createElement('div');
      printContainer.id = 'photobooth-print-container';
      printContainer.innerHTML = `
        <div class="print-page">
          <img src="${res.data.compositeUrl}" alt="Reprint Sesi #${res.data.sessionNo}" />
        </div>
      `;
      document.body.appendChild(printContainer);

      if (window.photobooth?.printSilent) {
        const selectedPrinter = typeof localStorage !== 'undefined' ? localStorage.getItem('selected_printer_name') : null;
        await window.photobooth.printSilent({
          copies: 1,
          deviceName: selectedPrinter || undefined
        });
      } else {
        window.print();
      }

      setTimeout(() => {
        printContainer.remove();
      }, 1000);

      alert(`Instruksi cetak ulang untuk Sesi #${res.data.sessionNo} telah dikirim ke printer!`);
    } catch (err) {
      alert('Gagal mencetak ulang: ' + err.message);
    } finally {
      isReprinting = false;
      if (btn) {
        btn.disabled = false;
        btn.textContent = origText;
        btn.classList.remove('opacity-50');
      }
    }
  }

  async function reloadAll() {
    if (!container) return;
    await loadEventFilter(container);
    await Promise.all([loadDailyReport(), loadHistory()]);
  }

  function setupEventListeners(el) {
    const filterSelect = el.querySelector('#select-report-event');
    const refreshBtn = el.querySelector('#btn-refresh-history');
    const exportBtn = el.querySelector('#btn-export-csv');
    const tableBody = el.querySelector('#history-table-body');

    filterSelect?.addEventListener('change', () => {
      Promise.all([loadDailyReport(), loadHistory()]);
    });

    refreshBtn?.addEventListener('click', () => {
      reloadAll();
    });

    exportBtn?.addEventListener('click', () => {
      const currentEventId = filterSelect?.value || '';
      const url = api.getExportCsvUrl(currentEventId);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', '');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });

    tableBody?.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-reprint');
      if (btn) {
        const sessionId = btn.getAttribute('data-session-id');
        const sessionNo = btn.getAttribute('data-session-no');
        if (sessionId) {
          handleReprint(sessionId, sessionNo, btn);
        }
      }
    });
  }

  return {
    mount(parent) {
      container = document.createElement('div');
      container.innerHTML = `
        ${pageHeader({
          title: 'LAPORAN',
          description: 'Omset, riwayat transaksi, dan cetak ulang',
          actionsHtml: `
            <div class="flex items-center gap-2">
              <span class="text-caption font-mono uppercase text-[#737373] font-medium">FILTER:</span>
              <select id="select-report-event" class="input-sb py-1.5 px-3 text-xs font-mono bg-white">
                <option value="">SEMUA EVENT</option>
              </select>
            </div>
            <button id="btn-refresh-history" class="btn-sb-secondary px-4 py-2 text-xs font-mono uppercase tracking-wider">
              REFRESH
            </button>
            <button id="btn-export-csv" class="btn-sb-primary px-4 py-2 text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-2">
              <span>EKSPOR CSV</span>
            </button>
          `
        })}

        <!-- 4 Kartu Ringkasan -->
        <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6 mb-6">
          <div class="card-sb p-6 border border-[#E5E5E5] bg-white">
            <span class="text-caption font-mono uppercase text-[#737373] tracking-wider font-medium">TOTAL SESI HARI INI</span>
            <div class="mt-2 flex items-baseline justify-between">
              <span id="report-today-sessions" class="text-h2 font-semibold text-[#0A0A0A] tracking-tight">0 SESI</span>
              <span id="report-today-paid" class="font-mono text-xs text-[#737373]">0 LUNAS</span>
            </div>
          </div>

          <div class="card-sb p-6 border border-[#E5E5E5] bg-white">
            <span class="text-caption font-mono uppercase text-[#737373] tracking-wider font-medium">OMSET HARI INI</span>
            <div class="mt-2">
              <span id="report-today-revenue" class="text-h2 font-semibold text-[#0A0A0A] tracking-tight">RP 0</span>
            </div>
          </div>

          <div class="card-sb p-6 border border-[#E5E5E5] bg-white">
            <span class="text-caption font-mono uppercase text-[#737373] tracking-wider font-medium">TOTAL SESI (AKUMULASI)</span>
            <div class="mt-2 flex items-baseline justify-between">
              <span id="report-alltime-sessions" class="text-h2 font-semibold text-[#0A0A0A] tracking-tight">0 SESI</span>
              <span id="report-alltime-paid" class="font-mono text-xs text-[#737373]">0 LUNAS</span>
            </div>
          </div>

          <div class="card-sb p-6 border border-[#E5E5E5] bg-white">
            <span class="text-caption font-mono uppercase text-[#737373] tracking-wider font-medium">TOTAL OMSET (AKUMULASI)</span>
            <div class="mt-2">
              <span id="report-alltime-revenue" class="text-h2 font-semibold text-[#0A0A0A] tracking-tight">RP 0</span>
            </div>
          </div>
        </div>

        <!-- Tabel Riwayat Transaksi -->
        <div class="card-sb bg-white p-0 overflow-hidden mb-6 border border-[#E5E5E5]">
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr class="bg-[#FAFAFA] text-[#737373] border-b border-[#E5E5E5] uppercase">
                  <th class="p-3 sm:p-4 font-medium w-24 sm:w-28 min-w-[90px]">NO SESI</th>
                  <th class="p-3 sm:p-4 font-medium min-w-[140px]">EVENT</th>
                  <th class="p-3 sm:p-4 font-medium w-36 sm:w-44 min-w-[140px]">WAKTU (WIB)</th>
                  <th class="p-3 sm:p-4 font-medium min-w-[140px]">TEMPLATE</th>
                  <th class="p-3 sm:p-4 font-medium w-32 sm:w-36 min-w-[110px]">NOMINAL</th>
                  <th class="p-3 sm:p-4 font-medium w-32 sm:w-36 min-w-[120px]">STATUS SESI</th>
                  <th class="p-3 sm:p-4 font-medium w-32 sm:w-36 min-w-[120px]">PEMBAYARAN</th>
                  <th class="p-3 sm:p-4 font-medium text-center w-36 sm:w-40 min-w-[130px]">AKSI REPRINT</th>
                </tr>
              </thead>
              <tbody id="history-table-body" class="divide-y divide-[#E5E5E5]">
                <tr>
                  <td colspan="8" class="p-4 text-center text-[#737373] font-mono text-xs">
                    Memuat data riwayat transaksi...
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      `;

      parent.appendChild(container);
      setupEventListeners(container);
      reloadAll();
    },
    refresh() {
      if (container) {
        Promise.all([loadDailyReport(), loadHistory()]);
      }
    },
    unmount() {
      container?.remove();
      container = null;
    }
  };
}

