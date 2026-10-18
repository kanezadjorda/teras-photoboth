/**
 * Renders the standard page header used at the top of every admin menu.
 * @param {{ title: string, description: string, actionsHtml?: string }} options
 */
export function pageHeader({ title, description, actionsHtml = '' }) {
  return `
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 mb-6 border-b-[5px] border-black">
      <div>
        <h1 class="text-3xl font-headline uppercase tracking-tight text-black">${title}</h1>
        <p class="font-body text-sm text-black/70 mt-1">${description}</p>
      </div>
      <div class="flex flex-wrap items-center gap-3">${actionsHtml}</div>
    </div>
  `;
}

export function formatRupiah(amount) {
  return `RP ${Number(amount || 0).toLocaleString('id-ID')}`;
}
