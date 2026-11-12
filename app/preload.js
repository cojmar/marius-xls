
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),

    onFileSelected: (cb) =>
        ipcRenderer.on('file-selected', (_e, path) => cb(path)),

    geocode: (address) =>
        ipcRenderer.invoke('geocode', address)
});
