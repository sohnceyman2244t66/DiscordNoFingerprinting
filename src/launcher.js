// Launcher UI JavaScript
document.addEventListener('DOMContentLoaded', async () => {
    // Elements
    const tokenInput = document.getElementById('token');
    const enableProxyCheckbox = document.getElementById('enableProxy');
    const proxyFields = document.getElementById('proxyFields');
    const proxyProtocol = document.getElementById('proxyProtocol');
    const proxyHost = document.getElementById('proxyHost');
    const proxyPort = document.getElementById('proxyPort');
    const proxyUsername = document.getElementById('proxyUsername');
    const proxyPassword = document.getElementById('proxyPassword');
    const autoLoginCheckbox = document.getElementById('autoLogin');
    const clearCacheCheckbox = document.getElementById('clearCache');
    const randomUserAgentCheckbox = document.getElementById('randomUserAgent');
    const launchBtn = document.getElementById('launchBtn');
    const saveBtn = document.getElementById('saveBtn');
    const errorMessage = document.getElementById('errorMessage');
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
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    }

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
                randomUserAgent: randomUserAgentCheckbox.checked
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

        // Disable button and show loading
        launchBtn.disabled = true;
        loading.classList.add('active');
        errorMessage.classList.remove('active');
        successMessage.classList.remove('active');

        const options = {
            token: tokenInput.value.trim(),
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
                randomUserAgent: randomUserAgentCheckbox.checked
            }
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

    // Initialize
    await loadSettings();

    // Auto-launch if configured
    if (autoLoginCheckbox.checked && tokenInput.value) {
        setTimeout(() => {
            launchBtn.click();
        }, 500);
    }
});