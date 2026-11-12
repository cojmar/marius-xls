const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    args: ['--disable-gpu'],
    width: 1100,
    height: 800,
    title: 'Locații Excel',
    icon: path.join(__dirname, 'images/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Selectează fișier .xlsx / .xls',
    filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }],
    properties: ['openFile'],
  });

  if (result.canceled) return null;
  return result.filePaths[0];
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
