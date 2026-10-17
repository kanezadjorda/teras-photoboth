const { contextBridge, ipcRenderer } = require('electron/renderer');

// Expose minimal, secure API to renderer
contextBridge.exposeInMainWorld('photobooth', {
  getAppVersion: () => ipcRenderer.invoke('app:version'),
  printSilent: (options) => ipcRenderer.invoke('printer:print-silent', options),
  selectFolder: (defaultPath) => ipcRenderer.invoke('dialog:select-folder', defaultPath),
  quitApp: () => ipcRenderer.invoke('app:quit')
});
