
const { BrowserWindow, session, app } = require('electron');

class GeoLocation {
    constructor(options = {}) {
        this.partition = options.partition || 'persist:google-maps';
        this.headless = options.headless ?? false;
        this.timeout = options.timeout || 300000;

        this.session = null;
        this.window = null;
        this.ready = false;
        this.processing = false;

        // Exact Puppeteer viewport and click coordinates.
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

        // Make the actual page viewport exactly 1280 x 900.
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

            // Open Google Maps search page.
            await win.loadURL('https://www.google.com/maps/search/');

            // Wait for the original search input.
            await this.waitFor(async () =>
                win.webContents.executeJavaScript(
                    '!!document.querySelector(\'[role="combobox"]\')'
                )
            );

            // Reproduce the original Puppeteer search procedure.
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

            // Wait for autocomplete suggestions.
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Press Enter.
            win.webContents.sendInputEvent({
                type: 'keyDown',
                keyCode: 'ENTER'
            });

            win.webContents.sendInputEvent({
                type: 'keyUp',
                keyCode: 'ENTER'
            });

            console.log('Searching:', address);

            // Original Puppeteer rendering delay.
            await new Promise(resolve => setTimeout(resolve, 4000));

            await this.waitFor(async () =>
                win.webContents.executeJavaScript(
                    '!!document.querySelector("canvas")'
                )
            );

            // Reproduce the ORIGINAL exact right-click coordinates.
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

            // Wait for Google Maps coordinates to update.
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

module.exports = GeoLocation;
