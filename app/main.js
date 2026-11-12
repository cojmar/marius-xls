const {
    app,
    BrowserWindow,
    ipcMain,
    dialog,
    shell,
    clipboard
} = require('electron');

const path = require('path');

const { session } = require('electron');

class GeoLocation {
    constructor(options = {}) {
        this.partition = options.partition || 'persist:google-maps';
        this.headless = options.headless ?? false;
        this.timeout = options.timeout || 300000;

        this.session = null;
        this.window = null;
        this.ready = false;
        this.processing = false;

        this.viewport = { width: 1280, height: 900 };
        this.clickPoint = { x: 876, y: 429 };
    }

    async initialize() {
        await app.whenReady();

        if (!this.session) {
            this.session = session.fromPartition(this.partition);
        }

        return this;
    }

    async createWindow() {
        await this.initialize();

        if (this.window && !this.window.isDestroyed()) {
            if (!this.headless) {
                this.window.show();
                this.window.focus();
            }
            return this.window;
        }

        this.window = new BrowserWindow({
            width: this.viewport.width,
            height: this.viewport.height,
            show: !this.headless,
            autoHideMenuBar: true,
            webPreferences: {
                session: this.session,
                contextIsolation: true,
                nodeIntegration: false,
                sandbox: true
            }
        });

        this.window.setContentSize(
            this.viewport.width,
            this.viewport.height
        );

        this.window.on('closed', () => {
            this.window = null;
            this.ready = false;
        });

        return this.window;
    }

    async waitFor(condition, timeout = this.timeout) {
        const start = Date.now();

        while (Date.now() - start < timeout) {
            if (!this.window || this.window.isDestroyed()) {
                throw new Error('Google Maps window was closed.');
            }

            try {
                if (await condition()) return true;
            } catch {}

            await new Promise(resolve => setTimeout(resolve, 500));
        }

        throw new Error('Google Maps operation timed out.');
    }

    async ensureConsent() {
        const win = await this.createWindow();

        await win.loadURL('https://www.google.com/maps/');

        if (win.webContents.getURL().startsWith('https://consent.google.com/')) {
            win.show();
            win.focus();

            console.log('Google consent required. Waiting for user approval...');

            await this.waitFor(() =>
                !win.webContents.getURL().startsWith('https://consent.google.com/')
            );

            await new Promise(resolve => setTimeout(resolve, 2000));

            if (this.headless) {
                win.hide();
            }
        }

        this.ready = true;
    }

    async geocode(address) {
        if (this.processing) {
            throw new Error('Another geolocation request is already running.');
        }

        this.processing = true;

        try {
            const win = await this.createWindow();

            await this.ensureConsent();

            if (!this.headless) {
                win.show();
                win.focus();
            }

            await win.loadURL('https://www.google.com/maps/search/');

            await this.waitFor(async () =>
                win.webContents.executeJavaScript(
                    '!!document.querySelector(\'[role="combobox"]\')'
                )
            );

            await win.webContents.executeJavaScript(`
                (() => {
                    const input = document.querySelector('[role="combobox"]');

                    if (!input) return false;

                    input.focus();
                    input.value = ${JSON.stringify(address)};

                    input.dispatchEvent(new Event('input', {
                        bubbles: true
                    }));

                    input.dispatchEvent(new Event('change', {
                        bubbles: true
                    }));

                    return true;
                })();
            `);

            await new Promise(resolve => setTimeout(resolve, 1500));

            win.webContents.sendInputEvent({
                type: 'keyDown',
                keyCode: 'ENTER'
            });

            win.webContents.sendInputEvent({
                type: 'keyUp',
                keyCode: 'ENTER'
            });

            console.log('Searching:', address);

            await new Promise(resolve => setTimeout(resolve, 4000));

            await this.waitFor(async () =>
                win.webContents.executeJavaScript(
                    '!!document.querySelector("canvas")'
                )
            );

            await win.webContents.executeJavaScript(`
                (() => {
                    const canvas = document.querySelector('canvas');
                    if (!canvas) return false;

                    const cx = 876;
                    const cy = 429;

                    canvas.dispatchEvent(new MouseEvent('mousedown', {
                        bubbles: true,
                        clientX: cx,
                        clientY: cy,
                        button: 2,
                        buttons: 2
                    }));

                    canvas.dispatchEvent(new MouseEvent('contextmenu', {
                        bubbles: true,
                        cancelable: true,
                        clientX: cx,
                        clientY: cy,
                        button: 2,
                        buttons: 2
                    }));

                    canvas.dispatchEvent(new MouseEvent('mouseup', {
                        bubbles: true,
                        clientX: cx,
                        clientY: cy,
                        button: 2,
                        buttons: 0
                    }));

                    return true;
                })();
            `);

            console.log('Right-click at X=876, Y=429');

            await new Promise(resolve => setTimeout(resolve, 1500));

            const result = await win.webContents.executeJavaScript(`
                (() => {
                    const el = document.querySelector('.mLuXec');

                    if (!el) return null;

                    const text = el.textContent.trim();

                    const match = text.match(
                        /(-?\\d+\\.\\d+),\\s*(-?\\d+\\.\\d+)/
                    );

                    if (!match) return null;

                    return {
                        lat: parseFloat(match[1]),
                        lng: parseFloat(match[2])
                    };
                })();
            `);

            if (!result) {
                throw new Error(
                    'Could not extract coordinates for: ' + address
                );
            }

            console.log(
                `Coordinates for "${address}": ${result.lat}, ${result.lng}`
            );

            return result;

        } finally {
            if (this.headless && this.window && !this.window.isDestroyed()) {
                this.window.hide();
            }

            this.processing = false;
        }
    }

    async close() {
        if (this.window && !this.window.isDestroyed()) {
            this.window.close();
        }

        this.window = null;
        this.ready = false;
    }
}


let geoLocation;

function createWindow() {
    const win = new BrowserWindow({
        width: 1440,
        height: 900,
        minWidth: 850,
        minHeight: 600,
        frame: false,
        title: 'Locații din Excel',
        icon: path.join(__dirname, 'images/icon.png'),
        backgroundColor: '#101218',
        autoHideMenuBar: true,
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
        if (
            typeof url !== 'string' ||
            !url.startsWith('https://www.google.com/maps/')
        ) {
            throw new Error('Invalid external URL');
        }

        await shell.openExternal(url);
        return true;
    });

    ipcMain.handle('copy-text', (_event, value) => {
        clipboard.writeText(String(value));
        return true;
    });

    ipcMain.handle('reset-google-session', async () => {
        if (geoLocation.processing) {
            throw new Error('Wait for the current geocoding operation to finish.');
        }

        await geoLocation.close();

        await geoLocation.session.clearStorageData({
            storages: [
                'cookies',
                'localstorage',
                'indexdb',
                'serviceworkers',
                'cachestorage'
            ]
        });

        return true;
    });

    ipcMain.handle('window-minimize', (event) => {
        BrowserWindow.fromWebContents(event.sender)?.minimize();
    });

    ipcMain.handle('window-maximize', (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (!win) return;

        if (win.isMaximized()) {
            win.unmaximize();
        } else {
            win.maximize();
        }
    });

    ipcMain.handle('window-close', (event) => {
        app.quit();
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