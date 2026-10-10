import { contextBridge, ipcRenderer } from 'electron';

// Expose minimal, secure API to renderer
contextBridge.exposeInMainWorld('photobooth', {
  getAppVersion: () => ipcRenderer.invoke('app:version'),
  printSilent: (options) => ipcRenderer.invoke('printer:print-silent', options),
  quitApp: () => ipcRenderer.invoke('app:quit')
});
