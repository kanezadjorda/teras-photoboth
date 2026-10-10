import { app, BrowserWindow, screen, ipcMain } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { startServer } from '../server/index.js';
import { DEFAULTS } from '../src/shared/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;
const VITE_DEV_SERVER = `http://localhost:${DEFAULTS.CLIENT_PORT}`;

let adminWindow = null;
let kioskWindow = null;

async function createWindows() {
  const displays = screen.getAllDisplays();
  const primaryDisplay = screen.getPrimaryDisplay();
  const secondaryDisplay = displays.find((d) => d.id !== primaryDisplay.id) || primaryDisplay;

  // Common WebPreferences with strict security
  const webPreferences = {
    preload: resolve(__dirname, 'preload.js'),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true
  };

  // 1. Admin Window (Laptop Screen / Primary Display)
  adminWindow = new BrowserWindow({
    title: 'Photobooth Staff Admin',
    width: 1280,
    height: 800,
    x: primaryDisplay.bounds.x + 50,
    y: primaryDisplay.bounds.y + 50,
    webPreferences
  });

  // 2. Kiosk Window (Second Monitor if available)
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

  if (isDev) {
    adminWindow.loadURL(`${VITE_DEV_SERVER}/src/admin/index.html`);
    kioskWindow.loadURL(`${VITE_DEV_SERVER}/src/kiosk/index.html`);
  } else {
    adminWindow.loadFile(resolve(__dirname, '../dist/src/admin/index.html'));
    kioskWindow.loadFile(resolve(__dirname, '../dist/src/kiosk/index.html'));
  }
}

// IPC Handlers
ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('app:quit', () => app.quit());
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
