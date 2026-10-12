import { createWelcomeScreen } from './screens/welcome.js';
import { createPaymentScreen } from './screens/payment.js';
import { createChooseTemplateScreen } from './screens/choose-template.js';
import { createCaptureScreen } from './screens/capture.js';
import { createReviewScreen } from './screens/review.js';
import { createPrintingScreen } from './screens/printing.js';
import { createDoneScreen } from './screens/done.js';
import { api } from '../shared/api.js';
import { SESSION_STATES, DEFAULTS } from '../shared/constants.js';

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
    onConfirm: async ({ photos: confirmedPhotos, compositeDataUrl }) => {
      console.log('[Kiosk] Foto dikonfirmasi pelanggan, menyimpan foto...');

      let sessionNo = '0001';
      try {
        if (session.id && !session.id.startsWith('demo_')) {
          // 1. Simpan foto ke disk & database sebelum cetak (PRD F-17, Non-Functional)
          const saveResult = await api.savePhotos(session.id, {
            composite: compositeDataUrl,
            rawPhotos: confirmedPhotos
          });
          sessionNo = saveResult?.data?.sessionNo || sessionNo;
          console.log(`[Kiosk] Foto tersimpan ke disk! Nomor sesi #${sessionNo}`);

          // 2. Transisi status sesi ke printing
          await api.updateSessionStatus(session.id, SESSION_STATES.PRINTING);
        }
      } catch (err) {
        console.error('[Kiosk] Gagal menyimpan foto sebelum print:', err);
      }

      // 3. Ambil jumlah salinan cetak dari pengaturan admin
      let copies = DEFAULTS.COPIES_PER_SESSION || 1;
      try {
        const settingsRes = await api.getSettings();
        if (settingsRes?.data?.copies_per_session) {
          copies = parseInt(settingsRes.data.copies_per_session, 10) || 1;
        }
      } catch (e) {
        console.warn('[Kiosk] Menggunakan default copies:', e.message);
      }

      // 4. Masuk ke Layar Printing
      initPrintingScreen(session, compositeDataUrl, copies, sessionNo);
    },
    onCancel: async () => {
      await cancelSession(session);
    }
  });

  renderScreen(reviewScreen);
}

// 5. Printing Screen
function initPrintingScreen(session, compositeUrl, copies, sessionNo) {
  const printingScreen = createPrintingScreen({
    compositeUrl,
    copies,
    onPrinted: async () => {
      console.log('[Kiosk] Perintah print terkirim! Masuk ke Layar Selesai.');
      try {
        if (session.id && !session.id.startsWith('demo_')) {
          await api.updateSessionStatus(session.id, SESSION_STATES.DONE);
        }
      } catch (err) {
        console.warn('[Kiosk] Gagal update status ke DONE:', err.message);
      }
      initDoneScreen(sessionNo);
    }
  });

  renderScreen(printingScreen);
}

// 6. Done Screen (Soft File & QR Drive instructions)
function initDoneScreen(sessionNo) {
  const doneScreen = createDoneScreen({
    sessionNo,
    onFinished: () => {
      console.log('[Kiosk] Sesi selesai sepenuhnya. Kembali ke Layar Awal.');
      initWelcomeScreen();
    }
  });

  renderScreen(doneScreen);
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
