/**
 * Renders the standard page header used at the top of every admin menu.
 * @param {{ title: string, description: string, actionsHtml?: string }} options
 */
export function pageHeader({ title, description, actionsHtml = '' }) {
  return `
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 mb-6 border-b border-[#E5E5E5]">
      <div>
        <h1 class="text-h2 font-semibold text-[#0A0A0A] tracking-tight uppercase">${title}</h1>
        <p class="text-body-sm text-[#737373] mt-1">${description}</p>
      </div>
      <div class="flex flex-wrap items-center gap-2 sm:gap-3">${actionsHtml}</div>
    </div>
  `;
}

export function formatRupiah(amount) {
  return `RP ${Number(amount || 0).toLocaleString('id-ID')}`;
}

