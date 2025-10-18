const puppeteer = require('puppeteer');
const { EventEmitter } = require('events');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const os = require('os');
const { app } = require('electron');
const proxyChain = require('proxy-chain');
const { getStealthScripts, seedBrowserHistory, addBehavioralPatterns } = require('./stealth-engine');
const browserProfileManager = require('./browser-profiles');
const hardwareProfileManager = require('./hardware-profiles');

class DiscordBrowser extends EventEmitter {
    constructor(options = {}) {
        super();
        this.options = {
            proxy: options.proxy || null,
            token: options.token || null,
            userAgent: options.userAgent || null, // Will be set from profile
            browserProfile: options.browserProfile || null,
            blockWebRTC: options.blockWebRTC !== false, // Default to true for security
            headless: false, // Always show browser for Discord
            windowSize: { width: 1280, height: 720 },
            ...options
        };

        this.browser = null;
        this.page = null;
        this.isRunning = false;
        this.browserProfile = null;
        this.hardwareProfile = null;
    }

    generateUserAgent() {
        const userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        ];
        return userAgents[Math.floor(Math.random() * userAgents.length)];
    }

    async launch() {
        try {
            // Get or create browser profile
            if (this.options.browserProfile) {
                // Use existing profile
                this.browserProfile = this.options.browserProfile;
                console.log(`Using browser profile: ${this.browserProfile.name} (${this.browserProfile.id})`);
            } else {
                // Get current profile or create a new one
                let profile = browserProfileManager.getCurrentProfile();

                if (!profile) {
                    // Create a new profile with current hardware settings
                    const hardwareProfile = hardwareProfileManager.getCurrentProfile();
                    profile = await browserProfileManager.createProfile(
                        `Default Profile ${new Date().toLocaleDateString()}`,
                        hardwareProfile
                    );
                }

                this.browserProfile = await browserProfileManager.loadProfile(profile.id);
            }

            // Set hardware profile from browser profile
            this.hardwareProfile = this.browserProfile.hardware;
            if (this.hardwareProfile) {
                hardwareProfileManager.setCurrentProfile(this.hardwareProfile);
            }

            // Use persistent values from profile
            this.options.userAgent = this.browserProfile.userAgent || this.generateUserAgent();
            this.profileSeed = this.browserProfile.profileSeed;

            // Use the persistent profile directory
            this.userDataDir = this.browserProfile.directory;
            console.log('Using persistent profile directory:', this.userDataDir);

            // Ensure Default directory and critical subdirectories exist
            const defaultProfileDir = path.join(this.userDataDir, 'Default');
            await fs.mkdir(defaultProfileDir, { recursive: true });

            // Ensure critical Chrome directories exist for data persistence
            const cookiesDir = path.join(defaultProfileDir, 'Network');
            const localStorageDir = path.join(defaultProfileDir, 'Local Storage');
            const sessionStorageDir = path.join(defaultProfileDir, 'Session Storage');
            await fs.mkdir(cookiesDir, { recursive: true });
            await fs.mkdir(localStorageDir, { recursive: true });
            await fs.mkdir(sessionStorageDir, { recursive: true });

            // Only update WebRTC preferences if they haven't been set or if preferences don't exist
            const preferencesPath = path.join(defaultProfileDir, 'Preferences');

            let needsWebRTCUpdate = false;
            try {
                const existingPrefs = await fs.readFile(preferencesPath, 'utf-8');
                const preferences = JSON.parse(existingPrefs);

                // Only update if WebRTC settings don't exist or are different
                if (!preferences.webrtc) {
                    needsWebRTCUpdate = true;
                }

                if (needsWebRTCUpdate) {
                    // Configure WebRTC based on user preference
                    if (this.options.blockWebRTC) {
                        // Block WebRTC leaks
                        preferences.webrtc = {
                            "ip_handling_policy": "disable_non_proxied_udp",
                            "multiple_routes_enabled": false,
                            "nonproxied_udp_enabled": false
                        };
                    } else {
                        // Allow WebRTC through proxy (for UDP-capable proxies)
                        preferences.webrtc = {
                            "ip_handling_policy": "default_public_and_private_interfaces",
                            "multiple_routes_enabled": true,
                            "nonproxied_udp_enabled": true
                        };
                    }

                    await fs.writeFile(preferencesPath, JSON.stringify(preferences, null, 2));
                    console.log('Updated Chrome Preferences with WebRTC settings');
                } else {
                    console.log('Chrome Preferences already configured, preserving existing data');
                }
            } catch (e) {
                // Preferences don't exist yet - create minimal preferences with WebRTC settings
                const newPreferences = {
                    webrtc: this.options.blockWebRTC ? {
                        "ip_handling_policy": "disable_non_proxied_udp",
                        "multiple_routes_enabled": false,
                        "nonproxied_udp_enabled": false
                    } : {
                        "ip_handling_policy": "default_public_and_private_interfaces",
                        "multiple_routes_enabled": true,
                        "nonproxied_udp_enabled": true
                    }
                };

                await fs.writeFile(preferencesPath, JSON.stringify(newPreferences, null, 2));
                console.log('Created initial Chrome Preferences with WebRTC settings');
            }

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
                        // Check if it's a valid Chrome extension (has manifest.json)
                        const manifestPath = path.join(pluginPath, 'manifest.json');
                        if (require('fs').existsSync(manifestPath)) {
                            extensions.push(pluginPath);
                        } else {
                            console.log(`Skipping ${file} - not a valid extension (no manifest.json)`);
                        }
                    }
                }
            } catch (error) {
                console.log('No plugins found or error reading plugins folder');
            }

            // Prepare browser arguments - make it look like a normal Chrome browser
            this.browserArgs = [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--no-first-run',
                '--disable-blink-features=AutomationControlled',
                `--window-size=${this.options.windowSize.width},${this.options.windowSize.height}`,
                `--user-data-dir=${this.userDataDir}`,
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--disable-features=TranslateUI',
                '--disable-ipc-flooding-protection',
                '--enable-features=NetworkService,NetworkServiceInProcess',
                '--allow-running-insecure-content',
                '--disable-features=site-per-process,IsolateOrigins',
                '--flag-switches-begin',
                '--flag-switches-end',
                '--origin-trial-disabled-features=WebGPU',
                '--disable-features=BackForwardCache',
                // Ensure cookies and storage are persisted
                '--password-store=basic'
            ];

            // Add extensions if any
            if (extensions.length > 0) {
                console.log(`Loading ${extensions.length} extension(s) from ${pluginsDir}`);
                // Don't load extensions for now - they may cause launch failures
                // this.browserArgs.push(`--load-extension=${extensions.join(',')}`);
                // this.browserArgs.push('--disable-extensions-except=' + extensions.join(','));
            }

            // Find Chrome executable before using it
            try {
                this.execPath = puppeteer.executablePath();
                console.log('Using Puppeteer Chrome at:', this.execPath);
            } catch (e) {
                // Fallback to system Chrome if Puppeteer's bundled Chrome fails
                const possiblePaths = [
                    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
                    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe'
                ];
                this.execPath = possiblePaths.find(p => require('fs').existsSync(p));
                if (!this.execPath) {
                    throw new Error('Chrome executable not found. Please install Google Chrome.');
                }
                console.log('Using system Chrome at:', this.execPath);
            }

            // Check if Chrome executable exists and is accessible
            if (!require('fs').existsSync(this.execPath)) {
                console.error('Chrome executable not found at:', this.execPath);
                throw new Error('Chrome executable not found at: ' + this.execPath);
            }

            // Set up proxy using proxy-chain if configured
            this.proxyUrl = null;
            let proxyFailed = false;
            if (this.options.proxy && this.options.proxy.host) {
                // Build the upstream proxy URL
                let upstreamProxyUrl;
                const { protocol, host, port, username, password } = this.options.proxy;

                // Construct proxy URL with auth if provided
                if (username && password) {
                    upstreamProxyUrl = `${protocol}://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}`;
                } else {
                    upstreamProxyUrl = `${protocol}://${host}:${port}`;
                }

                console.log(`Setting up proxy: ${protocol}://${host}:${port}`);

                // Create a local proxy server that will forward to the actual proxy
                // This is much more reliable than configuring Chrome directly
                try {
                    this.proxyUrl = await proxyChain.anonymizeProxy(upstreamProxyUrl);
                    console.log(`Local proxy server started: ${this.proxyUrl}`);

                    // Use the local proxy server
                    this.browserArgs.push(`--proxy-server=${this.proxyUrl}`);
                    // Don't bypass the proxy for any address
                    this.browserArgs.push('--proxy-bypass-list=<-loopback>');

                    console.log('Proxy configured successfully');
                } catch (error) {
                    console.error('Failed to set up proxy server:', error.message);
                    proxyFailed = true;
                    console.warn('WARNING: Could not create proxy server. Continuing without proxy...');
                    this.emit('proxy-failed', 'Could not set up proxy server. Launching without proxy.');
                }
            }

            // Configure WebRTC based on user preference
            if (this.options.blockWebRTC) {
                // Block WebRTC leaks completely
                this.browserArgs.push('--force-webrtc-ip-handling-policy=disable_non_proxied_udp');
                this.browserArgs.push('--enforce-webrtc-ip-permission-check');
                this.browserArgs.push('--enable-features=WebRtcHideLocalIpsWithMdns');
                console.log('WebRTC blocking enabled - all WebRTC disabled');
            } else {
                // Allow WebRTC fully - DO NOT add any blocking flags
                console.log('WebRTC enabled for UDP proxy support');

                if (this.proxyUrl) {
                    // Only configure proxy routing, don't block WebRTC
                    this.browserArgs.push('--force-webrtc-ip-handling-policy=default_public_interface_only');
                    // This policy allows WebRTC but only exposes public IP (which will be the proxy IP)
                    console.log('WebRTC will route through proxy:', this.proxyUrl);
                } else {
                    // No proxy and WebRTC not blocked - user wants full WebRTC
                    console.log('WARNING: WebRTC enabled without proxy - IP may be exposed');
                }
            }

            // Launch browser with anti-detection measures
            console.log('Launching Chrome with args:', this.browserArgs.join(' '));

            this.browser = await puppeteer.launch({
                headless: false,
                args: this.browserArgs,
                defaultViewport: null,
                ignoreDefaultArgs: [
                    '--enable-automation',
                    '--enable-blink-features=AutomationControlled'
                ],
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

            // Use CDP to intercept and optionally block WebRTC at network level
            if (this.options.blockWebRTC) {
                try {
                    const client = await this.page.target().createCDPSession();

                    // Enable network domain for intercepting
                    await client.send('Network.enable');

                    // Intercept and block STUN requests at network level
                    await client.send('Network.setRequestInterception', {
                        patterns: [
                            { urlPattern: 'stun:*', interceptionStage: 'HeadersReceived' },
                            { urlPattern: '*stun*', interceptionStage: 'HeadersReceived' }
                        ]
                    });

                    // Block STUN requests
                    client.on('Network.requestIntercepted', async (event) => {
                        try {
                            if (event.request.url.includes('stun') || event.request.url.startsWith('stun:')) {
                                console.log('Blocked STUN request:', event.request.url);
                                await client.send('Network.continueInterceptedRequest', {
                                    interceptionId: event.interceptionId,
                                    errorReason: 'BlockedByClient'
                                });
                            } else {
                                await client.send('Network.continueInterceptedRequest', {
                                    interceptionId: event.interceptionId
                                });
                            }
                        } catch (error) {
                            // Request might already be handled
                        }
                    });

                    console.log('CDP WebRTC blocking enabled');
                } catch (error) {
                    console.warn('Could not set up CDP WebRTC blocking:', error.message);
                }
            } else {
                console.log('WebRTC enabled - allowing all WebRTC traffic (will route through proxy if configured)');
                // No CDP interception when WebRTC is enabled - let it work normally
            }

            // Note: Proxy authentication is already handled in the proxy URL
            // No need for separate page.authenticate() when using proxy-chain

            // If we have a token, set it before navigation
            if (this.options.token) {
                console.log('Setting up token authentication...');

                try {
                    // Navigate to Discord to establish localStorage
                    await this.page.goto('https://discord.com', {
                        waitUntil: 'domcontentloaded',
                        timeout: 60000
                    });

                    console.log('Page loaded, waiting for JavaScript to initialize...');

                    // Wait for page to initialize
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    // Set token in localStorage
                    const tokenSet = await this.page.evaluate((token) => {
                        try {
                            if (typeof localStorage !== 'undefined') {
                                localStorage.setItem('token', `"${token}"`);
                                localStorage.setItem('locale', '"en-US"');
                                localStorage.setItem('theme', '"dark"');
                                return { success: true, method: 'localStorage' };
                            }
                            window.__discordToken = token;
                            return { success: true, method: 'window' };
                        } catch (error) {
                            return { success: false, error: error.message };
                        }
                    }, this.options.token);

                    if (tokenSet.success) {
                        console.log(`Token set using ${tokenSet.method}`);
                    }

                    console.log('Navigating to Discord app with Google referrer...');

                    // Navigate to Discord channels with Google as referrer
                    await this.page.goto('https://discord.com/channels/@me', {
                        waitUntil: 'domcontentloaded',
                        timeout: 60000,
                        referer: 'https://www.google.com/'
                    });

                } catch (error) {
                    console.error('Error during token setup:', error.message);
                    console.log('Continuing to Discord without auto-login...');
                    await this.page.goto('https://discord.com/channels/@me', {
                        waitUntil: 'domcontentloaded',
                        timeout: 60000,
                        referer: 'https://www.google.com/'
                    });
                }

                // Run autoLogin for verification
                await this.autoLogin();
            } else {
                // No token, go to random search engine with random query
                const searchEngines = [
                    { name: 'Bing', url: 'https://www.bing.com/search?q=' },
                    { name: 'Yahoo', url: 'https://search.yahoo.com/search?p=' },
                    { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=' },
                    { name: 'Yandex', url: 'https://yandex.com/search/?text=' },
                    { name: 'AOL', url: 'https://search.aol.com/aol/search?q=' }
                ];

                const queries = [
                    'google',
                    'google signup',
                    'submit a copyright removal request youtube',
                    'gmail signup',
                    'youtube signup'
                ];

                // Pick random search engine and query
                const randomEngine = searchEngines[Math.floor(Math.random() * searchEngines.length)];
                const randomQuery = queries[Math.floor(Math.random() * queries.length)];
                const searchUrl = randomEngine.url + encodeURIComponent(randomQuery);

                console.log(`No token provided, navigating to ${randomEngine.name} with query: "${randomQuery}"`);
                try {
                    await this.page.goto(searchUrl, {
                        waitUntil: 'domcontentloaded',
                        timeout: 30000
                    });
                } catch (navError) {
                    console.log(`Failed to navigate to ${randomEngine.name}: ${navError.message}`);

                    // If proxy is failing, offer to disable it and continue
                    if (navError.message.includes('ERR_TUNNEL_CONNECTION_FAILED') || navError.message.includes('ERR_PROXY_CONNECTION_FAILED')) {
                        console.error('Proxy connection failed. The proxy server is not responding.');

                        // Close the proxy and restart without it
                        if (this.proxyUrl) {
                            console.log('Disabling proxy and continuing...');
                            // Navigate to a blank page first
                            await this.page.goto('about:blank');
                            // Emit warning
                            this.emit('proxy-failed', 'Proxy connection failed. Browser launched but without proxy protection.');
                        }
                    } else {
                        // Try fallback navigation
                        console.log('Trying Google as fallback...');
                        try {
                            await this.page.goto('https://www.google.com/search?q=' + encodeURIComponent(randomQuery), {
                                waitUntil: 'domcontentloaded',
                                timeout: 30000
                            });
                        } catch (fallbackError) {
                            console.log('Fallback also failed. Navigating to blank page...');
                            // Just go to blank page - browser is still launched successfully
                            await this.page.goto('about:blank');
                            console.log('Browser launched successfully. You can navigate manually.');
                        }
                    }
                }
            }

            // Monitor for token updates
            this.startTokenMonitoring();

            // Monitor browser events
            this.browser.on('disconnected', () => {
                console.log('Browser disconnected');
                this.isRunning = false;
                this.emit('closed');
            });

            // Add error handling for page crashes
            this.page.on('error', error => {
                console.error('Page crashed:', error);
            });

            this.page.on('pageerror', error => {
                console.error('Page error:', error.message);
            });

            // Keep browser alive with periodic activity
            this.keepAliveInterval = setInterval(async () => {
                if (this.page && this.isRunning) {
                    try {
                        // Just evaluate something simple to keep connection alive
                        await this.page.evaluate(() => document.title);
                    } catch (error) {
                        // Page might be navigating or closed
                    }
                }
            }, 30000); // Every 30 seconds

            this.isRunning = true;
            this.sessionStartTime = Date.now();
            return { success: true };

        } catch (error) {
            console.error('Failed to launch Discord browser:', error);

            // Handle frame detachment gracefully
            if (error.message && error.message.includes('frame was detached')) {
                console.log('Browser window was closed during launch - this is normal behavior');
                this.isRunning = true; // Browser is actually running, just detached
                return { success: true };
            }

            this.cleanup();
            return { success: false, error: error.message };
        }
    }

    async addStealthMeasures() {
        // Apply all stealth scripts before page loads
        await this.page.evaluateOnNewDocument(() => {
            // Override navigator.webdriver safely
            try {
                const descriptor = Object.getOwnPropertyDescriptor(navigator, 'webdriver');
                if (!descriptor || descriptor.configurable) {
                    Object.defineProperty(navigator, 'webdriver', {
                        get: () => undefined
                    });
                } else {
                    delete navigator.webdriver;
                }
            } catch (e) {
                // Can't override webdriver
            }

            // Override navigator.languages safely
            try {
                const descriptor = Object.getOwnPropertyDescriptor(navigator, 'languages');
                if (!descriptor || descriptor.configurable) {
                    Object.defineProperty(navigator, 'languages', {
                        get: () => ['en-US', 'en']
                    });
                }
            } catch (e) {
                // Can't override languages
            }

            // MediaDevices override with persistent device IDs from profile
            // These IDs are set per profile and don't change
        });

        // Get stealth scripts with current profile values, WebRTC option, and profile info
        const stealthScripts = getStealthScripts(this.options.blockWebRTC, this.browserProfile);

        // Inject all comprehensive stealth scripts
        await this.page.evaluateOnNewDocument(stealthScripts.navigatorPlugins);
        await this.page.evaluateOnNewDocument(stealthScripts.chromeObject);
        await this.page.evaluateOnNewDocument(stealthScripts.canvasProtection);
        await this.page.evaluateOnNewDocument(stealthScripts.webglProtection);
        await this.page.evaluateOnNewDocument(stealthScripts.navigatorProperties);
        await this.page.evaluateOnNewDocument(stealthScripts.batteryProtection);
        await this.page.evaluateOnNewDocument(stealthScripts.audioProtection);
        await this.page.evaluateOnNewDocument(stealthScripts.fontProtection);
        await this.page.evaluateOnNewDocument(stealthScripts.screenProperties);
        await this.page.evaluateOnNewDocument(stealthScripts.timezoneProtection);
        await this.page.evaluateOnNewDocument(stealthScripts.permissionsAPI);
        await this.page.evaluateOnNewDocument(stealthScripts.credentialsAPI);
        await this.page.evaluateOnNewDocument(stealthScripts.visitedLinks);

        // Inject appropriate WebRTC script based on blocking preference
        if (stealthScripts.webrtcQuiet) {
            // The webrtcQuiet script now handles both blocking and proxy-friendly modes
            await this.page.evaluateOnNewDocument(stealthScripts.webrtcQuiet);
        }

        // Seed browser with fake history and cookies
        await seedBrowserHistory(this.page);

        // Add behavioral patterns (idle, tab switching, etc.)
        await addBehavioralPatterns(this.page);

        // Use screen dimensions from hardware profile (no randomization)
        const screen = this.hardwareProfile?.screen || {};
        const viewportWidth = screen.width || 1920;
        const viewportHeight = screen.height || 1080;
        await this.page.setViewport({ width: viewportWidth, height: viewportHeight });

        // Add random mouse movements
        this.startRandomMouseMovements();

        // Add more realistic user behavior
        this.simulateRealisticBehavior();
    }

    // New method for realistic behavior simulation
    simulateRealisticBehavior() {
        // Simulate random scrolling
        setInterval(async () => {
            if (this.page && this.isRunning && Math.random() < 0.03) {
                try {
                    await this.page.evaluate(() => {
                        const maxScroll = document.body.scrollHeight - window.innerHeight;
                        const scrollTo = Math.floor(Math.random() * maxScroll);
                        window.scrollTo({
                            top: scrollTo,
                            behavior: 'smooth'
                        });
                    });
                } catch (e) {
                    // Page might be navigating
                }
            }
        }, 15000); // Every 15 seconds

        // Simulate typing with mistakes and corrections
        this.page.on('framenavigated', async () => {
            await this.page.evaluate(() => {
                document.addEventListener('keydown', (e) => {
                    // Occasionally simulate typos (5% chance)
                    if (Math.random() < 0.05 && e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                        setTimeout(() => {
                            // Simulate backspace after typo
                            const backspaceEvent = new KeyboardEvent('keydown', { key: 'Backspace', code: 'Backspace' });
                            e.target.dispatchEvent(backspaceEvent);
                        }, 100 + Math.random() * 200);
                    }
                });
            });
        });

        // Simulate focus/blur events
        setInterval(async () => {
            if (this.page && this.isRunning && Math.random() < 0.02) {
                try {
                    await this.page.evaluate(() => {
                        const elements = document.querySelectorAll('input, textarea, button, a');
                        if (elements.length > 0) {
                            const element = elements[Math.floor(Math.random() * elements.length)];
                            element.focus();
                            setTimeout(() => element.blur(), 500 + Math.random() * 1000);
                        }
                    });
                } catch (e) {
                    // Page might be navigating
                }
            }
        }, 10000);
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
            // Give Chrome time to save all data before closing
            if (this.page) {
                // Navigate to blank page to trigger any pending saves
                await this.page.goto('about:blank').catch(() => {});
                // Wait a bit for Chrome to save data
                await new Promise(resolve => setTimeout(resolve, 1000));
                await this.page.close().catch(() => {});
                this.page = null;
            }
            if (this.browser) {
                // Gracefully close the browser to ensure data is saved
                await this.browser.close().catch(() => {});
                // Wait a bit more to ensure all data is written to disk
                await new Promise(resolve => setTimeout(resolve, 500));
                this.browser = null;
            }

            // Close the proxy server if it was created
            if (this.proxyUrl) {
                try {
                    await proxyChain.closeAnonymizedProxy(this.proxyUrl, true);
                    console.log('Proxy server closed');
                } catch (error) {
                    console.warn('Failed to close proxy server:', error);
                }
            }

            // DO NOT DELETE the user data directory - it's now persistent!
            if (this.userDataDir && this.browserProfile) {
                console.log('Browser profile preserved at:', this.userDataDir);

                // Update profile stats
                if (this.browserProfile.stats) {
                    this.browserProfile.stats.totalTime += Date.now() - this.sessionStartTime;
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