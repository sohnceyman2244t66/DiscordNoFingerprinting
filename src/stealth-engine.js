// Comprehensive Stealth Engine for Undetectable Browser
// This module makes the browser appear as a normal, frequently-used Chrome instance

const profileManager = require('./hardware-profiles');

const DEVICE_MEMORY_BUCKETS = [0.25, 0.5, 1, 2, 4, 8];

function sanitizeString(value, fallback) {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed.length > 0) {
            return trimmed;
        }
    }
    return fallback;
}

function normalizeDeviceMemory(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
        return 8;
    }
    return DEVICE_MEMORY_BUCKETS.reduce((prev, curr) => {
        return Math.abs(curr - numeric) < Math.abs(prev - numeric) ? curr : prev;
    }, DEVICE_MEMORY_BUCKETS[0]);
}

function normalizeThreadCount(hardware) {
    if (!hardware) return 8;
    const threads = Number(hardware.threads);
    if (Number.isInteger(threads) && threads > 0) {
        return threads;
    }
    const cores = Number(hardware.cores);
    if (Number.isInteger(cores) && cores > 0) {
        return cores;
    }
    return 8;
}

function normalizeLanguage(language, fallback) {
    if (typeof language === 'string' && language.trim()) {
        return language.trim();
    }
    if (typeof fallback === 'string' && fallback.trim()) {
        return fallback.trim();
    }
    return 'en-US';
}

function normalizeLanguageList(languages, fallbackLanguage) {
    const list = Array.isArray(languages) ? languages.filter((lang) => typeof lang === 'string' && lang.trim()) : [];
    const primary = normalizeLanguage(fallbackLanguage, list[0]);
    if (!list.length) {
        list.push(primary);
    } else if (!list.includes(primary)) {
        list.unshift(primary);
    }
    const short = primary.split('-')[0];
    if (!list.includes(short)) {
        list.push(short);
    }
    return Array.from(new Set(list));
}

function normalizeScreenDimension(value, fallback) {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric >= 320) {
        return Math.round(numeric);
    }
    return fallback;
}

function normalizeColorDepth(value, fallback) {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric >= 8 && numeric <= 48) {
        return Math.round(numeric);
    }
    return fallback;
}

function normalizeTimeZone(timezone) {
    if (typeof timezone === 'string' && timezone.trim()) {
        return timezone.trim();
    }
    return 'America/New_York';
}

function resolveTimezoneOffset(timezone, fallback) {
    try {
        const now = new Date();
        const localeString = now.toLocaleString('en-US', { timeZone: timezone });
        const localeDate = new Date(localeString);
        const utcString = now.toLocaleString('en-US', { timeZone: 'UTC' });
        const utcDate = new Date(utcString);
        return Math.round((utcDate - localeDate) / 60000);
    } catch (error) {
        if (typeof fallback === 'number' && Number.isFinite(fallback)) {
            return Math.round(fallback);
        }
        return new Date().getTimezoneOffset();
    }
}

function buildMediaDeviceLabels(deviceName) {
    const base = sanitizeString(deviceName, 'Realtek High Definition Audio');
    return {
        audioInput: base.includes('Microphone') ? base : `Microphone (${base})`,
        audioOutput: base.includes('Speakers') ? base : `Speakers (${base})`,
        video: 'Integrated Camera'
    };
}

// Get current profile for consistent values
const getStealthScripts = (blockWebRTC = true, browserProfile = null) => {
    const profile = profileManager.getCurrentProfile() || {};
    const hardware = profile.hardware || {};
    const location = profile.location || {};
    const browser = profile.browser || {};

    // Use profile seed for deterministic randomness
    const profileSeed = browserProfile?.profileSeed || 12345;
    const mediaDevices = browserProfile?.mediaDevices || {};
    const battery = browserProfile?.battery || { charging: true, level: 0.85 };

    const sanitizedDeviceMemory = normalizeDeviceMemory(hardware.memory);
    const sanitizedThreads = normalizeThreadCount(hardware);
    const sanitizedLanguages = normalizeLanguageList(location.languages, location.language);
    const primaryLanguage = sanitizedLanguages[0] || 'en-US';
    const sanitizedGpuVendor = sanitizeString(hardware.gpuVendor, 'Intel Inc.');
    const sanitizedGpuRenderer = sanitizeString(hardware.gpuRenderer, 'Intel(R) UHD Graphics 630');
    const sanitizedAngleRenderer = 'ANGLE (Direct3D11 vs_5_0 ps_5_0)';
    const screen = hardware.screen || {};
    const sanitizedScreenWidth = normalizeScreenDimension(screen.width, 1920);
    const sanitizedScreenHeight = normalizeScreenDimension(screen.height, 1080);
    const sanitizedColorDepth = normalizeColorDepth(screen.colorDepth, 24);
    const sanitizedPixelDepth = normalizeColorDepth(screen.pixelDepth, sanitizedColorDepth);
    const sanitizedTimezone = normalizeTimeZone(location.timezone);
    const sanitizedTimezoneOffset = resolveTimezoneOffset(sanitizedTimezone, location.timezoneOffset);
    const sanitizedLocale = normalizeLanguage(location.locale, primaryLanguage);
    const mediaDeviceLabels = buildMediaDeviceLabels(hardware.audio);

    const serializedLanguages = JSON.stringify(sanitizedLanguages);
    const serializedPrimaryLanguage = JSON.stringify(primaryLanguage);
    const serializedTimezone = JSON.stringify(sanitizedTimezone);
    const serializedLocale = JSON.stringify(sanitizedLocale);
    const serializedGpuVendor = JSON.stringify(sanitizedGpuVendor);
    const serializedGpuRenderer = JSON.stringify(sanitizedGpuRenderer);
    const serializedAngleRenderer = JSON.stringify(sanitizedAngleRenderer);

    return {
    // Complete navigator.plugins override with proper PluginArray
    navigatorPlugins: `
        (() => {
            const pluginData = [
                {
                    name: 'Chrome PDF Plugin',
                    filename: 'internal-pdf-viewer',
                    description: 'Portable Document Format',
                    mimeTypes: [
                        { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' },
                        { type: 'text/pdf', suffixes: 'pdf', description: 'Portable Document Format' }
                    ]
                },
                {
                    name: 'Chrome PDF Viewer',
                    filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
                    description: 'Portable Document Format',
                    mimeTypes: [
                        { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' }
                    ]
                },
                {
                    name: 'Chromium PDF Viewer',
                    filename: 'internal-pdf-viewer',
                    description: 'Portable Document Format',
                    mimeTypes: [
                        { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' }
                    ]
                },
                {
                    name: 'Microsoft Edge PDF Viewer',
                    filename: 'internal-pdf-viewer',
                    description: 'Portable Document Format',
                    mimeTypes: [
                        { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' }
                    ]
                },
                {
                    name: 'WebKit built-in PDF',
                    filename: 'internal-pdf-viewer',
                    description: 'Portable Document Format',
                    mimeTypes: [
                        { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' }
                    ]
                }
            ];

            const mimeTypes = [];
            const plugins = [];

            pluginData.forEach((p, i) => {
                const plugin = {};
                plugin.name = p.name;
                plugin.filename = p.filename;
                plugin.description = p.description;
                plugin.length = p.mimeTypes.length;

                p.mimeTypes.forEach((m, j) => {
                    const mimeType = {};
                    mimeType.type = m.type;
                    mimeType.suffixes = m.suffixes;
                    mimeType.description = m.description;
                    mimeType.enabledPlugin = plugin;

                    Object.defineProperty(plugin, j, {
                        value: mimeType,
                        writable: false,
                        enumerable: true,
                        configurable: true
                    });

                    mimeTypes.push(mimeType);
                });

                plugin[Symbol.iterator] = function* () {
                    for (let i = 0; i < this.length; i++) {
                        yield this[i];
                    }
                };

                plugins.push(plugin);
            });

            Object.setPrototypeOf(plugins, PluginArray.prototype);
            Object.setPrototypeOf(mimeTypes, MimeTypeArray.prototype);

            // Safely define navigator.plugins
            try {
                const descriptor = Object.getOwnPropertyDescriptor(navigator, 'plugins');
                if (!descriptor || descriptor.configurable) {
                    Object.defineProperty(navigator, 'plugins', {
                        get: () => plugins,
                        enumerable: true,
                        configurable: true
                    });
                }
            } catch (e) {
                // Can't override plugins
            }

            // Safely define navigator.mimeTypes
            try {
                const descriptor = Object.getOwnPropertyDescriptor(navigator, 'mimeTypes');
                if (!descriptor || descriptor.configurable) {
                    Object.defineProperty(navigator, 'mimeTypes', {
                        get: () => mimeTypes,
                        enumerable: true,
                        configurable: true
                    });
                }
            } catch (e) {
                // Can't override mimeTypes
            }
        })();
    `,

    // Complete Chrome object with all real properties
    chromeObject: `
        (() => {
            // Check if chrome already exists and try to extend it
            const existingChrome = window.chrome || {};

            const mockChrome = {
                app: existingChrome.app || {
                    isInstalled: false,
                    InstallState: {
                        DISABLED: 'disabled',
                        INSTALLED: 'installed',
                        NOT_INSTALLED: 'not_installed'
                    },
                    RunningState: {
                        CANNOT_RUN: 'cannot_run',
                        READY_TO_RUN: 'ready_to_run',
                        RUNNING: 'running'
                    }
                },
                runtime: existingChrome.runtime || {
                    OnInstalledReason: {
                        CHROME_UPDATE: 'chrome_update',
                        INSTALL: 'install',
                        SHARED_MODULE_UPDATE: 'shared_module_update',
                        UPDATE: 'update'
                    },
                    OnRestartRequiredReason: {
                        APP_UPDATE: 'app_update',
                        OS_UPDATE: 'os_update',
                        PERIODIC: 'periodic'
                    },
                    PlatformArch: {
                        ARM: 'arm',
                        ARM64: 'arm64',
                        MIPS: 'mips',
                        MIPS64: 'mips64',
                        X86_32: 'x86-32',
                        X86_64: 'x86-64'
                    },
                    PlatformNaclArch: {
                        ARM: 'arm',
                        MIPS: 'mips',
                        MIPS64: 'mips64',
                        X86_32: 'x86-32',
                        X86_64: 'x86-64'
                    },
                    PlatformOs: {
                        ANDROID: 'android',
                        CROS: 'cros',
                        LINUX: 'linux',
                        MAC: 'mac',
                        OPENBSD: 'openbsd',
                        WIN: 'win'
                    },
                    RequestUpdateCheckStatus: {
                        NO_UPDATE: 'no_update',
                        THROTTLED: 'throttled',
                        UPDATE_AVAILABLE: 'update_available'
                    }
                }
            };

            // Add deprecated but still checked methods
            mockChrome.loadTimes = existingChrome.loadTimes || function() {
                return {
                    requestTime: Date.now() / 1000 - Math.random() * 100,
                    startLoadTime: Date.now() / 1000 - Math.random() * 100,
                    commitLoadTime: Date.now() / 1000 - Math.random() * 90,
                    finishDocumentLoadTime: Date.now() / 1000 - Math.random() * 80,
                    finishLoadTime: Date.now() / 1000 - Math.random() * 70,
                    firstPaintTime: Date.now() / 1000 - Math.random() * 65,
                    firstPaintAfterLoadTime: 0,
                    navigationType: 'Other',
                    wasFetchedViaSpdy: true,
                    wasNpnNegotiated: true,
                    npnNegotiatedProtocol: 'h2',
                    wasAlternateProtocolAvailable: false,
                    connectionInfo: 'h2'
                };
            };

            mockChrome.csi = existingChrome.csi || function() {
                return {
                    onloadT: Date.now() - Math.random() * 1000,
                    pageT: Date.now() - Math.random() * 10000,
                    startE: Date.now() - Math.random() * 10000,
                    tran: 15
                };
            };

            // Merge with existing chrome properties
            Object.keys(existingChrome).forEach(key => {
                if (!mockChrome[key]) {
                    mockChrome[key] = existingChrome[key];
                }
            });

            // Try to define or update chrome object
            try {
                const descriptor = Object.getOwnPropertyDescriptor(window, 'chrome');
                if (!descriptor || descriptor.configurable) {
                    Object.defineProperty(window, 'chrome', {
                        get: () => mockChrome,
                        enumerable: true,
                        configurable: true
                    });
                } else if (descriptor && descriptor.writable) {
                    window.chrome = mockChrome;
                } else {
                    // Can't redefine, try to extend existing
                    Object.keys(mockChrome).forEach(key => {
                        if (!window.chrome[key]) {
                            try {
                                window.chrome[key] = mockChrome[key];
                            } catch (e) {
                                // Ignore if can't set
                            }
                        }
                    });
                }
            } catch (error) {
                // Fallback: try direct assignment
                try {
                    if (!window.chrome) {
                        window.chrome = mockChrome;
                    } else {
                        Object.assign(window.chrome, mockChrome);
                    }
                } catch (e) {
                    // Chrome object is completely locked, can't modify
                }
            }
        })();
    `,

    // Canvas fingerprint protection with real noise on EVERY read
    canvasProtection: `
        (() => {
            const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
            const originalToBlob = HTMLCanvasElement.prototype.toBlob;
            const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;

            // Use profile seed for consistent fingerprint
            const profileSeed = ${profileSeed};
            const getNoise = (index) => {
                const x = Math.sin(profileSeed + index) * 10000;
                return (x - Math.floor(x)) * 0.0001; // Very small noise
            };

            HTMLCanvasElement.prototype.toDataURL = function() {
                const dataURL = originalToDataURL.apply(this, arguments);
                // Return consistent result for this profile
                return dataURL;
            };

            HTMLCanvasElement.prototype.toBlob = function(callback) {
                return originalToBlob.call(this, function(blob) {
                    callback(blob);
                });
            };

            CanvasRenderingContext2D.prototype.getImageData = function() {
                const imageData = originalGetImageData.apply(this, arguments);
                const data = imageData.data;

                // Apply consistent noise based on profile seed
                for (let i = 0; i < data.length; i += 4) {
                    const noise = getNoise(i);
                    if (noise > 0.999) { // Very subtle, consistent noise
                        data[i] = Math.min(255, data[i] + 1);
                        data[i+1] = data[i+1] ^ 1;
                        data[i+2] = data[i+2] ^ 1;
                    }
                }

                return imageData;
            };
        })();
    `,

    // WebGL fingerprint protection using profile GPU
    webglProtection: `
        (() => {
            // Use profile GPU values
            const vendor = '${profile.hardware.gpuVendor || 'Intel Inc.'}';
            const renderer = 'ANGLE (' + '${profile.hardware.gpuRenderer || 'Intel(R) UHD Graphics 630'}' + ' Direct3D11 vs_5_0 ps_5_0)';

            const getParameter = WebGLRenderingContext.prototype.getParameter;
            WebGLRenderingContext.prototype.getParameter = function(parameter) {
                if (parameter === 37445) return vendor;
                if (parameter === 37446) return renderer;
                return getParameter.apply(this, arguments);
            };

            if (WebGL2RenderingContext) {
                const getParameter2 = WebGL2RenderingContext.prototype.getParameter;
                WebGL2RenderingContext.prototype.getParameter = function(parameter) {
                    if (parameter === 37445) return vendor;
                    if (parameter === 37446) return renderer;
                    return getParameter2.apply(this, arguments);
                };
            }
        })();
    `,

    // Complete navigator properties with profile values
    navigatorProperties: `
        (() => {
            // Helper function to safely define property
            const safeDefineProperty = (obj, prop, descriptor) => {
                try {
                    const existing = Object.getOwnPropertyDescriptor(obj, prop);
                    if (!existing || existing.configurable) {
                        Object.defineProperty(obj, prop, descriptor);
                    } else if (existing.writable) {
                        obj[prop] = descriptor.get ? descriptor.get() : descriptor.value;
                    }
                } catch (e) {
                    // Property is locked, skip
                }
            };

            // Always use Win32 for consistency
            safeDefineProperty(navigator, 'platform', {
                get: () => 'Win32',
                enumerable: true,
                configurable: true
            });

            // Use profile hardware values
            safeDefineProperty(navigator, 'hardwareConcurrency', {
                get: () => ${sanitizedThreads},
                enumerable: true,
                configurable: true
            });

            safeDefineProperty(navigator, 'deviceMemory', {
                get: () => ${sanitizedDeviceMemory},
                enumerable: true,
                configurable: true
            });

            // Max touch points (0 for desktop)
            safeDefineProperty(navigator, 'maxTouchPoints', {
                get: () => 0,
                enumerable: true,
                configurable: true
            });

            // Override languages with profile values
            safeDefineProperty(navigator, 'language', {
                get: () => ${serializedPrimaryLanguage},
                enumerable: true,
                configurable: true
            });

            safeDefineProperty(navigator, 'languages', {
                get: () => ${serializedLanguages},
                enumerable: true,
                configurable: true
            });
        })();
    `,

    // Battery API spoofing
    batteryProtection: `
        (() => {
            // Use profile's persistent battery state
            navigator.getBattery = async () => {
                const battery = {
                    charging: ${battery.charging},
                    chargingTime: ${battery.charging ? 3600 : 'Infinity'},
                    dischargingTime: Infinity,
                    level: ${battery.level},
                    addEventListener: () => {},
                    removeEventListener: () => {},
                    dispatchEvent: () => true
                };
                return battery;
            };
        })();
    `,

    // AudioContext fingerprint protection
    audioProtection: `
        (() => {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                const originalCreateOscillator = AudioContext.prototype.createOscillator;
                const originalCreateAnalyser = AudioContext.prototype.createAnalyser;

                // Use profile seed for consistent audio fingerprint
                const profileSeed = ${profileSeed};
                const getAudioNoise = (index) => {
                    const x = Math.sin(profileSeed + index) * 10000;
                    return (x - Math.floor(x)) * 0.00001;
                };

                AudioContext.prototype.createOscillator = function() {
                    const oscillator = originalCreateOscillator.apply(this, arguments);
                    const originalConnect = oscillator.connect;

                    oscillator.connect = function() {
                        // Add consistent tiny noise to frequency
                        if (oscillator.frequency) {
                            oscillator.frequency.value += getAudioNoise(1);
                        }
                        return originalConnect.apply(this, arguments);
                    };

                    return oscillator;
                };

                AudioContext.prototype.createAnalyser = function() {
                    const analyser = originalCreateAnalyser.apply(this, arguments);
                    const originalGetFloatFrequencyData = analyser.getFloatFrequencyData;

                    analyser.getFloatFrequencyData = function(array) {
                        originalGetFloatFrequencyData.apply(this, arguments);
                        // Add consistent noise to frequency data
                        for (let i = 0; i < array.length; i++) {
                            array[i] += getAudioNoise(i);
                        }
                    };

                    return analyser;
                };
            }
        })();
    `,

    // Font enumeration protection
    fontProtection: `
        (() => {
            // Disable font variation - return exact metrics
            // Fonts should be consistent per profile
        })();
    `,

    // Screen properties using profile values
    screenProperties: `
        (() => {
            const width = ${sanitizedScreenWidth};
            const height = ${sanitizedScreenHeight};
            const colorDepth = ${sanitizedColorDepth};
            const pixelDepth = ${sanitizedPixelDepth};
            const availHeight = Math.max(height - 80, 0);

            const safeDefine = (prop, value) => {
                try {
                    const descriptor = Object.getOwnPropertyDescriptor(screen, prop);
                    if (!descriptor || descriptor.configurable) {
                        Object.defineProperty(screen, prop, {
                            get: () => value,
                            enumerable: true,
                            configurable: true
                        });
                    }
                } catch (e) {
                    // Property is locked, skip
                }
            };

            safeDefine('width', width);
            safeDefine('height', height);
            safeDefine('availWidth', width);
            safeDefine('availHeight', availHeight);
            safeDefine('colorDepth', colorDepth);
            safeDefine('pixelDepth', pixelDepth);

            if (screen.orientation && typeof screen.orientation === 'object') {
                try {
                    const orientation = screen.orientation;
                    const orientationType = width >= height ? 'landscape-primary' : 'portrait-primary';
                    Object.defineProperty(orientation, 'angle', {
                        get: () => 0,
                        configurable: true
                    });
                    Object.defineProperty(orientation, 'type', {
                        get: () => orientationType,
                        configurable: true
                    });
                } catch (e) {}
            }
        })();
    `,

    // Complete timezone fix using profile values
    timezoneProtection: `
        (() => {
            const timezone = '${profile.location.timezone || 'America/New_York'}';
            const offset = ${profile.location.timezoneOffset || 300};
            const locale = '${profile.location.locale || 'en-US'}';

            // Override Date.prototype.getTimezoneOffset
            Date.prototype.getTimezoneOffset = function() {
                return offset;
            };

            // Override Intl.DateTimeFormat
            const OriginalDateTimeFormat = Intl.DateTimeFormat;
            Intl.DateTimeFormat = function(loc, options) {
                if (!options) options = {};
                options.timeZone = timezone;
                return new OriginalDateTimeFormat(loc || locale, options);
            };

            Intl.DateTimeFormat.prototype = OriginalDateTimeFormat.prototype;

            // Override resolvedOptions to be consistent
            const originalResolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions;
            Intl.DateTimeFormat.prototype.resolvedOptions = function() {
                const options = originalResolvedOptions.call(this);
                options.timeZone = timezone;
                options.locale = locale;
                return options;
            };

            // Override toLocaleString methods
            Date.prototype.toLocaleString = function() {
                return new OriginalDateTimeFormat(locale, {
                    dateStyle: 'short',
                    timeStyle: 'medium',
                    timeZone: timezone
                }).format(this);
            };

            Date.prototype.toLocaleDateString = function() {
                return new OriginalDateTimeFormat(locale, {
                    dateStyle: 'short',
                    timeZone: timezone
                }).format(this);
            };

            Date.prototype.toLocaleTimeString = function() {
                return new OriginalDateTimeFormat(locale, {
                    timeStyle: 'medium',
                    timeZone: timezone
                }).format(this);
            };
        })();
    `,

    // Navigator credentials API - simulate saved passwords
    credentialsAPI: `
        (() => {
            // Override credentials API with consistent profile-based responses
            if (!navigator.credentials) {
                navigator.credentials = {};
            }

            const profileSeed = ${profileSeed};
            const hasCredentials = (profileSeed % 3) === 0; // 33% of profiles have saved credentials

            navigator.credentials.get = async function(options) {
                // Simulate thinking about saved passwords
                await new Promise(resolve => setTimeout(resolve, 100));

                // Return consistent result for this profile
                if (hasCredentials) {
                    return {
                        id: 'user_' + profileSeed.toString(36),
                        type: 'password',
                        name: 'Saved User'
                    };
                }
                return null;
            };

            navigator.credentials.store = async function(credential) {
                await new Promise(resolve => setTimeout(resolve, 50));
                return credential;
            };

            navigator.credentials.create = async function(options) {
                await new Promise(resolve => setTimeout(resolve, 100));
                return {
                    id: 'cred_' + profileSeed.toString(36),
                    type: options.publicKey ? 'public-key' : 'password'
                };
            };

            navigator.credentials.preventSilentAccess = async function() {
                await new Promise(resolve => setTimeout(resolve, 10));
                return undefined;
            };
        })();
    `,

    // CSS visited link history simulation
    visitedLinks: `
        (() => {
            // Simulate :visited links for common sites
            const visitedURLs = [
                'https://www.google.com',
                'https://www.youtube.com',
                'https://www.facebook.com',
                'https://www.reddit.com',
                'https://www.amazon.com',
                'https://www.wikipedia.org',
                'https://www.github.com',
                'https://stackoverflow.com',
                'https://discord.com'
            ];

            // Override getComputedStyle to show visited links
            const originalGetComputedStyle = window.getComputedStyle;
            window.getComputedStyle = function(element, pseudoEl) {
                const styles = originalGetComputedStyle.apply(this, arguments);

                // Check if this is a link to a "visited" site
                if (element.tagName === 'A' && element.href) {
                    for (const url of visitedURLs) {
                        if (element.href.includes(url)) {
                            // Return visited color
                            return new Proxy(styles, {
                                get(target, prop) {
                                    if (prop === 'color') return 'rgb(85, 26, 139)'; // Purple visited color
                                    return target[prop];
                                }
                            });
                        }
                    }
                }

                return styles;
            };
        })();
    `,

    // Permission API complete override
    permissionsAPI: `
        (() => {
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = function(parameters) {
                const validPermissions = [
                    'geolocation', 'notifications', 'push', 'midi', 'camera',
                    'microphone', 'speaker', 'device-info', 'background-sync',
                    'bluetooth', 'persistent-storage', 'ambient-light-sensor',
                    'accelerometer', 'gyroscope', 'magnetometer', 'clipboard',
                    'screen-wake-lock', 'nfc', 'display-capture'
                ];

                if (validPermissions.includes(parameters.name)) {
                    return Promise.resolve({
                        state: 'prompt',
                        onchange: null
                    });
                }

                return originalQuery(parameters);
            };
        })();
    `,

    // WebRTC handling - either block or proxy-friendly

    webrtcQuiet: blockWebRTC ? `
        (() => {
            // Simplified WebRTC blocker - just drop host candidates and remove STUN
            const OriginalRTCPeerConnection = window.RTCPeerConnection;
            if (!OriginalRTCPeerConnection) return;

            window.RTCPeerConnection = function(config, constraints) {
                // Remove STUN servers only, keep TURN
                if (config && config.iceServers) {
                    config.iceServers = config.iceServers.filter(server => {
                        if (!server || !server.urls) return false;
                        const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
                        return !urls.every(url => url.includes('stun:'));
                    });
                }

                const pc = new OriginalRTCPeerConnection(config, constraints);

                // Simply drop host ICE candidates
                const originalOnIceCandidate = pc.onicecandidate;
                Object.defineProperty(pc, 'onicecandidate', {
                    get: () => originalOnIceCandidate,
                    set: (handler) => {
                        pc.__onicecandidate = (event) => {
                            if (event.candidate && event.candidate.candidate) {
                                // Only drop host candidates, allow relay and srflx
                                if (event.candidate.candidate.includes('typ host')) {
                                    return;
                                }
                            }
                            if (handler) handler(event);
                        };
                    }
                });



                return pc;
            };

            window.RTCPeerConnection.prototype = OriginalRTCPeerConnection.prototype;
            if (window.webkitRTCPeerConnection) {
                window.webkitRTCPeerConnection = window.RTCPeerConnection;
            }
            if (window.mozRTCPeerConnection) {
                window.mozRTCPeerConnection = window.RTCPeerConnection;
            }
        })();

    ` : `
        (() => {
            // Proxy-friendly WebRTC configuration
            // Allow WebRTC to function normally - just log for debugging
            console.log('WebRTC enabled for UDP proxy support');

            // Optional: Override RTCPeerConnection to log connections for debugging
            const OriginalRTCPeerConnection = window.RTCPeerConnection;
            window.RTCPeerConnection = new Proxy(OriginalRTCPeerConnection, {
                construct: function(target, args) {
                    console.log('WebRTC connection created with config:', args[0]);

                    // Create the original connection without modification
                    const pc = new target(...args);

                    // Log ICE candidates for debugging (to verify proxy routing)
                    const originalOnIceCandidate = pc.onicecandidate;
                    Object.defineProperty(pc, 'onicecandidate', {
                        get: function() {
                            return originalOnIceCandidate;
                        },
                        set: function(handler) {
                            originalOnIceCandidate = function(event) {
                                if (event.candidate) {
                                    console.log('ICE Candidate:', event.candidate.candidate);
                                    // Should show proxy IP if routing correctly
                                }
                                if (handler) handler(event);
                            };
                        }
                    });

                    return pc;
                }
            });

            if (window.mozRTCPeerConnection) {
                window.mozRTCPeerConnection = window.RTCPeerConnection;
            }
        })();
    `,



    metadata: {
        language: primaryLanguage,
        languages: sanitizedLanguages,
        mediaDevices: mediaDeviceLabels
    }
    };
}

// Browser history seeding functions with enhanced realism
async function seedBrowserHistory(page) {
    // Add IndexedDB databases for common sites
    await page.evaluateOnNewDocument(() => {
        // Simulate IndexedDB databases from popular sites
        const createDB = (name) => {
            try {
                const request = indexedDB.open(name, 1);
                request.onsuccess = () => request.result.close();
            } catch (e) {}
        };

        // Create fake databases
        setTimeout(() => {
            createDB('firebase-messaging-database');
            createDB('youtube-player-remote-connected-devices');
            createDB('__sak');
            createDB('_GPAC_cache');
            createDB('discord_cache');
        }, 1000);
    });

    // Add service worker registrations
    await page.evaluateOnNewDocument(() => {
        // Override serviceWorker.getRegistrations to show fake workers
        if ('serviceWorker' in navigator) {
            const originalGetRegistrations = navigator.serviceWorker.getRegistrations;
            navigator.serviceWorker.getRegistrations = function() {
                return originalGetRegistrations.call(this).then(registrations => {
                    // Add fake registrations
                    const fakeRegistrations = [
                        { scope: 'https://www.google.com/', active: { scriptURL: 'https://www.google.com/sw.js' }},
                        { scope: 'https://www.youtube.com/', active: { scriptURL: 'https://www.youtube.com/sw.js' }},
                        { scope: 'https://discord.com/', active: { scriptURL: 'https://discord.com/sw.js' }}
                    ];
                    return [...registrations, ...fakeRegistrations];
                });
            };
        }
    });

    // Popular sites that most users have visited
    const popularSites = [
        { url: 'https://www.google.com', title: 'Google' },
        { url: 'https://www.youtube.com', title: 'YouTube' },
        { url: 'https://www.facebook.com', title: 'Facebook' },
        { url: 'https://www.amazon.com', title: 'Amazon.com: Online Shopping' },
        { url: 'https://www.reddit.com', title: 'Reddit - Dive into anything' },
        { url: 'https://www.twitter.com', title: 'Twitter' },
        { url: 'https://www.instagram.com', title: 'Instagram' },
        { url: 'https://www.netflix.com', title: 'Netflix' },
        { url: 'https://www.linkedin.com', title: 'LinkedIn' },
        { url: 'https://www.wikipedia.org', title: 'Wikipedia' },
        { url: 'https://www.github.com', title: 'GitHub' },
        { url: 'https://www.stackoverflow.com', title: 'Stack Overflow' },
        { url: 'https://www.twitch.tv', title: 'Twitch' },
        { url: 'https://www.spotify.com', title: 'Spotify' },
        { url: 'https://mail.google.com', title: 'Gmail' },
        { url: 'https://drive.google.com', title: 'Google Drive' },
        { url: 'https://docs.google.com', title: 'Google Docs' }
    ];

    // Add localStorage data for common sites
    await page.evaluateOnNewDocument(() => {
        // Simulate localStorage entries
        const storageData = {
            'google.com': {
                'theme': 'light',
                'lang': 'en',
                'last_visit': Date.now() - 86400000
            },
            'youtube.com': {
                'player_volume': '50',
                'quality': 'hd720',
                'theme': 'dark',
                'watch_later': '[]',
                'last_video': 'dQw4w9WgXcQ'
            },
            'reddit.com': {
                'compact_view': 'false',
                'night_mode': 'true',
                'nsfw_filter': 'true'
            },
            'twitter.com': {
                'theme': 'dim',
                'autoplay': 'false'
            }
        };

        // Override localStorage to include fake data
        const originalGetItem = Storage.prototype.getItem;
        const originalSetItem = Storage.prototype.setItem;

        Storage.prototype.getItem = function(key) {
            const domain = window.location.hostname;
            if (storageData[domain] && storageData[domain][key]) {
                return storageData[domain][key];
            }
            return originalGetItem.call(this, key);
        };
    });

    // Add fake cookies
    const cookies = [
        { name: 'NID', value: generateRandomString(178), domain: '.google.com', expires: Date.now() / 1000 + 15552000 },
        { name: '1P_JAR', value: `${new Date().getFullYear()}-${new Date().getMonth()}-${new Date().getDate()}-${Math.floor(Math.random() * 24)}`, domain: '.google.com' },
        { name: 'c_user', value: generateRandomString(15), domain: '.facebook.com' },
        { name: 'xs', value: generateRandomString(44), domain: '.facebook.com' },
        { name: 'session-token', value: generateRandomString(352), domain: '.amazon.com' },
        { name: 'reddit_session', value: generateRandomString(128), domain: '.reddit.com' },
        { name: 'auth_token', value: generateRandomString(40), domain: '.twitter.com' },
        { name: 'sessionid', value: generateRandomString(32), domain: '.instagram.com' }
    ];

    for (const cookie of cookies) {
        try {
            await page.setCookie({
                name: cookie.name,
                value: cookie.value,
                domain: cookie.domain,
                path: '/',
                expires: cookie.expires || Date.now() / 1000 + 86400,
                httpOnly: false,
                secure: true,
                sameSite: 'Lax'
            });
        } catch (e) {
            // Some cookies might fail due to domain restrictions
        }
    }
}

function generateRandomString(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Behavioral patterns simulation
async function addBehavioralPatterns(page) {
    // Simulate idle periods
    setInterval(async () => {
        if (Math.random() < 0.1) { // 10% chance of idle
            await new Promise(resolve => setTimeout(resolve, 5000 + Math.random() * 10000));
        }
    }, 30000);

    // Simulate tab switching
    await page.evaluateOnNewDocument(() => {
        let hidden = false;
        setInterval(() => {
            if (Math.random() < 0.05) { // 5% chance
                hidden = !hidden;
                Object.defineProperty(document, 'hidden', {
                    get: () => hidden,
                    configurable: true
                });
                Object.defineProperty(document, 'visibilityState', {
                    get: () => hidden ? 'hidden' : 'visible',
                    configurable: true
                });
                document.dispatchEvent(new Event('visibilitychange'));
            }
        }, 60000); // Check every minute
    });

    // Simulate text selection
    setInterval(async () => {
        if (Math.random() < 0.02) { // 2% chance
            await page.evaluate(() => {
                const elements = document.querySelectorAll('p, span, div');
                if (elements.length > 0) {
                    const element = elements[Math.floor(Math.random() * elements.length)];
                    const selection = window.getSelection();
                    const range = document.createRange();
                    range.selectNodeContents(element);
                    selection.removeAllRanges();
                    selection.addRange(range);
                    setTimeout(() => selection.removeAllRanges(), 1000 + Math.random() * 2000);
                }
            });
        }
    }, 20000);

    // Simulate zoom changes
    setInterval(async () => {
        if (Math.random() < 0.01) { // 1% chance
            const zoomLevel = [0.9, 1.0, 1.1, 1.25][Math.floor(Math.random() * 4)];
            await page.evaluate((zoom) => {
                document.body.style.zoom = zoom;
            }, zoomLevel);
        }
    }, 120000); // Every 2 minutes
}

// Export all stealth functions
module.exports = {
    getStealthScripts,
    seedBrowserHistory,
    addBehavioralPatterns
};











