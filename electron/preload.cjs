const { contextBridge, ipcRenderer } = require('electron');

// Expose minimal, secure API to renderer
contextBridge.exposeInMainWorld('photobooth', {
  getAppVersion: () => ipcRenderer.invoke('app:version'),
  printSilent: (options) => ipcRenderer.invoke('printer:print-silent', options),
  getPrinters: () => ipcRenderer.invoke('printer:get-printers'),
  selectFolder: (defaultPath) => ipcRenderer.invoke('dialog:select-folder', defaultPath),
  openPrinterSettings: (printerName) => ipcRenderer.invoke('printer:open-settings', printerName),
  quitApp: () => ipcRenderer.invoke('app:quit'),
  notifyCameraChanged: (data) => ipcRenderer.invoke('camera:change', data),
  onCameraChanged: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('camera:changed', handler);
    return () => ipcRenderer.removeListener('camera:changed', handler);
  }
});

