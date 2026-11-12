
const { BrowserWindow, session, app } = require('electron');

class GeoLocation {
    constructor(options = {}) {
        this.partition = options.partition || 'persist:google-maps';
        this.headless = false;
        this.timeout = options.timeout || 300000;

        this.session = null;
        this.window = null;
        this.ready = false;
        this.processing = false;
    }

    async initialize() {
        await app.whenReady();

        if (!this.session) {
            this.session = session.fromPartition(this.partition);
        }

        return this;
    }

    async createWindow(show = true) {
        await this.initialize();

        if (this.window && !this.window.isDestroyed()) {
            this.window.show();
            this.window.focus();
            return this.window;
        }

        this.window = new BrowserWindow({
            width: 1100,
            height: 800,
            show: true,
            autoHideMenuBar: true,
            webPreferences: {
                session: this.session,
                contextIsolation: true,
                nodeIntegration: false,
                sandbox: true
            }
        });

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
            } catch (error) {
                // Continue waiting while the page loads.
            }

            await new Promise(resolve => setTimeout(resolve, 500));
        }

        throw new Error('Google Maps operation timed out.');
    }

    async ensureConsent() {
        const win = await this.createWindow(true);

        await win.loadURL('https://www.google.com/maps/');

        if (win.webContents.getURL().startsWith('https://consent.google.com/')) {
            win.show();
            win.focus();

            console.log('Google consent required. Waiting for user approval...');

            await this.waitFor(() =>
                !win.webContents.getURL().startsWith('https://consent.google.com/')
            );

            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        this.ready = true;
        return true;
    }

    async geocode(address) {
        if (this.processing) {
            throw new Error('Another geolocation request is already running.');
        }

        this.processing = true;

        try {
            const win = await this.createWindow(true);

            await this.ensureConsent();

            win.show();
            win.focus();

            const url = 'https://www.google.com/maps/search/' +
                encodeURIComponent(address);

            await win.loadURL(url);

            if (win.webContents.getURL().startsWith('https://consent.google.com/')) {
                win.show();
                win.focus();

                await this.waitFor(() =>
                    !win.webContents.getURL().startsWith('https://consent.google.com/')
                );

                await win.loadURL(url);
            }

            console.log('Searching:', address);

            await this.waitFor(async () =>
                await win.webContents.executeJavaScript(
                    '!!document.querySelector("canvas")'
                )
            );

            await new Promise(resolve => setTimeout(resolve, 4000));

            // Get the center of the map canvas.
            const point = await win.webContents.executeJavaScript(`
                (() => {
                    const canvas = document.querySelector('canvas');
                    if (!canvas) return null;

                    const rect = canvas.getBoundingClientRect();

                    return {
                        x: Math.round(rect.left + rect.width / 2),
                        y: Math.round(rect.top + rect.height / 2)
                    };
                })();
            `);

            if (!point) {
                throw new Error('Google Maps canvas not found.');
            }

            // Perform a real right-click through Electron.
            win.webContents.sendInputEvent({
                type: 'mouseDown',
                x: point.x,
                y: point.y,
                button: 'right',
                clickCount: 1
            });

            win.webContents.sendInputEvent({
                type: 'mouseUp',
                x: point.x,
                y: point.y,
                button: 'right',
                clickCount: 1
            });

            console.log('Right-click sent. Waiting for coordinates...');

            let result = null;

            await this.waitFor(async () => {
                result = await win.webContents.executeJavaScript(`
                    (() => {
                        const pattern =
                            /(-?\\\\d{1,2}\\\\.\\\\d{4,}),\\\\s*(-?\\\\d{1,3}\\\\.\\\\d{4,})/;

                        const visibleElements = Array.from(
                            document.querySelectorAll('body *')
                        ).filter(el => {
                            const rect = el.getBoundingClientRect();
                            const style = getComputedStyle(el);

                            return rect.width > 0 &&
                                rect.height > 0 &&
                                style.display !== 'none' &&
                                style.visibility !== 'hidden';
                        });

                        // Prefer the smallest visible element containing coordinates.
                        const candidates = visibleElements
                            .map(el => ({
                                text: (el.innerText || el.textContent || '').trim(),
                                area: el.getBoundingClientRect().width *
                                      el.getBoundingClientRect().height,
                                children: el.children.length
                            }))
                            .filter(item =>
                                item.text.length > 0 &&
                                item.text.length < 300 &&
                                pattern.test(item.text)
                            )
                            .sort((a, b) => a.area - b.area);

                        for (const candidate of candidates) {
                            const match = candidate.text.match(pattern);
                            if (!match) continue;

                            const lat = Number(match[1]);
                            const lng = Number(match[2]);

                            if (
                                Number.isFinite(lat) &&
                                Number.isFinite(lng) &&
                                lat >= -90 && lat <= 90 &&
                                lng >= -180 && lng <= 180
                            ) {
                                return { lat, lng };
                            }
                        }

                        return null;
                    })();
                `);

                return !!result;
            }, 15000);

            console.log(
                `Coordinates for ${address}: ${result.lat}, ${result.lng}`
            );

            return result;

        } finally {
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
