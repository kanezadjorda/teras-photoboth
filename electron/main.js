import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { startServer } from '../server/index.js';
import { DEFAULTS } from '../src/shared/constants.js';

const require = createRequire(import.meta.url);
const { app, BrowserWindow, screen, ipcMain, session, dialog } = require('electron');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isDev = process.env.NODE_ENV !== 'production' && (app ? !app.isPackaged : true);
const VITE_DEV_SERVER = `http://localhost:${DEFAULTS.CLIENT_PORT}`;

let adminWindow = null;
let kioskWindow = null;

/**
 * Menerapkan konfigurasi keamanan ketat untuk BrowserWindow
 * Mengacu pada Praktik Terbaik Keamanan Electron Windows 11 & PRD
 */
function applySecurityHandlers(win) {
  if (!win) return;

  // 1. Validasi Navigasi: Cegah navigasi ke sembarang URL eksternal
  win.webContents.on('will-navigate', (event, navigationUrl) => {
    try {
      const parsedUrl = new URL(navigationUrl);
      if (isDev) {
        const allowedOrigin = new URL(VITE_DEV_SERVER).origin;
        if (parsedUrl.origin === allowedOrigin) return;
      } else {
        if (parsedUrl.protocol === 'file:') return;
      }
    } catch {
      // URL tidak valid, langsung blokir
    }
    event.preventDefault();
    console.warn(`[Security] Navigasi eksternal diblokir: ${navigationUrl}`);
  });

  // 2. Cegah pembukaan jendela/tab baru eksternal (window.open, target="_blank")
  win.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    console.warn(`[Security] Pembukaan jendela eksternal ditolak: ${targetUrl}`);
    return { action: 'deny' };
  });

  // 3. Nonaktifkan menu bar default pada kiosk dan mode fullscreen
  win.removeMenu();
}

async function createWindows() {
  const displays = screen.getAllDisplays();
  const primaryDisplay = screen.getPrimaryDisplay();
  const secondaryDisplay = displays.find((d) => d.id !== primaryDisplay.id) || primaryDisplay;

  // WebPreferences dengan isolasi ketat sesuai panduan keamanan
  const webPreferences = {
    preload: resolve(__dirname, 'preload.cjs'),
    contextIsolation: true,
    nodeIntegration: false,
    nodeIntegrationInWorker: false,
    nodeIntegrationInSubFrames: false,
    sandbox: true,
    webviewTag: false
  };

  // 1. Admin Window (Layar Laptop / Monitor Utama)
  adminWindow = new BrowserWindow({
    title: 'Photobooth Staff Admin',
    width: 1280,
    height: 800,
    x: primaryDisplay.bounds.x + 50,
    y: primaryDisplay.bounds.y + 50,
    webPreferences
  });
  applySecurityHandlers(adminWindow);

  // 2. Kiosk Window (Layar Kiosk / Monitor Kedua)
  kioskWindow = new BrowserWindow({
    title: 'Photobooth Kiosk',
    x: secondaryDisplay.bounds.x,
    y: secondaryDisplay.bounds.y,
    width: secondaryDisplay.bounds.width,
    height: secondaryDisplay.bounds.height,
    fullscreen: !isDev,
    autoHideMenuBar: true,
    webPreferences
  });
  applySecurityHandlers(kioskWindow);

  if (isDev) {
    const loadWithRetry = async (win, url, maxRetries = 15, delayMs = 500) => {
      for (let i = 0; i < maxRetries; i++) {
        try {
          await win.loadURL(url);
          return;
        } catch {
          if (i === maxRetries - 1) {
            console.error(`[Electron] Gagal memuat URL setelah beberapa percobaan: ${url}`);
          } else {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          }
        }
      }
    };

    loadWithRetry(adminWindow, `${VITE_DEV_SERVER}/src/admin/index.html`);
    loadWithRetry(kioskWindow, `${VITE_DEV_SERVER}/src/kiosk/index.html`);
  } else {
    adminWindow.loadFile(resolve(__dirname, '../dist/src/admin/index.html'));
    kioskWindow.loadFile(resolve(__dirname, '../dist/src/kiosk/index.html'));
  }
}

// IPC Handlers - Hanya ekspos fungsi yang tervalidasi minimal
ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('app:quit', () => app.quit());
ipcMain.handle('dialog:select-folder', async (event, defaultPath) => {
  const win = BrowserWindow.fromWebContents(event.sender) || adminWindow || null;
  const options = {
    title: 'Pilih Folder Output Google Drive',
    defaultPath: defaultPath || undefined,
    properties: ['openDirectory', 'createDirectory']
  };

  const result = win
    ? await dialog.showOpenDialog(win, options)
    : await dialog.showOpenDialog(options);

  if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});
ipcMain.handle('printer:print-silent', async (event, options = {}) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return { success: false, error: 'Window not found' };

  return new Promise((resolvePromise) => {
    win.webContents.print(
      {
        silent: true,
        printBackground: true,
        ...options
      },
      (success, failureReason) => {
        if (!success) {
          resolvePromise({ success: false, error: failureReason });
        } else {
          resolvePromise({ success: true });
        }
      }
    );
  });
});

app.whenReady().then(async () => {
  // Pastikan data persisten SQLite dan foto tersimpan di userData saat produksi (PRD 8.1)
  if (!isDev && app) {
    const userData = app.getPath('userData');
    if (!process.env.DATABASE_PATH) {
      process.env.DATABASE_PATH = resolve(userData, 'data/photobooth.db');
    }
    if (!process.env.OUTPUT_FOLDER) {
      process.env.OUTPUT_FOLDER = resolve(userData, 'data/photos');
    }
  }

  // Batasi izin hanya untuk media (kamera/webcam untuk fitur capture)
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowed = ['media'];
    callback(allowed.includes(permission));
  });

  await startServer();
  await createWindows();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindows();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
