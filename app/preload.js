const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),

  onFileSelected: (cb) => {
    ipcRenderer.on('file-selected', (_event, filePath) => cb(filePath));
  },

  geocode: (address) => ipcRenderer.invoke('geocode', address),

  setGeocodeWindowVisible: (visible) =>
    ipcRenderer.invoke('set-geocode-window-visible', Boolean(visible)),

  openExternal: (url) =>
    ipcRenderer.invoke('open-external', url),

  copyText: (text) =>
    ipcRenderer.invoke('copy-text', String(text)),

  resetGoogleSession: () =>
    ipcRenderer.invoke('reset-google-session'),

  minimizeWindow: () =>
    ipcRenderer.invoke('window-minimize'),

  maximizeWindow: () =>
    ipcRenderer.invoke('window-maximize'),

  closeWindow: () =>
    ipcRenderer.invoke('window-close')
});