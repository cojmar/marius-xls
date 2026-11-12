
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

const GeoLocation = require('./GeoLocation');

let geoLocation;

function createWindow() {
    const win = new BrowserWindow({
        width: 1100,
        height: 800,
        title: 'Locații Excel',
        icon: path.join(__dirname, 'images/icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
        }
    });

    win.webContents.openDevTools({ mode: 'detach' });
    win.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(async () => {
    geoLocation = new GeoLocation({
        headless: false
    });

    await geoLocation.initialize();

    ipcMain.handle('geocode', async (event, address) => {
        return await geoLocation.geocode(address);
    });

    ipcMain.handle('open-file-dialog', async () => {
        const result = await dialog.showOpenDialog({
            title: 'Selectează fișier .xlsx / .xls',
            filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }],
            properties: ['openFile']
        });

        return result.canceled ? null : result.filePaths[0];
    });

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', async () => {
    if (geoLocation) {
        await geoLocation.close();
    }
});
