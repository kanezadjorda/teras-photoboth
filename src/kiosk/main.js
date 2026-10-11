import { createWelcomeScreen } from './screens/welcome.js';
import { createPaymentScreen } from './screens/payment.js';
import { createChooseTemplateScreen } from './screens/choose-template.js';
import { createCaptureScreen } from './screens/capture.js';
import { createReviewScreen } from './screens/review.js';
import { api } from '../shared/api.js';
import { SESSION_STATES } from '../shared/constants.js';

const appRoot = document.getElementById('app');
let currentScreen = null;

function renderScreen(screen) {
  if (currentScreen && currentScreen.unmount) {
    currentScreen.unmount();
  }
  currentScreen = screen;
  appRoot.innerHTML = '';
  currentScreen.mount(appRoot);
}

// 1. Welcome Screen
function initWelcomeScreen() {
  const welcome = createWelcomeScreen({
    onStart: async () => {
      try {
        console.log('[Kiosk] Memulai sesi baru...');
        const res = await api.createSession();
        const session = res.data;
        console.log('[Kiosk] Sesi dibuat:', session);

        // Transition to QRIS Payment (Phase 4)
        initPaymentScreen(session);
      } catch (err) {
        console.error('[Kiosk] Gagal membuat sesi:', err);
        // Fallback for offline/standalone test
        initPaymentScreen({ id: `sess_demo_${Date.now()}` });
      }
    }
  });
  renderScreen(welcome);
}

// 2. Payment Screen (QRIS Dinamis Midtrans)
function initPaymentScreen(session) {
  const paymentScreen = createPaymentScreen({
    sessionId: session.id,
    onPaid: () => {
      console.log(`[Kiosk] Pembayaran sesi ${session.id} berhasil! Melanjutkan ke pemilihan template.`);
      initChooseTemplateScreen(session);
    },
    onExpired: async () => {
      console.warn(`[Kiosk] Pembayaran sesi ${session.id} kedaluwarsa.`);
      await cancelSession(session);
    },
    onCancel: async () => {
      console.log(`[Kiosk] Pembayaran sesi ${session.id} dibatalkan.`);
      await cancelSession(session);
    }
  });

  renderScreen(paymentScreen);
}

// 2. Choose Template Screen
function initChooseTemplateScreen(session) {
  const chooseScreen = createChooseTemplateScreen({
    onSelectTemplate: async (template) => {
      try {
        console.log(`[Kiosk] Template dipilih: ${template.nama} (${template.jumlah_slot} slot)`);
        if (session.id && !session.id.startsWith('demo_')) {
          await api.updateSessionStatus(session.id, SESSION_STATES.CAPTURING, template.id);
        }
        initCaptureScreen(session, template);
      } catch (err) {
        console.error('[Kiosk] Gagal memperbarui status sesi:', err);
        initCaptureScreen(session, template);
      }
    },
    onCancel: async () => {
      await cancelSession(session);
    }
  });

  renderScreen(chooseScreen);
}

// 3. Capture Screen (All Slots Sequence)
function initCaptureScreen(session, template) {
  const captureScreen = createCaptureScreen({
    template,
    onCaptureComplete: async (photos) => {
      console.log(`[Kiosk] Selesai mengambil ${photos.length} foto! Masuk ke review.`);
      try {
        if (session.id && !session.id.startsWith('demo_')) {
          await api.updateSessionStatus(session.id, SESSION_STATES.REVIEWING);
        }
      } catch (err) {
        console.warn('[Kiosk] Status update warning:', err.message);
      }
      initReviewScreen(session, template, photos, {});
    },
    onCancel: async () => {
      await cancelSession(session);
    }
  });

  renderScreen(captureScreen);
}

// 4. Review & Retake Screen
function initReviewScreen(session, template, photos, retakeCounts = {}) {
  const reviewScreen = createReviewScreen({
    template,
    photos,
    retakeCounts,
    onRetakeSlot: (slotIndex) => {
      console.log(`[Kiosk] Mengulang foto slot #${slotIndex + 1}...`);
      // Open capture screen specifically for retaking slotIndex
      const retakeScreen = createCaptureScreen({
        template,
        retakeSlotIndex: slotIndex,
        existingPhotos: photos,
        onCaptureComplete: (newPhoto) => {
          // Update photo array and increment retake counter
          photos[slotIndex] = newPhoto;
          retakeCounts[slotIndex] = (retakeCounts[slotIndex] || 0) + 1;
          console.log(`[Kiosk] Foto slot #${slotIndex + 1} berhasil diperbarui.`);
          // Return to review screen with updated photo and retake counts
          initReviewScreen(session, template, photos, retakeCounts);
        },
        onCancel: () => {
          // If cancelled during retake, simply return to review screen
          initReviewScreen(session, template, photos, retakeCounts);
        }
      });
      renderScreen(retakeScreen);
    },
    onConfirm: async (confirmedPhotos) => {
      console.log('[Kiosk] Foto dikonfirmasi pelanggan:', confirmedPhotos);
      alert('Foto berhasil dikonfirmasi! Siap masuk ke tahap pencetakan.');
      initWelcomeScreen();
    },
    onCancel: async () => {
      await cancelSession(session);
    }
  });

  renderScreen(reviewScreen);
}

// Helper to cancel session and return to welcome screen
async function cancelSession(session) {
  try {
    if (session?.id && !session.id.startsWith('demo_')) {
      await api.updateSessionStatus(session.id, SESSION_STATES.CANCELLED);
    }
  } catch (err) {
    console.warn('[Kiosk] Gagal membatalkan sesi di server:', err.message);
  } finally {
    initWelcomeScreen();
  }
}

// Initial mount
initWelcomeScreen();
