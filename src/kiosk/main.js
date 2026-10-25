import { createWelcomeScreen } from './screens/welcome.js';
import { createInstructionsScreen } from './screens/instructions.js';
import { createPaymentScreen } from './screens/payment.js';
import { createChooseTemplateScreen } from './screens/choose-template.js';
import { createCaptureScreen } from './screens/capture.js';
import { createReviewScreen } from './screens/review.js';
import { createPrintingScreen } from './screens/printing.js';
import { createDoneScreen } from './screens/done.js';
import { createRecoveryModal } from './screens/recovery-modal.js';
import { setupOfflineMonitor } from '../shared/ui.js';
import { api } from '../shared/api.js';
import { SESSION_STATES, DEFAULTS, TIMEOUTS } from '../shared/constants.js';

const appRoot = document.getElementById('app');
let currentScreen = null;

function isRealSession(session) {
  return Boolean(session?.id && !session.id.includes('demo'));
}

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
    onStart: () => {
      // Transition to Layar Tata Cara (PRD F-26)
      initInstructionsScreen();
    }
  });
  renderScreen(welcome);
}

// 1.1 Instructions Screen (Tata Cara 4 Langkah & 60s Idle Timeout - PRD F-26, F-29)
function initInstructionsScreen() {
  const instructionsScreen = createInstructionsScreen({
    onBack: () => {
      console.log('[Kiosk] Kembali ke Layar Welcome.');
      initWelcomeScreen();
    },
    onNext: async () => {
      try {
        console.log('[Kiosk] Memulai sesi baru setelah tata cara...');
        const res = await api.createSession();
        const session = res.data;
        console.log('[Kiosk] Sesi dibuat:', session);
        initPaymentScreen(session);
      } catch (err) {
        console.error('[Kiosk] Gagal membuat sesi:', err);
        // Fallback for offline/standalone test
        initPaymentScreen({ id: `sess_demo_${Date.now()}` });
      }
    },
    onTimeout: () => {
      console.log('[Kiosk] Layar tata cara timeout tanpa aktivitas, kembali ke Welcome.');
      initWelcomeScreen();
    }
  });
  renderScreen(instructionsScreen);
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
        if (isRealSession(session)) {
          await api.updateSessionStatus(session.id, SESSION_STATES.CAPTURING, template.id);
        }
        await initCaptureScreen(session, template);
      } catch (err) {
        console.error('[Kiosk] Gagal memperbarui status sesi:', err);
        await initCaptureScreen(session, template);
      }
    },
    onTimeout: async () => {
      console.warn(`[Kiosk] Pemilihan template sesi ${session.id} timeout 60 detik tanpa aktivitas.`);
      await cancelSession(session);
    }
  });

  renderScreen(chooseScreen);
}

// 3. Capture Screen (All Slots Sequence)
async function initCaptureScreen(session, template) {
  let countdownSeconds = TIMEOUTS.COUNTDOWN_SECONDS || 3;
  try {
    const settingsRes = await api.getSettings();
    if (settingsRes?.data?.countdown_seconds) {
      countdownSeconds = parseInt(settingsRes.data.countdown_seconds, 10) || 3;
    }
  } catch (e) {
    console.warn('[Kiosk] Menggunakan default countdown:', e.message);
  }

  const captureScreen = createCaptureScreen({
    template,
    countdownSeconds,
    onCaptureComplete: async (photos) => {
      console.log(`[Kiosk] Selesai mengambil ${photos.length} foto! Masuk ke review.`);
      try {
        if (isRealSession(session)) {
          await api.updateSessionStatus(session.id, SESSION_STATES.REVIEWING);
        }
      } catch (err) {
        console.warn('[Kiosk] Status update warning:', err.message);
      }
      initReviewScreen(session, template, photos, {}, countdownSeconds);
    }
  });

  renderScreen(captureScreen);
}

// 4. Review & Retake Screen
function initReviewScreen(session, template, photos, retakeCounts = {}, countdownSeconds = 3) {
  const reviewScreen = createReviewScreen({
    template,
    photos,
    retakeCounts,
    onRetakeSlot: (slotIndex) => {
      console.log(`[Kiosk] Mengulang foto slot #${slotIndex + 1}...`);
      // Open capture screen specifically for retaking slotIndex
      const retakeScreen = createCaptureScreen({
        template,
        countdownSeconds,
        retakeSlotIndex: slotIndex,
        existingPhotos: photos,
        onCaptureComplete: (newPhoto) => {
          // Update photo array and increment retake counter
          photos[slotIndex] = newPhoto;
          retakeCounts[slotIndex] = (retakeCounts[slotIndex] || 0) + 1;
          console.log(`[Kiosk] Foto slot #${slotIndex + 1} berhasil diperbarui.`);
          // Return to review screen with updated photo and retake counts
          initReviewScreen(session, template, photos, retakeCounts, countdownSeconds);
        }
      });
      renderScreen(retakeScreen);
    },
    onTimeout: async () => {
      console.warn(`[Kiosk] Review foto sesi ${session.id} timeout 60 detik tanpa aktivitas.`);
      await cancelSession(session);
    },
    onConfirm: async ({ photos: confirmedPhotos, compositeDataUrl }) => {
      console.log('[Kiosk] Foto dikonfirmasi pelanggan, menyimpan foto...');

      let sessionNo = '0001';
      try {
        if (isRealSession(session)) {
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
        if (isRealSession(session)) {
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
    if (isRealSession(session)) {
      await api.updateSessionStatus(session.id, SESSION_STATES.CANCELLED);
    }
  } catch (err) {
    console.warn('[Kiosk] Gagal membatalkan sesi di server:', err.message);
  } finally {
    initWelcomeScreen();
  }
}

// Monitor koneksi internet untuk peringatan offline
setupOfflineMonitor(document.body);

async function resumeSession(session) {
  console.log(`[Kiosk] Melanjutkan sesi ${session.id} pada status: ${session.status}`);

  switch (session.status) {
    case SESSION_STATES.VIEWING_INSTRUCTIONS:
      initInstructionsScreen();
      break;

    case SESSION_STATES.WAITING_PAYMENT:
      initPaymentScreen(session);
      break;

    case SESSION_STATES.CHOOSING_TEMPLATE:
      initChooseTemplateScreen(session);
      break;

    case SESSION_STATES.CAPTURING:
      if (session.template_id) {
        try {
          const tplRes = await api.getTemplate(session.template_id);
          if (tplRes.data) {
            initCaptureScreen(session, tplRes.data);
            return;
          }
        } catch (e) {
          console.warn('[Kiosk] Gagal memuat template sesi:', e);
        }
      }
      initChooseTemplateScreen(session);
      break;

    case SESSION_STATES.REVIEWING:
      if (session.template_id) {
        try {
          const tplRes = await api.getTemplate(session.template_id);
          if (tplRes.data) {
            initCaptureScreen(session, tplRes.data);
            return;
          }
        } catch (e) {}
      }
      initChooseTemplateScreen(session);
      break;

    case SESSION_STATES.PRINTING:
      try {
        const photosRes = await api.getSessionPhotos(session.id);
        const composite = (photosRes.data || []).find((p) => p.urutan === 0);
        if (composite) {
          const settings = await api.getSettings().catch(() => ({ data: {} }));
          initPrintingScreen({
            session,
            compositeUrl: `/photos/${composite.path_file}`,
            copies: settings.data?.copies_per_session || 1,
            sessionNo: String(session.rowid || 1).padStart(4, '0')
          });
          return;
        }
      } catch (e) {
        console.warn('[Kiosk] Gagal resume printing:', e);
      }
      initWelcomeScreen();
      break;

    default:
      initWelcomeScreen();
      break;
  }
}

async function checkSessionRecovery() {
  try {
    const res = await api.getCurrentSession();
    const session = res.data;

    if (session && session.id && session.status) {
      console.log('[Kiosk] Ditemukan sesi aktif saat startup:', session);

      // Jika statusnya waiting_payment, cek apakah sudah bayar
      if (session.status === SESSION_STATES.WAITING_PAYMENT) {
        try {
          const payRes = await api.getPayment(session.id);
          if (payRes.data && payRes.data.status === 'paid') {
            console.log('[Kiosk] Sesi sudah terbayar, melanjutkan ke pilih template');
            initChooseTemplateScreen(session);
            return;
          }
        } catch (e) {}
      }

      // Tampilkan modal pemulihan sesi
      const recoveryModal = createRecoveryModal({
        session,
        onResume: (activeSession) => {
          resumeSession(activeSession);
        },
        onDiscard: async (activeSession) => {
          await cancelSession(activeSession);
        }
      });
      renderScreen(recoveryModal);
      return;
    }
  } catch (err) {
    console.warn('[Kiosk] Tidak dapat mengecek pemulihan sesi:', err.message);
  }

  // Standar: buka Welcome Screen
  initWelcomeScreen();
}

// Initial mount with session recovery check
checkSessionRecovery();
