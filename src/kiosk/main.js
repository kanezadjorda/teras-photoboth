import { createWelcomeScreen } from './screens/welcome.js';
import { createCaptureScreen } from './screens/capture.js';
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
        console.log('[Kiosk] Memulai sesi baru...');
        const res = await api.createSession();
        const session = res.data;
        console.log('[Kiosk] Sesi dibuat:', session);

        // In Phase 1: Navigate directly to Capture screen (Payment & Template choose in later phases)
        initCaptureScreen(session);
      } catch (err) {
        console.error('[Kiosk] Gagal membuat sesi:', err);
        // Fallback for offline/standalone test
        initCaptureScreen({ id: 'demo_session' });
      }
    }
  });
  renderScreen(welcome);
}

function initCaptureScreen(session) {
  // Default 3-slot template for Phase 1 testing
  const dummyTemplate = {
    id: 'strip-3',
    nama: 'Strip 3 Foto',
    slots: [
      { x: 50, y: 60, w: 500, h: 380 },
      { x: 50, y: 470, w: 500, h: 380 },
      { x: 50, y: 880, w: 500, h: 380 }
    ]
  };

  const captureScreen = createCaptureScreen({
    template: dummyTemplate,
    onCaptureComplete: (photos) => {
      console.log(`[Kiosk] Selesai mengambil ${photos.length} foto!`, photos);
      alert(`Selesai mengambil ${photos.length} foto! Foto tersimpan di memori. Kembali ke layar awal.`);
      initWelcomeScreen();
    },
    onCancel: () => {
      console.log('[Kiosk] Sesi dibatalkan oleh pengguna.');
      initWelcomeScreen();
    }
  });

  renderScreen(captureScreen);
}

// Initial mount
initWelcomeScreen();
