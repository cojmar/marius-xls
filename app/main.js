
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');

const GeoLocation = require('./GeoLocation');

let geoLocation;

function createWindow() {
    const win = new BrowserWindow({
        width: 1440,
        height: 900,
        minWidth: 700,
        minHeight: 500,
        title: 'Locații din Excel',
        icon: path.join(__dirname, 'images/icon.png'),
        backgroundColor: '#101218',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
        }
    });

    win.loadFile(path.join(__dirname, 'index.html'));

    return win;
}

app.whenReady().then(async () => {
    geoLocation = new GeoLocation({
        headless: true
    });

    await geoLocation.initialize();

    ipcMain.handle('geocode', async (_event, address) => {
        return await geoLocation.geocode(address);
    });

    ipcMain.handle('set-geocode-window-visible', async (_event, visible) => {
        geoLocation.headless = !visible;

        if (geoLocation.window && !geoLocation.window.isDestroyed()) {
            if (visible) {
                geoLocation.window.show();
                geoLocation.window.focus();
            } else {
                geoLocation.window.hide();
            }
        }

        return true;
    });

    ipcMain.handle('open-external', async (_event, url) => {
        if (typeof url !== 'string' ||
            !url.startsWith('https://www.google.com/maps/')) {
            throw new Error('Invalid external URL');
        }

        await shell.openExternal(url);
        return true;
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
