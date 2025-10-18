// Launcher UI JavaScript
document.addEventListener('DOMContentLoaded', async () => {
    // Elements
    const tokenInput = document.getElementById('token');
    const enableProxyCheckbox = document.getElementById('enableProxy');
    const proxyFields = document.getElementById('proxyFields');
    const proxyString = document.getElementById('proxyString');
    const proxyProtocol = document.getElementById('proxyProtocol');
    const proxyHost = document.getElementById('proxyHost');
    const proxyPort = document.getElementById('proxyPort');
    const proxyUsername = document.getElementById('proxyUsername');
    const proxyPassword = document.getElementById('proxyPassword');
    const autoLoginCheckbox = document.getElementById('autoLogin');
    const clearCacheCheckbox = document.getElementById('clearCache');
    const randomUserAgentCheckbox = document.getElementById('randomUserAgent');
    const blockWebRTCCheckbox = document.getElementById('blockWebRTC');
    const launchBtn = document.getElementById('launchBtn');
    const saveBtn = document.getElementById('saveSettingsBtn');
    const errorMessage = document.getElementById('statusMessage');
    const successMessage = document.getElementById('successMessage');
    const loading = document.getElementById('loading');
    const checkTokenBtn = document.getElementById('checkTokenBtn');
    const tokenStatus = document.getElementById('tokenStatus');
    const tokenStatusText = document.getElementById('tokenStatusText');

    // Load saved settings
    async function loadSettings() {
        try {
            const settings = await window.api.getSettings();

            // Load token
            if (settings.token) {
                tokenInput.value = settings.token;
            }

            // Load proxy settings
            if (settings.proxy) {
                enableProxyCheckbox.checked = settings.proxy.enabled;
                proxyProtocol.value = settings.proxy.protocol || 'http';
                proxyHost.value = settings.proxy.host || '';
                proxyPort.value = settings.proxy.port || '';
                proxyUsername.value = settings.proxy.username || '';
                proxyPassword.value = settings.proxy.password || '';

                if (settings.proxy.enabled) {
                    proxyFields.classList.add('active');
                }
            }

            // Load preferences
            if (settings.preferences) {
                autoLoginCheckbox.checked = settings.preferences.autoLogin !== false;
                clearCacheCheckbox.checked = settings.preferences.clearCacheOnExit !== false;
                randomUserAgentCheckbox.checked = settings.preferences.randomUserAgent !== false;
                blockWebRTCCheckbox.checked = settings.preferences.blockWebRTC !== false;
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    }

    // Parse single-line proxy string
    function parseProxyString(str) {
        if (!str) return null;

        // Support multiple formats:
        // 1. host:port
        // 2. host:port:username:password
        // 3. protocol://host:port
        // 4. protocol://username:password@host:port

        str = str.trim();

        // Check if it starts with protocol
        let protocol = 'socks5'; // default
        if (str.startsWith('http://')) {
            protocol = 'http';
            str = str.substring(7);
        } else if (str.startsWith('https://')) {
            protocol = 'https';
            str = str.substring(8);
        } else if (str.startsWith('socks5://')) {
            protocol = 'socks5';
            str = str.substring(9);
        }

        // Check for username:password@ format
        let username = '';
        let password = '';
        const atIndex = str.lastIndexOf('@');
        if (atIndex > 0) {
            const auth = str.substring(0, atIndex);
            str = str.substring(atIndex + 1);
            const colonIndex = auth.indexOf(':');
            if (colonIndex > 0) {
                username = auth.substring(0, colonIndex);
                password = auth.substring(colonIndex + 1);
            }
        }

        // Split remaining string by colons
        const parts = str.split(':');

        if (parts.length >= 2) {
            // At minimum we have host:port
            const host = parts[0];
            const port = parseInt(parts[1]);

            // Check if there are additional parts for username:password
            if (!username && parts.length >= 4) {
                username = parts[2];
                password = parts.slice(3).join(':'); // Join remaining parts as password (in case password contains :)
            }

            return {
                protocol,
                host,
                port: isNaN(port) ? 8080 : port,
                username,
                password
            };
        }

        return null;
    }

    // Handle proxy string input
    if (proxyString) {
        proxyString.addEventListener('input', () => {
            const parsed = parseProxyString(proxyString.value);
            if (parsed) {
                proxyProtocol.value = parsed.protocol;
                proxyHost.value = parsed.host;
                proxyPort.value = parsed.port;
                proxyUsername.value = parsed.username;
                proxyPassword.value = parsed.password;
            }
        });

        // Also handle paste events for immediate parsing
        proxyString.addEventListener('paste', (e) => {
            setTimeout(() => {
                const parsed = parseProxyString(proxyString.value);
                if (parsed) {
                    proxyProtocol.value = parsed.protocol;
                    proxyHost.value = parsed.host;
                    proxyPort.value = parsed.port;
                    proxyUsername.value = parsed.username;
                    proxyPassword.value = parsed.password;
                }
            }, 10);
        });
    }

    // Update proxy string when individual fields change
    function updateProxyString() {
        if (!proxyString) return;

        const host = proxyHost.value.trim();
        const port = proxyPort.value;
        const username = proxyUsername.value.trim();
        const password = proxyPassword.value;

        if (!host) {
            proxyString.value = '';
            return;
        }

        // Build proxy string
        let str = '';
        if (username && password) {
            str = `${host}:${port}:${username}:${password}`;
        } else {
            str = `${host}:${port}`;
        }

        proxyString.value = str;
    }

    // Add listeners to individual proxy fields to update proxy string
    [proxyHost, proxyPort, proxyUsername, proxyPassword].forEach(field => {
        if (field) {
            field.addEventListener('input', updateProxyString);
        }
    });

    // Show/hide proxy fields
    enableProxyCheckbox.addEventListener('change', () => {
        if (enableProxyCheckbox.checked) {
            proxyFields.classList.add('active');
        } else {
            proxyFields.classList.remove('active');
        }
    });

    // Show message
    function showMessage(element, message, duration = 3000) {
        element.textContent = message;
        element.classList.add('active');
        setTimeout(() => {
            element.classList.remove('active');
        }, duration);
    }

    // Validate proxy settings
    function validateProxySettings() {
        if (enableProxyCheckbox.checked) {
            if (!proxyHost.value.trim()) {
                showMessage(errorMessage, 'Please enter a proxy host');
                return false;
            }
            if (!proxyPort.value || proxyPort.value < 1 || proxyPort.value > 65535) {
                showMessage(errorMessage, 'Please enter a valid port (1-65535)');
                return false;
            }
        }
        return true;
    }

    // Save settings
    saveBtn.addEventListener('click', async () => {
        if (!validateProxySettings()) return;

        const settings = {
            token: tokenInput.value.trim(),
            proxy: {
                enabled: enableProxyCheckbox.checked,
                protocol: proxyProtocol.value,
                host: proxyHost.value.trim(),
                port: parseInt(proxyPort.value) || 8080,
                username: proxyUsername.value.trim(),
                password: proxyPassword.value
            },
            preferences: {
                autoLogin: autoLoginCheckbox.checked,
                clearCacheOnExit: clearCacheCheckbox.checked,
                randomUserAgent: randomUserAgentCheckbox.checked,
                blockWebRTC: blockWebRTCCheckbox.checked
            }
        };

        try {
            const result = await window.api.saveSettings(settings);
            if (result.success) {
                showMessage(successMessage, 'Settings saved successfully!');
            } else {
                showMessage(errorMessage, 'Failed to save settings: ' + result.error);
            }
        } catch (error) {
            showMessage(errorMessage, 'Failed to save settings: ' + error.message);
        }
    });

    // Check Token button
    checkTokenBtn.addEventListener('click', async () => {
        const token = tokenInput.value.trim();

        if (!token) {
            tokenStatus.style.display = 'block';
            tokenStatus.style.background = 'rgba(239, 68, 68, 0.2)';
            tokenStatusText.style.color = '#fca5a5';
            tokenStatusText.textContent = '❌ Please enter a token to check';
            return;
        }

        // Show checking status
        checkTokenBtn.disabled = true;
        checkTokenBtn.textContent = 'Checking...';
        tokenStatus.style.display = 'block';
        tokenStatus.style.background = 'rgba(88, 101, 242, 0.2)';
        tokenStatusText.style.color = '#a8d8ea';
        tokenStatusText.textContent = '🔍 Validating token...';

        try {
            // Get current proxy settings
            const proxySettings = {
                enabled: enableProxyCheckbox.checked,
                protocol: proxyProtocol.value,
                host: proxyHost.value.trim(),
                port: parseInt(proxyPort.value) || 8080,
                username: proxyUsername.value.trim(),
                password: proxyPassword.value
            };

            const result = await window.api.checkToken(token, proxySettings);

            if (result.success) {
                tokenStatus.style.background = 'rgba(34, 197, 94, 0.2)';
                tokenStatusText.style.color = '#86efac';
                tokenStatusText.innerHTML = `
                    ✅ <strong>Token Valid!</strong><br>
                    👤 User: <strong>${result.fullUsername}</strong><br>
                    🆔 ID: ${result.id}<br>
                    ${result.email ? `📧 Email: ${result.email}<br>` : ''}
                    ${result.verified ? '✓ Verified Account' : '⚠️ Unverified Account'}
                `;
            } else {
                tokenStatus.style.background = 'rgba(239, 68, 68, 0.2)';
                tokenStatusText.style.color = '#fca5a5';
                tokenStatusText.textContent = `❌ ${result.error || 'Failed to validate token'}`;
            }
        } catch (error) {
            tokenStatus.style.background = 'rgba(239, 68, 68, 0.2)';
            tokenStatusText.style.color = '#fca5a5';
            tokenStatusText.textContent = `❌ Error: ${error.message}`;
        } finally {
            checkTokenBtn.disabled = false;
            checkTokenBtn.textContent = 'Check Token';
        }
    });

    // Launch Discord
    launchBtn.addEventListener('click', async () => {
        if (!validateProxySettings()) return;

        // Ensure we have a browser profile
        if (!currentBrowserProfile) {
            // Auto-create a default profile with current UI hardware values
            const hardwareProfile = getHardwareFromUI();
            hardwareProfile.name = 'Default Profile';
            currentBrowserProfile = await window.api.createBrowserProfile(
                `Default Profile`,
                hardwareProfile,
                blockWebRTCCheckbox.checked  // Pass WebRTC preference
            );
            await loadBrowserProfiles();
        }

        // Disable button and show loading
        launchBtn.disabled = true;
        loading.classList.add('active');
        errorMessage.classList.remove('active');
        successMessage.classList.remove('active');

        const options = {
            token: tokenInput.value.trim(),
            browserProfile: currentBrowserProfile,  // Pass the browser profile
            proxy: enableProxyCheckbox.checked ? {
                protocol: proxyProtocol.value,
                host: proxyHost.value.trim(),
                port: parseInt(proxyPort.value) || 8080,
                username: proxyUsername.value.trim(),
                password: proxyPassword.value
            } : null,
            preferences: {
                autoLogin: autoLoginCheckbox.checked,
                clearCacheOnExit: clearCacheCheckbox.checked,
                randomUserAgent: randomUserAgentCheckbox.checked,
                blockWebRTC: blockWebRTCCheckbox.checked
            },
            blockWebRTC: blockWebRTCCheckbox.checked  // Pass directly for DiscordBrowser
        };

        try {
            const result = await window.api.launchDiscord(options);

            if (result.success) {
                showMessage(successMessage, 'Discord launched successfully!');
                // Save settings after successful launch
                await window.api.saveSettings({
                    token: options.token,
                    proxy: {
                        enabled: enableProxyCheckbox.checked,
                        ...options.proxy
                    },
                    preferences: options.preferences
                });
            } else {
                showMessage(errorMessage, 'Failed to launch Discord: ' + result.error, 5000);
            }
        } catch (error) {
            showMessage(errorMessage, 'Failed to launch Discord: ' + error.message, 5000);
        } finally {
            loading.classList.remove('active');
            launchBtn.disabled = false;
        }
    });

    // Listen for Discord events
    window.api.onDiscordClosed(() => {
        showMessage(successMessage, 'Discord session closed');
        launchBtn.disabled = false;
    });

    window.api.onTokenUpdated((token) => {
        if (token && token !== tokenInput.value) {
            tokenInput.value = token;
            showMessage(successMessage, 'Token automatically updated');
        }
    });

    window.api.onProxyError((error) => {
        showMessage(errorMessage, 'Proxy error: ' + error, 5000);
    });

    // Browser Profile Management
    const browserProfileSelect = document.getElementById('browserProfileSelect');
    const profileTemplate = document.getElementById('profileTemplate');
    const newProfileBtn = document.getElementById('newProfileBtn');
    const deleteProfileBtn = document.getElementById('deleteProfileBtn');
    const exportProfileBtn = document.getElementById('exportProfileBtn');
    const importProfileBtn = document.getElementById('importProfileBtn');

    // Profile display elements
    const currentProfileInfo = document.getElementById('currentProfileInfo');
    const currentProfileName = document.getElementById('currentProfileName');
    const profileCreated = document.getElementById('profileCreated');
    const profileLastUsed = document.getElementById('profileLastUsed');
    const profileSize = document.getElementById('profileSize');
    const profileSessions = document.getElementById('profileSessions');

    const profileCores = document.getElementById('profileCores');
    const profileMemory = document.getElementById('profileMemory');
    const profileGPU = document.getElementById('profileGPU');
    const profileScreen = document.getElementById('profileScreen');
    const profileTimezone = document.getElementById('profileTimezone');
    const profileLanguage = document.getElementById('profileLanguage');

    let currentBrowserProfile = null;

    // Load all browser profiles
    async function loadBrowserProfiles() {
        try {
            const profiles = await window.api.getAllBrowserProfiles();
            const current = await window.api.getCurrentBrowserProfile();

            // Clear and populate dropdown
            browserProfileSelect.innerHTML = '<option value="">-- Create New Profile --</option>';

            Object.keys(profiles).forEach(id => {
                const profile = profiles[id];
                const option = document.createElement('option');
                option.value = id;
                option.textContent = `${profile.name} (${new Date(profile.lastUsed).toLocaleDateString()})`;
                if (current && current.id === id) {
                    option.selected = true;
                }
                browserProfileSelect.appendChild(option);
            });

            if (current) {
                await selectBrowserProfile(current.id);
            } else {
                currentProfileInfo.style.display = 'none';
            }
        } catch (error) {
            console.error('Failed to load browser profiles:', error);
        }
    }

    // Select a browser profile
    async function selectBrowserProfile(profileId) {
        if (!profileId) {
            currentBrowserProfile = null;
            currentProfileInfo.style.display = 'none';
            return;
        }

        try {
            const profile = await window.api.loadBrowserProfile(profileId);
            currentBrowserProfile = profile;

            // Update UI
            currentProfileInfo.style.display = 'block';
            currentProfileName.textContent = profile.name;
            profileCreated.textContent = new Date(profile.created).toLocaleDateString();
            profileLastUsed.textContent = new Date(profile.lastUsed).toLocaleDateString();
            profileSessions.textContent = profile.stats?.launches || 0;

            // Get profile size
            const stats = await window.api.getBrowserProfileStats(profileId);
            profileSize.textContent = stats.formattedSize || '-';

            // Update hardware display
            if (profile.hardware) {
                updateHardwareDisplay(profile.hardware);
            }
        } catch (error) {
            console.error('Failed to select profile:', error);
            showMessage(errorMessage, 'Failed to load profile: ' + error.message);
        }
    }

    // Update hardware display - COMPREHENSIVE
    function updateHardwareDisplay(profile) {
        if (!profile) return;

        const hardware = profile.hardware || {};
        const location = profile.location || {};

        // Update editable fields
        // CPU
        if (hardware.cpu) {
            document.getElementById('cpuModel').value = hardware.cpu;
        }
        if (hardware.cores) {
            document.getElementById('cpuCores').value = hardware.cores;
        }
        if (hardware.threads) {
            document.getElementById('cpuThreads').value = hardware.threads;
        }

        // GPU - EXACT vendor and renderer
        if (hardware.gpuVendor && hardware.gpuRenderer) {
            const gpuValue = hardware.gpuVendor + '|' + hardware.gpuRenderer;
            const gpuSelect = document.getElementById('gpuSelect');
            // Try to find matching option
            for (let i = 0; i < gpuSelect.options.length; i++) {
                if (gpuSelect.options[i].value === gpuValue) {
                    gpuSelect.selectedIndex = i;
                    break;
                }
            }
        }
        if (hardware.gpuVram !== undefined) {
            document.getElementById('gpuVram').value = hardware.gpuVram;
        }

        // RAM
        if (hardware.memory) {
            document.getElementById('ramSize').value = hardware.memory;
        }
        if (hardware.memorySpeed) {
            document.getElementById('ramSpeed').value = hardware.memorySpeed;
        }

        // Screen
        if (hardware.screen) {
            const screenRes = `${hardware.screen.width}x${hardware.screen.height}`;
            document.getElementById('screenResolution').value = screenRes;
            document.getElementById('screenWidth').value = hardware.screen.width;
            document.getElementById('screenHeight').value = hardware.screen.height;
            if (hardware.screen.refreshRate) {
                document.getElementById('screenRefresh').value = hardware.screen.refreshRate;
            }
        }

        // Audio
        if (hardware.audio) {
            document.getElementById('audioDevice').value = hardware.audio;
        }

        // Network
        if (hardware.network) {
            document.getElementById('networkAdapter').value = hardware.network;
        }

        // OS
        if (hardware.os && hardware.osVersion) {
            const osValue = hardware.os + '|' + hardware.osVersion;
            document.getElementById('osVersion').value = osValue;
        }

        // Location
        if (location.timezone) {
            const timezoneValue = `${location.timezone}|${location.timezoneOffset || 0}|${location.language || 'en-US'}`;
            const timezoneSelect = document.getElementById('timezone');
            for (let i = 0; i < timezoneSelect.options.length; i++) {
                if (timezoneSelect.options[i].value.startsWith(location.timezone)) {
                    timezoneSelect.selectedIndex = i;
                    break;
                }
            }
        }

        // Also update the old display fields for backward compatibility
        if (profileCores) profileCores.textContent = hardware.cores || 8;
        if (profileMemory) profileMemory.textContent = hardware.memory || 16;
        if (profileGPU) {
            // Show exact GPU model
            profileGPU.textContent = hardware.gpuRenderer || hardware.gpu || 'Unknown';
        }
        if (profileScreen) {
            profileScreen.textContent = `${hardware.screen?.width || 1920}x${hardware.screen?.height || 1080}`;
        }
        if (profileTimezone) profileTimezone.textContent = location.timezone || 'America/New_York';
        if (profileLanguage) profileLanguage.textContent = location.language || 'en-US';
    }

    // Collect hardware profile from UI
    function getHardwareFromUI() {
        // Get GPU from input field
        const gpuModel = document.getElementById('gpuModel').value || 'NVIDIA GeForce RTX 3060';
        let gpuVendor = 'NVIDIA Corporation';
        let gpuRenderer = gpuModel;

        if (gpuModel.includes('NVIDIA')) {
            gpuVendor = 'NVIDIA Corporation';
        } else if (gpuModel.includes('AMD')) {
            gpuVendor = 'ATI Technologies Inc.';
        } else if (gpuModel.includes('Intel')) {
            gpuVendor = 'Intel Inc.';
        }

        // Get screen resolution from select
        const screenRes = document.getElementById('screenRes').value || '1920x1080';
        const [screenWidth, screenHeight] = screenRes.split('x').map(v => parseInt(v));

        // Get timezone data
        const timezone = document.getElementById('timezone').value || 'America/New_York';
        const timezoneOffset = 300; // Will calculate based on timezone
        const language = document.getElementById('language').value || 'en-US';

        // Fixed OS data for Windows 10
        const osName = 'Windows 10';
        const osVersion = '10.0.19045';

        // Get languages array for a language
        const getLanguages = (lang) => {
            const languageSets = {
                'en-US': ['en-US', 'en'],
                'en-GB': ['en-GB', 'en'],
                'fr-FR': ['fr-FR', 'fr', 'en-US', 'en'],
                'de-DE': ['de-DE', 'de', 'en-US', 'en'],
                'ja-JP': ['ja-JP', 'ja', 'en-US', 'en'],
                'en-AU': ['en-AU', 'en'],
                'en-CA': ['en-CA', 'en']
            };
            return languageSets[lang] || ['en-US', 'en'];
        };

        // Build complete hardware profile
        return {
            name: 'Custom Profile',
            hardware: {
                cpu: document.getElementById('cpuModel').value || 'Intel Core i7-10700K',
                cores: parseInt(document.getElementById('cpuCores').value) || 8,
                threads: parseInt(document.getElementById('cpuCores').value) * 2 || 16,
                memory: parseInt(document.getElementById('ramSize').value) || 16,
                memorySpeed: 3200,
                memoryType: 'DDR4',
                gpuVendor: gpuVendor,
                gpuRenderer: gpuRenderer,
                gpuVram: 8, // Default VRAM
                screen: {
                    width: screenWidth,
                    height: screenHeight,
                    colorDepth: 24,
                    pixelDepth: 24,
                    refreshRate: parseInt(document.getElementById('screenRefresh').value) || 60
                },
                audio: document.getElementById('audioDevice').value || 'Realtek High Definition Audio',
                network: document.getElementById('networkAdapter').value || 'Intel(R) Wi-Fi 6 AX200',
                os: osName,
                osVersion: osVersion
            },
            location: {
                timezone: timezone,
                timezoneOffset: timezoneOffset,
                language: language,
                languages: getLanguages(language),
                locale: language
            }
        };
    }

    // Update hardware profile for current browser profile
    window.updateHardwareProfile = async function() {
        if (!currentBrowserProfile) {
            showMessage(errorMessage, 'No browser profile selected. Create or select a profile first.');
            return;
        }

        try {
            // Get hardware from UI
            const hardwareProfile = getHardwareFromUI();

            // Update the hardware profile manager
            await window.api.setCurrentHardwareProfile(hardwareProfile);

            // Update the browser profile's hardware
            currentBrowserProfile.hardware = hardwareProfile;

            // Save the updated browser profile
            await window.api.updateBrowserProfile(currentBrowserProfile.id, currentBrowserProfile);

            showMessage(successMessage, 'Hardware profile updated successfully!');

            // Reload profiles to show updated info
            await loadBrowserProfiles();
        } catch (error) {
            showMessage(errorMessage, 'Failed to update hardware: ' + error.message);
        }
    };

    // Browser profile selector change
    browserProfileSelect.addEventListener('change', async () => {
        await selectBrowserProfile(browserProfileSelect.value);
    });

    // Create new profile
    newProfileBtn.addEventListener('click', async () => {
        const profileName = prompt('Enter profile name:');
        if (!profileName) return;

        try {
            newProfileBtn.disabled = true;
            newProfileBtn.textContent = 'Creating...';

            // Use the current UI hardware values instead of random generation
            const hardwareProfile = getHardwareFromUI();
            hardwareProfile.name = profileName;

            // Create browser profile with the UI hardware and WebRTC preference
            const profile = await window.api.createBrowserProfile(
                profileName,
                hardwareProfile,
                blockWebRTCCheckbox.checked
            );

            if (profile) {
                showMessage(successMessage, `Created profile: ${profileName}`);
                await loadBrowserProfiles();
                browserProfileSelect.value = profile.id;
                await selectBrowserProfile(profile.id);
            }
        } catch (error) {
            showMessage(errorMessage, 'Failed to create profile: ' + error.message);
        } finally {
            newProfileBtn.disabled = false;
            newProfileBtn.textContent = 'New Profile';
        }
    });

    // Delete profile
    deleteProfileBtn.addEventListener('click', async () => {
        if (!currentBrowserProfile) {
            showMessage(errorMessage, 'No profile selected');
            return;
        }

        if (!confirm(`Delete profile "${currentBrowserProfile.name}"? This will delete all browser data including cookies, passwords, and extensions.`)) {
            return;
        }

        try {
            await window.api.deleteBrowserProfile(currentBrowserProfile.id);
            showMessage(successMessage, 'Profile deleted');
            await loadBrowserProfiles();
        } catch (error) {
            showMessage(errorMessage, 'Failed to delete profile: ' + error.message);
        }
    });

    // Export profile
    exportProfileBtn.addEventListener('click', async () => {
        if (!currentBrowserProfile) {
            showMessage(errorMessage, 'No profile selected');
            return;
        }

        try {
            const result = await window.api.exportBrowserProfile(currentBrowserProfile.id);
            if (result.success) {
                showMessage(successMessage, `Profile exported to: ${result.path}`);
            }
        } catch (error) {
            showMessage(errorMessage, 'Failed to export profile: ' + error.message);
        }
    });

    // Import profile
    importProfileBtn.addEventListener('click', async () => {
        try {
            const result = await window.api.importBrowserProfile();
            if (result.success) {
                showMessage(successMessage, 'Profile imported successfully');
                await loadBrowserProfiles();
                browserProfileSelect.value = result.profileId;
                await selectBrowserProfile(result.profileId);
            }
        } catch (error) {
            showMessage(errorMessage, 'Failed to import profile: ' + error.message);
        }
    });

    // Initialize
    await loadSettings();
    await loadBrowserProfiles();

    // Auto-launch if configured
    if (autoLoginCheckbox.checked && tokenInput.value) {
        setTimeout(() => {
            launchBtn.click();
        }, 500);
    }
});

// Global randomization functions for hardware settings
function randomizeUserAgent() {
    const userAgentSelect = document.getElementById('userAgentSelect');
    const agents = ['chrome120', 'chrome121', 'chrome122', 'firefox121', 'edge120'];
    userAgentSelect.value = agents[Math.floor(Math.random() * agents.length)];
}

function randomizeCPU() {
    const cpuModel = document.getElementById('cpuModel');
    const cpus = [
        'Intel Core i7-10700K',
        'Intel Core i5-10400F',
        'Intel Core i9-9900K',
        'AMD Ryzen 5 5600X',
        'AMD Ryzen 7 5800X',
        'Intel Core i7-11700K',
        'AMD Ryzen 9 5900X',
        'Intel Core i5-11400F'
    ];
    cpuModel.value = cpus[Math.floor(Math.random() * cpus.length)];
}

function randomizeCores() {
    const cpuCores = document.getElementById('cpuCores');
    const cores = [4, 6, 8, 12, 16];
    cpuCores.value = cores[Math.floor(Math.random() * cores.length)];
}

function randomizeGPU() {
    const gpuModel = document.getElementById('gpuModel');
    const gpus = [
        'NVIDIA GeForce RTX 3060',
        'NVIDIA GeForce GTX 1660 Super',
        'NVIDIA GeForce RTX 3070',
        'NVIDIA GeForce RTX 2060',
        'AMD Radeon RX 6600',
        'NVIDIA GeForce GTX 1650',
        'AMD Radeon RX 5700 XT',
        'NVIDIA GeForce RTX 3080'
    ];
    gpuModel.value = gpus[Math.floor(Math.random() * gpus.length)];
}

function randomizeRAM() {
    const ramSize = document.getElementById('ramSize');
    const sizes = ['8', '16', '32'];
    ramSize.value = sizes[Math.floor(Math.random() * sizes.length)];
}

function randomizeScreen() {
    const screenRes = document.getElementById('screenRes');
    const resolutions = ['1920x1080', '2560x1440', '1366x768', '1600x900'];
    screenRes.value = resolutions[Math.floor(Math.random() * resolutions.length)];
}

function randomizeTimezone() {
    const timezone = document.getElementById('timezone');
    const timezones = [
        'America/New_York',
        'America/Chicago',
        'America/Los_Angeles',
        'Europe/London',
        'Europe/Berlin'
    ];
    timezone.value = timezones[Math.floor(Math.random() * timezones.length)];
}

function randomizeLanguage() {
    const language = document.getElementById('language');
    const languages = ['en-US', 'en-GB', 'de-DE', 'fr-FR', 'es-ES'];
    language.value = languages[Math.floor(Math.random() * languages.length)];
}

async function updateHardwareProfile() {
    const hardwareProfile = getHardwareFromUI();

    // Get current browser profile
    const browserProfileSelect = document.getElementById('profileSelect');
    const currentProfileId = browserProfileSelect.value || 'default';

    // Save hardware profile
    await window.api.saveSetting('hardwareProfile', hardwareProfile);

    const successMessage = document.getElementById('successMessage');
    showMessage(successMessage, 'Hardware profile saved successfully');
}

function showMessage(element, message, duration = 3000) {
    if (!element) return;
    element.textContent = message;
    element.classList.add('active');
    setTimeout(() => {
        element.classList.remove('active');
    }, duration);
}