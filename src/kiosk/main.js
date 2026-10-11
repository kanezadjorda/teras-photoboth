import { createWelcomeScreen } from './screens/welcome.js';
import { api } from '../shared/api.js';

const appRoot = document.getElementById('app');
let currentScreen = null;

function renderScreen(screen) {
  if (currentScreen) {
    currentScreen.unmount();
  }
  currentScreen = screen;
  currentScreen.mount(appRoot);
}

function initWelcomeScreen() {
  const welcome = createWelcomeScreen({
    onStart: async () => {
      try {
        console.log('Memulai sesi baru...');
        const res = await api.createSession();
        console.log('Sesi dibuat:', res.data);
        // Will transition to payment screen in next phase
      } catch (err) {
        console.error('Gagal membuat sesi:', err);
      }
    }
  });
  renderScreen(welcome);
}

// Initial mount
initWelcomeScreen();

