const puppeteer = require('puppeteer');
const { EventEmitter } = require('events');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const os = require('os');
const { app } = require('electron');

class DiscordBrowser extends EventEmitter {
    constructor(options = {}) {
        super();
        this.options = {
            proxy: options.proxy || null,
            token: options.token || null,
            userAgent: options.userAgent || this.generateUserAgent(),
            incognito: options.incognito !== false,
            headless: false, // Always show browser for Discord
            windowSize: { width: 1280, height: 720 },
            ...options
        };

        this.browser = null;
        this.page = null;
        this.isRunning = false;
        this.sessionId = crypto.randomBytes(16).toString('hex');
    }

    generateUserAgent() {
        const userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0'
        ];
        return userAgents[Math.floor(Math.random() * userAgents.length)];
    }

    async launch() {
        try {
            // Create a fresh user data directory for this session
            const tempDir = path.join(os.tmpdir(), 'discord-launcher-sessions');
            this.userDataDir = path.join(tempDir, `session-${this.sessionId}`);

            // Create the directories
            await fs.mkdir(tempDir, { recursive: true });
            await fs.mkdir(this.userDataDir, { recursive: true });

            // Create plugins folder in the application's directory (where the exe is located)
            // In development, this will be in the project folder
            // In production, this will be next to the executable
            const appPath = app.isPackaged
                ? path.dirname(process.execPath)  // Production: next to exe
                : process.cwd();  // Development: current working directory

            const pluginsDir = path.join(appPath, 'plugins');
            await fs.mkdir(pluginsDir, { recursive: true });

            console.log('Plugins directory:', pluginsDir);

            // Get list of extensions in plugins folder
            const extensions = [];
            try {
                const pluginFiles = await fs.readdir(pluginsDir);
                for (const file of pluginFiles) {
                    const pluginPath = path.join(pluginsDir, file);
                    const stat = await fs.stat(pluginPath);
                    if (stat.isDirectory()) {
                        extensions.push(pluginPath);
                    }
                }
            } catch (error) {
                console.log('No plugins found or error reading plugins folder');
            }

            // Prepare browser arguments
            this.browserArgs = [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process',
                '--disable-blink-features=AutomationControlled',
                `--window-size=${this.options.windowSize.width},${this.options.windowSize.height}`,
                `--user-data-dir=${this.userDataDir}`
            ];

            // Add extensions if any
            if (extensions.length > 0) {
                this.browserArgs.push(`--load-extension=${extensions.join(',')}`);
                this.browserArgs.push('--disable-extensions-except=' + extensions.join(','));
                console.log(`Loading ${extensions.length} extension(s)`);
            }

            // Store whether we're using proxy for later reference
            this.usingProxy = false;

            // Add proxy if configured - but don't let it break everything
            if (this.options.proxy && this.options.proxy.host) {
                let proxyUrl;

                // Format proxy URL based on protocol
                if (this.options.proxy.protocol === 'socks5' || this.options.proxy.protocol === 'socks4') {
                    proxyUrl = `${this.options.proxy.protocol}://${this.options.proxy.host}:${this.options.proxy.port}`;
                } else {
                    // For HTTP/HTTPS, Chrome expects http:// format
                    proxyUrl = `http://${this.options.proxy.host}:${this.options.proxy.port}`;
                }

                // Add proxy to Chrome this.browserArgs
                this.browserArgs.push(`--proxy-server=${proxyUrl}`);
                this.browserArgs.push('--proxy-bypass-list=<-loopback>');
                this.usingProxy = true;
                console.log(`Configured proxy: ${proxyUrl}`);
                console.log('Note: If proxy fails, Discord will load without proxy protection');
            }

            // Disable WebRTC to prevent IP leaks
            this.browserArgs.push('--disable-webrtc-hw-encoding');
            this.browserArgs.push('--disable-webrtc-hw-decoding');
            this.browserArgs.push('--force-webrtc-ip-handling-policy=disable_non_proxied_udp');

            // Launch browser with anti-detection measures
            // Try to find Chrome executable
            try {
                this.execPath = puppeteer.executablePath();
            } catch (e) {
                // Fallback to system Chrome if Puppeteer's bundled Chrome fails
                const possiblePaths = [
                    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
                    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe'
                ];
                this.execPath = possiblePaths.find(p => require('fs').existsSync(p));
            }

            this.browser = await puppeteer.launch({
                headless: false,
                args: this.browserArgs,
                defaultViewport: null,
                ignoreDefaultArgs: ['--enable-automation'],
                executablePath: this.execPath
            });

            // Close the default blank page that Puppeteer opens
            const pages = await this.browser.pages();
            if (pages.length > 0) {
                await pages[0].close();
            }

            // Create new page in regular context
            this.page = await this.browser.newPage();

            // Set user agent
            await this.page.setUserAgent(this.options.userAgent);

            // Add stealth measures to avoid detection
            await this.addStealthMeasures();

            // Set proxy authentication if needed
            if (this.options.proxy && this.options.proxy.username && this.options.proxy.password) {
                await this.page.authenticate({
                    username: this.options.proxy.username,
                    password: this.options.proxy.password
                });
            }

            // If we have a token, set it before navigation
            if (this.options.token) {
                console.log('Pre-setting token before navigation...');

                // Navigate to a simple page first to establish localStorage
                let navigationSucceeded = false;
                let retryCount = 0;

                while (!navigationSucceeded && retryCount < 2) {
                    try {
                        await this.page.goto('https://discord.com', {
                            waitUntil: 'networkidle2',
                            timeout: 30000
                        });
                        // Wait a bit for page to be ready
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        navigationSucceeded = true;
                    } catch (error) {
                        if (this.usingProxy && (
                            error.message.includes('ERR_SOCKS_CONNECTION_FAILED') ||
                            error.message.includes('ERR_PROXY_CONNECTION_FAILED') ||
                            error.message.includes('ERR_TUNNEL_CONNECTION_FAILED')
                        )) {
                            console.warn(`Proxy connection failed: ${error.message}`);

                            if (retryCount === 0) {
                                console.log('Restarting browser without proxy...');

                                // Close current browser
                                await this.browser.close();

                                // Restart without proxy
                                const browserArgsWithoutProxy = this.browserArgs.filter(arg =>
                                    !arg.includes('--proxy-server=') &&
                                    !arg.includes('--proxy-bypass-list=')
                                );

                                this.browser = await puppeteer.launch({
                                    headless: false,
                                    args: browserArgsWithoutProxy,
                                    defaultViewport: null,
                                    ignoreDefaultArgs: ['--enable-automation'],
                                    executablePath: this.execPath
                                });

                                // Close default page and create new one
                                const pages = await this.browser.pages();
                                if (pages.length > 0) {
                                    await pages[0].close();
                                }
                                this.page = await this.browser.newPage();
                                await this.page.setUserAgent(this.options.userAgent);
                                await this.addStealthMeasures();

                                console.log('Browser restarted without proxy - IP not protected!');
                                this.usingProxy = false;
                                this.emit('proxy-warning', 'Proxy failed - continuing without protection');
                                retryCount++;
                                continue;
                            }
                        }
                        throw error;
                    }
                }

                // Only set token if we successfully navigated
                if (navigationSucceeded) {
                    // Wait for localStorage to be available
                    try {
                        await this.page.waitForFunction(() => window.localStorage !== undefined, { timeout: 10000 });

                        // Set the token
                        await this.page.evaluate((token) => {
                            localStorage.setItem('token', `"${token}"`);
                            localStorage.setItem('locale', '"en-US"');
                            localStorage.setItem('theme', '"dark"');
                        }, this.options.token);

                        console.log('Token set in localStorage');
                    } catch (error) {
                        console.log('Could not set token in localStorage, continuing anyway');
                        console.log('Error:', error.message);
                    }
                }

                console.log('Navigating to Discord app...');

                // Now navigate to Discord app with token already in place
                try {
                    await this.page.goto('https://discord.com/channels/@me', {
                        waitUntil: 'domcontentloaded',
                        timeout: 60000
                    });
                } catch (navError) {
                    console.log('Could not navigate to channels, trying app URL...');
                    await this.page.goto('https://discord.com/app', {
                        waitUntil: 'domcontentloaded',
                        timeout: 30000
                    });
                }

                // Still run autoLogin for verification
                await this.autoLogin();
            } else {
                // No token, just go to Discord normally
                await this.page.goto('https://discord.com/app', {
                    waitUntil: 'networkidle2',
                    timeout: 60000
                });
            }

            // Monitor for token updates
            this.startTokenMonitoring();

            // Monitor browser events
            this.browser.on('disconnected', () => {
                this.isRunning = false;
                this.emit('closed');
            });

            this.isRunning = true;
            return { success: true };

        } catch (error) {
            console.error('Failed to launch Discord browser:', error);
            this.cleanup();
            return { success: false, error: error.message };
        }
    }

    async addStealthMeasures() {
        // Override navigator properties to avoid detection
        await this.page.evaluateOnNewDocument(() => {
            // Override navigator.webdriver
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });

            // Override navigator.plugins to appear normal
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5]
            });

            // Override navigator.languages
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en']
            });

            // Override permissions
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters)
            );

            // Override chrome runtime
            Object.defineProperty(window, 'chrome', {
                get: () => ({
                    runtime: {}
                })
            });

            // Randomize canvas fingerprint
            const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
            HTMLCanvasElement.prototype.toDataURL = function(type) {
                if (type === 'image/png' && Math.random() < 0.01) {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    ctx.fillText('noise', 0, 0);
                }
                return originalToDataURL.apply(this, arguments);
            };

            // Randomize WebGL fingerprint
            const getParameter = WebGLRenderingContext.prototype.getParameter;
            WebGLRenderingContext.prototype.getParameter = function(parameter) {
                if (parameter === 37445) {
                    return 'Intel Inc.';
                }
                if (parameter === 37446) {
                    return 'Intel Iris OpenGL Engine';
                }
                return getParameter.apply(this, arguments);
            };

            // Override screen properties
            Object.defineProperty(screen, 'availWidth', {
                get: () => screen.width
            });
            Object.defineProperty(screen, 'availHeight', {
                get: () => screen.height - 40
            });
        });

        // Randomize viewport
        const viewportWidth = 1280 + Math.floor(Math.random() * 100);
        const viewportHeight = 720 + Math.floor(Math.random() * 100);
        await this.page.setViewport({ width: viewportWidth, height: viewportHeight });

        // Add random mouse movements
        this.startRandomMouseMovements();

        // Set random timezone
        const timezones = ['America/New_York', 'Europe/London', 'Asia/Tokyo', 'Australia/Sydney'];
        const randomTimezone = timezones[Math.floor(Math.random() * timezones.length)];
        await this.page.evaluateOnNewDocument(`
            Object.defineProperty(Intl.DateTimeFormat.prototype, 'resolvedOptions', {
                value: function() {
                    return {
                        timeZone: '${randomTimezone}',
                        locale: 'en-US'
                    };
                }
            });
        `);
    }

    async autoLogin() {
        if (!this.options.token) return;

        try {
            console.log('Verifying auto-login status...');

            // Since we already set the token before navigation, just verify it worked
            // Wait a bit for Discord to fully load
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Check if we need to re-inject the token
            const tokenStatus = await this.page.evaluate((expectedToken) => {
                const currentToken = localStorage.getItem('token');
                const needsReinjection = !currentToken || currentToken !== `"${expectedToken}"`;

                if (needsReinjection) {
                    // Re-inject if needed
                    localStorage.setItem('token', `"${expectedToken}"`);
                    return { reinjected: true, currentToken };
                }

                return { reinjected: false, currentToken };
            }, this.options.token);

            if (tokenStatus.reinjected) {
                console.log('Token was re-injected');
            }

            // Simple check for Discord UI elements
            await new Promise(resolve => setTimeout(resolve, 2000));

            const loginStatus = await this.page.evaluate(() => {
                const checks = {
                    hasToken: !!localStorage.getItem('token'),
                    url: window.location.href,
                    hasAnyDiscordElement: false,
                    hasLoginForm: false
                };

                // Quick check for Discord elements
                const discordElements = [
                    document.querySelector('[class*="guilds"]'),
                    document.querySelector('[class*="channels"]'),
                    document.querySelector('[class*="chat"]'),
                    document.querySelector('[aria-label*="Servers"]'),
                    document.querySelector('#app-mount'),
                    // Additional checks for Discord app
                    document.querySelector('[class*="sidebar"]'),
                    document.querySelector('[class*="privateChannels"]'),
                    document.querySelector('[class*="container"][class*="clickable"]')
                ];

                checks.hasAnyDiscordElement = discordElements.some(el => el !== null);

                // Check for login form
                const loginElements = [
                    document.querySelector('form[class*="authBox"]'),
                    document.querySelector('input[name="email"]'),
                    document.querySelector('input[name="password"]'),
                    document.querySelector('[class*="authBox"]')
                ];

                checks.hasLoginForm = loginElements.some(el => el !== null);

                // Additional info
                checks.bodyText = document.body ? document.body.innerText.substring(0, 100) : '';

                return checks;
            });

            console.log('Login verification:', {
                hasToken: loginStatus.hasToken,
                hasDiscordUI: loginStatus.hasAnyDiscordElement,
                hasLoginForm: loginStatus.hasLoginForm,
                url: loginStatus.url
            });

            // Determine login status
            if (loginStatus.hasLoginForm && !loginStatus.hasAnyDiscordElement) {
                console.warn('Login form detected - token may be invalid');
                this.emit('login-failed', 'Token appears to be invalid or expired');
            } else if (loginStatus.hasAnyDiscordElement) {
                console.log('Auto-login successful! Discord UI detected');
                this.emit('login-success');
            } else if (loginStatus.hasToken && !loginStatus.url.includes('/login')) {
                console.log('Token is set, assuming login successful');
                this.emit('login-success');
            } else {
                console.log('Login status uncertain, Discord may still be loading');
                this.emit('login-warning', 'Discord is loading, please wait...');

                // Do a final check after more time
                setTimeout(async () => {
                    try {
                        const finalCheck = await this.page.evaluate(() => {
                            return !!document.querySelector('[class*="guilds"]') ||
                                   !!document.querySelector('[class*="channels"]') ||
                                   !!document.querySelector('[class*="sidebar"]');
                        });

                        if (finalCheck) {
                            console.log('Final check: Discord UI found!');
                            this.emit('login-success');
                        }
                    } catch (e) {
                        console.log('Final check failed:', e.message);
                    }
                }, 5000);
            }

        } catch (error) {
            console.error('Auto-login verification error:', error.message);
            // Don't fail completely, Discord might still work
            this.emit('login-warning', 'Could not verify login status, but Discord may still work');
        }
    }

    startTokenMonitoring() {
        if (!this.page) return;

        // Monitor for token changes
        setInterval(async () => {
            if (!this.page || !this.isRunning) return;

            try {
                const token = await this.page.evaluate(() => {
                    const tokenValue = window.localStorage.getItem('token');
                    if (tokenValue) {
                        return tokenValue.replace(/"/g, '');
                    }
                    return null;
                });

                if (token && token !== this.options.token) {
                    this.options.token = token;
                    this.emit('token-updated', token);
                }
            } catch (error) {
                // Page might be closed or navigated away
            }
        }, 10000); // Check every 10 seconds
    }

    startRandomMouseMovements() {
        if (!this.page) return;

        const moveMouseRandomly = async () => {
            if (!this.page || !this.isRunning) return;

            try {
                const x = Math.floor(Math.random() * 1200);
                const y = Math.floor(Math.random() * 700);
                await this.page.mouse.move(x, y);
            } catch (error) {
                // Page might be closed
            }

            // Schedule next movement
            if (this.isRunning) {
                setTimeout(moveMouseRandomly, 30000 + Math.random() * 60000);
            }
        };

        // Start after delay
        setTimeout(moveMouseRandomly, 10000);
    }

    async close() {
        this.isRunning = false;
        await this.cleanup();
    }

    async cleanup() {
        try {
            if (this.page) {
                await this.page.close().catch(() => {});
                this.page = null;
            }
            if (this.browser) {
                await this.browser.close().catch(() => {});
                this.browser = null;
            }

            // Clean up the temporary user data directory
            if (this.userDataDir) {
                try {
                    const rimraf = require('fs').promises.rm || require('fs').promises.rmdir;
                    await rimraf(this.userDataDir, { recursive: true, force: true });
                    console.log('Cleaned up session directory:', this.userDataDir);
                } catch (error) {
                    console.warn('Failed to clean up session directory:', error);
                }
            }
        } catch (error) {
            console.error('Cleanup error:', error);
        }
    }

    async clearSession() {
        if (!this.page) return;

        try {
            // Clear all browser data
            const client = await this.page.target().createCDPSession();
            await client.send('Network.clearBrowserCookies');
            await client.send('Network.clearBrowserCache');

            // Clear localStorage and sessionStorage
            await this.page.evaluate(() => {
                window.localStorage.clear();
                window.sessionStorage.clear();
            });

            console.log('Session data cleared');
        } catch (error) {
            console.error('Failed to clear session:', error);
        }
    }

    async takeScreenshot(filename) {
        if (!this.page) return;

        try {
            await this.page.screenshot({
                path: filename,
                fullPage: true
            });
            return true;
        } catch (error) {
            console.error('Screenshot failed:', error);
            return false;
        }
    }
}

module.exports = { DiscordBrowser };