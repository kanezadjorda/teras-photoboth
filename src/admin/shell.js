import { api } from '../shared/api.js';
import { ADMIN_ROUTES, DEFAULTS, TIMEOUTS } from '../shared/constants.js';
import { getCameraDevices } from '../shared/camera.js';
import { parseAdminRoute, toAdminHash } from './router.js';
import { createHomeScreen } from './screens/home.js';
import { createEventsScreen } from './screens/events.js';
import { createReportsScreen } from './screens/reports.js';
import { createSettingsScreen } from './screens/settings.js';
import { createTemplateEditor } from './screens/template-editor.js';

const SSE_URL = `http://localhost:${DEFAULTS.SERVER_PORT}/api/sse`;
const SSE_EVENTS = ['session_created', 'session_updated', 'payment_paid', 'payment_expired', 'payment_cancelled'];

const NAV_ITEMS = [
  { route: ADMIN_ROUTES.HOME, label: 'BERANDA' },
  { route: ADMIN_ROUTES.EVENTS, label: 'EVENT' },
  { route: ADMIN_ROUTES.REPORTS, label: 'LAPORAN' },
  { route: ADMIN_ROUTES.TEMPLATES, label: 'TEMPLATE' },
  { route: ADMIN_ROUTES.SETTINGS, label: 'PENGATURAN' }
];

export function createAdminShell({ onLock }) {
  let container = null;
  let contentEl = null;
  let currentScreen = null;
  let pollTimer = null;
  let sse = null;
  let lastWaitingSessionId = null;

  const refreshTopBar = () => {
    updateEventStatus();
    updateCameraStatus();
    updatePrinterStatus();
  };

  const screenFactories = {
    [ADMIN_ROUTES.HOME]: () => createHomeScreen({ onStatusChange: refreshTopBar }),
    [ADMIN_ROUTES.EVENTS]: () => createEventsScreen({ onStatusChange: refreshTopBar }),
    [ADMIN_ROUTES.REPORTS]: () => createReportsScreen(),
    [ADMIN_ROUTES.TEMPLATES]: () =>
      createTemplateEditor({ onBack: () => { window.location.hash = toAdminHash(ADMIN_ROUTES.HOME); } }),
    [ADMIN_ROUTES.SETTINGS]: () => createSettingsScreen()
  };

  function renderRoute() {
    const route = parseAdminRoute(window.location.hash);
    currentScreen?.unmount?.();
    contentEl.innerHTML = '';
    currentScreen = screenFactories[route]();
    currentScreen.mount(contentEl);
    highlightNav(route);
  }

  function highlightNav(route) {
    if (!container) return;
    const navLinks = container.querySelectorAll('[data-route]');
    navLinks.forEach((link) => {
      const isActive = link.getAttribute('data-route') === route;
      if (isActive) {
        link.classList.remove('text-white', 'hover:bg-white/10');
        link.classList.add('bg-white', 'text-black');
        link.setAttribute('aria-current', 'page');
      } else {
        link.classList.remove('bg-white', 'text-black');
        link.classList.add('text-white', 'hover:bg-white/10');
        link.removeAttribute('aria-current');
      }
    });
  }

  async function updateEventStatus() {
    if (!container) return;
    const topbarEvent = container.querySelector('#topbar-event');
    if (!topbarEvent) return;
    try {
      const res = await api.getEvents();
      const activeEvent = res.data?.find((e) => e.aktif === 1);
      if (activeEvent) {
        topbarEvent.textContent = `EVENT: ${activeEvent.nama.toUpperCase()}`;
        topbarEvent.className = 'chip-raw chip-raw-active text-xs';
      } else {
        topbarEvent.textContent = 'EVENT: TANPA EVENT';
        topbarEvent.className = 'chip-raw chip-raw-warning text-xs';
      }
    } catch (err) {
      topbarEvent.textContent = 'EVENT: ERROR';
      topbarEvent.className = 'chip-raw chip-raw-error text-xs';
    }
  }

  async function updateCameraStatus() {
    if (!container) return;
    const topbarCamera = container.querySelector('#topbar-camera');
    if (!topbarCamera) return;
    try {
      const devices = await getCameraDevices();
      if (!devices || devices.length === 0) {
        topbarCamera.textContent = 'KAMERA: TIDAK ADA';
        topbarCamera.className = 'chip-raw chip-raw-error text-xs';
        return;
      }
      const savedCamId = typeof localStorage !== 'undefined' ? localStorage.getItem('selected_camera_id') : null;
      let selectedDev = devices.find((d) => d.deviceId === savedCamId);
      if (!selectedDev) {
        selectedDev = devices.find((d) => d.isExternal) || devices[0];
      }
      if (selectedDev.isExternal) {
        topbarCamera.textContent = 'KAMERA: EKSTERNAL';
        topbarCamera.className = 'chip-raw chip-raw-active text-xs';
      } else {
        topbarCamera.textContent = 'KAMERA: LAPTOP';
        topbarCamera.className = 'chip-raw chip-raw-active text-xs';
      }
    } catch (err) {
      topbarCamera.textContent = 'KAMERA: ERROR';
      topbarCamera.className = 'chip-raw chip-raw-error text-xs';
    }
  }

  async function updatePrinterStatus() {
    if (!container) return;
    const topbarPrinter = container.querySelector('#topbar-printer');
    if (!topbarPrinter) return;
    try {
      let printers = [];
      if (window.photobooth?.getPrinters) {
        printers = await window.photobooth.getPrinters();
      }
      if (!printers || printers.length === 0) {
        topbarPrinter.textContent = 'PRINTER: TIDAK ADA';
        topbarPrinter.className = 'chip-raw chip-raw-error text-xs';
      } else {
        topbarPrinter.textContent = 'PRINTER: OK';
        topbarPrinter.className = 'chip-raw chip-raw-active text-xs';
      }
    } catch (err) {
      topbarPrinter.textContent = 'PRINTER: ERROR';
      topbarPrinter.className = 'chip-raw chip-raw-error text-xs';
    }
  }

  async function pollWaitingSession() {
    try {
      const res = await api.getCurrentSession();
      const waitingId = res.data?.status === 'waiting_payment' ? res.data.id : null;
      setHomeBadge(Boolean(waitingId));
      if (waitingId !== lastWaitingSessionId) {
        lastWaitingSessionId = waitingId;
        currentScreen?.refresh?.();
      }
    } catch (err) {
      console.warn('[Admin] Gagal mengecek sesi aktif:', err.message);
    }
  }

  function setHomeBadge(visible) {
    if (!container) return;
    const badge = container.querySelector('#nav-badge-home');
    if (!badge) return;
    if (visible) {
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  function connectServerEvents() {
    try {
      sse = new EventSource(SSE_URL);
      const handleServerEvent = () => {
        pollWaitingSession();
        currentScreen?.refresh?.();
      };
      SSE_EVENTS.forEach((name) => sse.addEventListener(name, handleServerEvent));
    } catch (err) {
      console.warn('[Admin] SSE tidak tersedia:', err.message);
    }
  }

  return {
    mount(parent) {
      container = document.createElement('div');
      container.className = 'flex min-h-screen';
      container.innerHTML = renderLayout();
      parent.appendChild(container);
      contentEl = container.querySelector('#admin-content');

      container.querySelector('#btn-lock-panel').addEventListener('click', () => onLock?.());
      window.addEventListener('hashchange', renderRoute);

      if (!window.location.hash) {
        window.location.hash = toAdminHash(ADMIN_ROUTES.HOME);
      }
      renderRoute();
      refreshTopBar();
      pollWaitingSession();
      pollTimer = setInterval(pollWaitingSession, TIMEOUTS.PAYMENT_POLL_INTERVAL_MS);
      connectServerEvents();
    },
    unmount() {
      window.removeEventListener('hashchange', renderRoute);
      clearInterval(pollTimer);
      sse?.close();
      currentScreen?.unmount?.();
      currentScreen = null;
      container?.remove();
      container = null;
    }
  };
}

function renderLayout() {
  const navHtml = NAV_ITEMS.map((item) => {
    const isHome = item.route === ADMIN_ROUTES.HOME;
    const badgeHtml = isHome
      ? '<span id="nav-badge-home" class="hidden chip-raw chip-raw-error text-[10px]">BAYAR</span>'
      : '';
    return `
      <a href="#/${item.route}" data-route="${item.route}"
         class="flex items-center justify-between h-14 px-6 font-headline text-sm uppercase text-white hover:bg-white/10 transition-colors
                focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-white">
        <span>${item.label}</span>
        ${badgeHtml}
      </a>
    `;
  }).join('');

  return `
    <aside class="w-64 shrink-0 bg-black text-white flex flex-col min-h-screen sticky top-0 h-screen">
      <div class="p-6 border-b-[3px] border-white">
        <p class="font-headline text-xl uppercase leading-tight">TERAS<br/>PHOTOBOOTH</p>
        <p class="font-mono text-[11px] text-white/60 mt-1">PANEL OPERATOR</p>
      </div>
      <nav class="flex-1 py-4" aria-label="Menu admin">
        ${navHtml}
      </nav>
      <div class="p-4 border-t-[3px] border-white">
        <button id="btn-lock-panel" class="btn-raw-secondary w-full py-3 text-xs font-headline">KUNCI PANEL</button>
      </div>
    </aside>

    <div class="flex-1 min-w-0 flex flex-col">
      <header class="sticky top-0 z-40 bg-white border-b-[3px] border-black px-8 py-3 flex flex-wrap items-center gap-3">
        <span id="topbar-camera" class="chip-raw chip-raw-default text-xs">KAMERA: ...</span>
        <span id="topbar-printer" class="chip-raw chip-raw-default text-xs">PRINTER: ...</span>
        <span id="topbar-event" class="chip-raw chip-raw-default text-xs">EVENT: ...</span>
      </header>
      <main id="admin-content" class="flex-1 p-8 max-w-6xl w-full"></main>
    </div>
  `;
}
