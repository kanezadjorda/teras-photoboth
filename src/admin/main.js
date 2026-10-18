import { createPinModal } from './screens/pin-modal.js';
import { createAdminShell } from './shell.js';

const AUTH_STORAGE_KEY = 'admin_auth';
const appRoot = document.getElementById('app');
let currentView = null;

function renderView(view) {
  currentView?.unmount?.();
  currentView = view;
  appRoot.innerHTML = '';
  view.mount(appRoot);
}

function lockPanel() {
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
  start();
}

function start() {
  const isAuthenticated = sessionStorage.getItem(AUTH_STORAGE_KEY) === 'true';
  if (!isAuthenticated) {
    renderView(createPinModal({ onAuthenticated: start }));
    return;
  }
  renderView(createAdminShell({ onLock: lockPanel }));
}

start();
