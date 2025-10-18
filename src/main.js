const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { DiscordBrowser } = require('./discord-browser');
const fs = require('fs');
const util = require('util');

// Create logs directory
const logsDir = path.join(app.getPath('userData'), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Create log file with timestamp
const logFile = path.join(logsDir, `launcher-${new Date().toISOString().split('T')[0]}.log`);
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

// Custom console log that writes to file and console
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

function writeLog(level, ...args) {
  const timestamp = new Date().toISOString();
  const message = args.map(arg =>
    typeof arg === 'object' ? util.inspect(arg, { depth: 3 }) : String(arg)
  ).join(' ');

  const logEntry = `[${timestamp}] [${level}] ${message}\n`;
  logStream.write(logEntry);

  // Send to console window if it exists
  if (consoleWindow && !consoleWindow.isDestroyed()) {
    consoleWindow.webContents.send('console-log', { level, message, timestamp });
  }

  // Also send to main window for display in UI console
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('console-log', { level, message, timestamp });
  }
}

console.log = (...args) => {
  originalConsoleLog.apply(console, args);
  writeLog('INFO', ...args);
};

console.error = (...args) => {
  originalConsoleError.apply(console, args);
  writeLog('ERROR', ...args);
};

console.warn = (...args) => {
  originalConsoleWarn.apply(console, args);
  writeLog('WARN', ...args);
};

// Catch unhandled errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  dialog.showErrorBox('Uncaught Exception', error.message);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Initialize secure storage for tokens
const store = new Store({
  encryptionKey: 'discord-secure-launcher-2024',
  schema: {
    discordToken: {
      type: 'string',
      default: ''
    },
    proxySettings: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean' },
        protocol: { type: 'string' },
        host: { type: 'string' },
        port: { type: 'number' },
        username: { type: 'string' },
        password: { type: 'string' }
      },
      default: {
        enabled: false,
        protocol: 'http',
        host: '',
        port: 8080,
        username: '',
        password: ''
      }
    },
    userPreferences: {
      type: 'object',
      properties: {
        autoLogin: { type: 'boolean' },
        minimizeToTray: { type: 'boolean' },
        clearCacheOnExit: { type: 'boolean' }
      },
      default: {
        autoLogin: false,
        minimizeToTray: true,
        clearCacheOnExit: true
      }
    }
  }
});

let mainWindow;
let discordBrowser;
let consoleWindow = null;

function createWindow() {
  console.log('Creating main window...');

  // Create the browser window
  const windowConfig = {
    width: 800,
    height: 900,
    resizable: true, // Made resizable for better debugging
    frame: true,
    transparent: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      devTools: true // Enable dev tools
    },
    title: 'Discord Secure Launcher',
    backgroundColor: '#2c2f33'
  };

  // Add icon only if it exists
  const iconPath = path.join(__dirname, '..', 'assets', 'icon.png');
  if (fs.existsSync(iconPath)) {
    windowConfig.icon = iconPath;
  }

  mainWindow = new BrowserWindow(windowConfig);

  // Create application menu with developer options
  const menuTemplate = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Log File',
          click: () => {
            require('electron').shell.openPath(logFile);
          }
        },
        {
          label: 'Open Logs Folder',
          click: () => {
            require('electron').shell.openPath(logsDir);
          }
        },
        {
          label: 'Open Plugins Folder',
          click: () => {
            const appPath = app.isPackaged
              ? path.dirname(process.execPath)
              : process.cwd();
            const pluginsDir = path.join(appPath, 'plugins');

            // Create if doesn't exist
            if (!fs.existsSync(pluginsDir)) {
              fs.mkdirSync(pluginsDir, { recursive: true });
            }

            require('electron').shell.openPath(pluginsDir);
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Developer',
      submenu: [
        {
          label: 'Toggle DevTools',
          accelerator: 'F12',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.toggleDevTools();
            }
          }
        },
        {
          label: 'Open Console Window',
          accelerator: 'CmdOrCtrl+Shift+C',
          click: () => {
            createConsoleWindow();
          }
        },
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.reload();
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Clear Cache',
          click: async () => {
            try {
              const session = mainWindow.webContents.session;
              await session.clearCache();
              console.log('Cache cleared');
            } catch (error) {
              console.error('Failed to clear cache:', error);
            }
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  // Load the launcher UI
  mainWindow.loadFile(path.join(__dirname, 'launcher.html'));

  // Log when page loads
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Main window loaded successfully');
  });

  // Log navigation events
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    console.log('Main window closed');
    mainWindow = null;
    if (discordBrowser) {
      discordBrowser.close();
    }
    if (consoleWindow && !consoleWindow.isDestroyed()) {
      consoleWindow.close();
    }
  });

  // Open DevTools in development or if error occurs
  if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

function createConsoleWindow() {
  if (consoleWindow && !consoleWindow.isDestroyed()) {
    consoleWindow.focus();
    return;
  }

  consoleWindow = new BrowserWindow({
    width: 800,
    height: 600,
    title: 'Console Output',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  consoleWindow.loadFile(path.join(__dirname, 'console.html'));

  // Send existing console history to new console window
  consoleWindow.webContents.on('did-finish-load', () => {
    // Read recent log entries from file
    try {
      const logContent = fs.readFileSync(logFile, 'utf-8');
      const lines = logContent.split('\n').slice(-100); // Last 100 lines
      lines.forEach(line => {
        if (line.trim()) {
          const match = line.match(/\[(.*?)\] \[(.*?)\] (.*)/);
          if (match) {
            consoleWindow.webContents.send('console-log', {
              timestamp: match[1],
              level: match[2],
              message: match[3]
            });
          }
        }
      });
    } catch (error) {
      console.error('Failed to read log history:', error);
    }
  });

  consoleWindow.on('closed', () => {
    consoleWindow = null;
  });
}

// IPC Handlers
ipcMain.handle('get-settings', async () => {
  return {
    token: store.get('discordToken', ''),
    proxy: store.get('proxySettings'),
    preferences: store.get('userPreferences')
  };
});

ipcMain.handle('save-settings', async (event, settings) => {
  try {
    if (settings.token !== undefined) {
      store.set('discordToken', settings.token);
    }
    if (settings.proxy !== undefined) {
      store.set('proxySettings', settings.proxy);
    }
    if (settings.preferences !== undefined) {
      store.set('userPreferences', settings.preferences);
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('launch-discord', async (event, options) => {
  try {
    console.log('Launching Discord with options:', {
      hasToken: !!options.token,
      proxyEnabled: !!options.proxy,
      userAgent: options.userAgent || 'random'
    });

    // Close existing browser if any
    if (discordBrowser) {
      console.log('Closing existing Discord browser instance');
      try {
        await discordBrowser.close();
      } catch (e) {
        console.log('Browser already closed or errored:', e.message);
      }
      discordBrowser = null; // Always clear the reference
    }

    // Create new Discord browser instance
    const browserOptions = {
      proxy: options.proxy,
      token: options.token,
      userAgent: options.userAgent || generateRandomUserAgent()
    };

    console.log('Creating new Discord browser instance');
    discordBrowser = new DiscordBrowser(browserOptions);

    // Launch Discord
    console.log('Launching Discord browser...');
    const result = await discordBrowser.launch();

    if (result.success) {
      console.log('Discord launched successfully');

      // Hide launcher window
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.hide();
      }

      // Monitor for Discord window closure
      discordBrowser.on('closed', () => {
        console.log('Discord browser closed');
        discordBrowser = null; // Clear the reference when browser closes
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.show();
        }
      });

      // Extract and save new token if available
      discordBrowser.on('token-updated', (newToken) => {
        console.log('Token updated, saving...');
        store.set('discordToken', newToken);
      });

      // Monitor for errors
      discordBrowser.on('error', (error) => {
        console.error('Discord browser error:', error);
      });
    } else {
      console.error('Failed to launch Discord:', result.error);
    }

    return result;
  } catch (error) {
    console.error('Failed to launch Discord:', error);
    console.error('Stack trace:', error.stack);
    return { success: false, error: error.message, stack: error.stack };
  }
});

ipcMain.handle('close-discord', async () => {
  if (discordBrowser) {
    await discordBrowser.close();
    discordBrowser = null;
  }
  return { success: true };
});

ipcMain.handle('check-token', async (event, token, proxySettings) => {
  try {
    console.log('Checking Discord token...');

    if (!token) {
      return { success: false, error: 'No token provided' };
    }

    // Get proxy settings if not provided
    if (!proxySettings) {
      proxySettings = store.get('proxySettings');
    }

    const fetch = require('node-fetch');
    const { HttpsProxyAgent } = require('https-proxy-agent');
    const { SocksProxyAgent } = require('socks-proxy-agent');

    // Set up fetch options
    const fetchOptions = {
      method: 'GET',
      headers: {
        'Authorization': token.startsWith('Bot ') ? token : token,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    };

    // Add proxy agent if configured
    if (proxySettings && proxySettings.enabled && proxySettings.host) {
      console.log('Using proxy for token check:', proxySettings.host);

      let proxyUrl;
      if (proxySettings.username && proxySettings.password) {
        proxyUrl = `${proxySettings.protocol}://${encodeURIComponent(proxySettings.username)}:${encodeURIComponent(proxySettings.password)}@${proxySettings.host}:${proxySettings.port}`;
      } else {
        proxyUrl = `${proxySettings.protocol}://${proxySettings.host}:${proxySettings.port}`;
      }

      // Use appropriate agent based on protocol
      if (proxySettings.protocol.startsWith('socks')) {
        fetchOptions.agent = new SocksProxyAgent(proxyUrl);
      } else {
        fetchOptions.agent = new HttpsProxyAgent(proxyUrl);
      }
    }

    // Make the request
    const response = await fetch('https://discord.com/api/v10/users/@me', fetchOptions);
    const data = await response.json();

    if (response.ok) {
      const username = data.global_name || data.username || 'Unknown User';
      const discriminator = data.discriminator && data.discriminator !== '0' ? `#${data.discriminator}` : '';

      console.log(`Token valid! User: ${username}${discriminator}`);
      console.log('User data:', data);

      return {
        success: true,
        username: username,
        discriminator: discriminator,
        fullUsername: `${username}${discriminator}`,
        id: data.id,
        avatar: data.avatar,
        email: data.email,
        verified: data.verified,
        locale: data.locale,
        mfa_enabled: data.mfa_enabled,
        premium_type: data.premium_type
      };
    } else if (response.status === 401) {
      return { success: false, error: 'Invalid or expired token' };
    } else {
      console.error('Discord API error:', response.status, data);
      return { success: false, error: `API error: ${response.status}` };
    }
  } catch (error) {
    console.error('Failed to check token:', error);
    return { success: false, error: error.message };
  }
});

// Hardware Profile Management IPC Handlers
const hardwareProfileManager = require('./hardware-profiles');
const browserProfileManager = require('./browser-profiles');

// Hardware profiles
ipcMain.handle('get-current-profile', async () => {
  try {
    return hardwareProfileManager.getCurrentProfile();
  } catch (error) {
    console.error('Failed to get current profile:', error);
    throw error;
  }
});

ipcMain.handle('set-current-profile', async (event, profile) => {
  try {
    return hardwareProfileManager.setCurrentProfile(profile);
  } catch (error) {
    console.error('Failed to set current profile:', error);
    throw error;
  }
});

ipcMain.handle('set-current-hardware-profile', async (event, profile) => {
  try {
    return hardwareProfileManager.setCurrentProfile(profile);
  } catch (error) {
    console.error('Failed to set current hardware profile:', error);
    throw error;
  }
});

ipcMain.handle('generate-profile', async (event, template) => {
  try {
    const profile = hardwareProfileManager.generateProfile(template);
    hardwareProfileManager.setCurrentProfile(profile);
    return profile;
  } catch (error) {
    console.error('Failed to generate profile:', error);
    throw error;
  }
});

ipcMain.handle('generate-hardware-profile', async (event, template) => {
  try {
    return hardwareProfileManager.generateProfile(template);
  } catch (error) {
    console.error('Failed to generate hardware profile:', error);
    throw error;
  }
});

ipcMain.handle('save-profile', async (event, profile) => {
  try {
    return hardwareProfileManager.saveProfile(profile);
  } catch (error) {
    console.error('Failed to save profile:', error);
    throw error;
  }
});

ipcMain.handle('load-profile', async (event, id) => {
  try {
    return hardwareProfileManager.loadProfile(id);
  } catch (error) {
    console.error('Failed to load profile:', error);
    throw error;
  }
});

ipcMain.handle('get-all-profiles', async () => {
  try {
    return hardwareProfileManager.getAllProfiles();
  } catch (error) {
    console.error('Failed to get all profiles:', error);
    throw error;
  }
});

ipcMain.handle('delete-profile', async (event, id) => {
  try {
    return hardwareProfileManager.deleteProfile(id);
  } catch (error) {
    console.error('Failed to delete profile:', error);
    throw error;
  }
});

// Browser Profile Management IPC Handlers
ipcMain.handle('create-browser-profile', async (event, name, hardwareProfile, blockWebRTC) => {
  try {
    return await browserProfileManager.createProfile(name, hardwareProfile, blockWebRTC);
  } catch (error) {
    console.error('Failed to create browser profile:', error);
    throw error;
  }
});

ipcMain.handle('load-browser-profile', async (event, id) => {
  try {
    return await browserProfileManager.loadProfile(id);
  } catch (error) {
    console.error('Failed to load browser profile:', error);
    throw error;
  }
});

ipcMain.handle('update-browser-profile', async (event, id, profile) => {
  try {
    // Update the profile's hardware and location
    const existingProfile = await browserProfileManager.loadProfile(id);
    if (existingProfile) {
      existingProfile.hardware = profile.hardware || existingProfile.hardware;
      existingProfile.location = profile.location || existingProfile.location;
      existingProfile.lastUsed = Date.now();

      // Save the updated profile back to the store
      const profiles = browserProfileManager.getAllProfiles();
      profiles[id] = existingProfile;
      browserProfileManager.store.set('profiles', profiles);

      // Also update the hardware profile manager
      if (profile.hardware) {
        hardwareProfileManager.setCurrentProfile(profile);
      }

      return existingProfile;
    }
    throw new Error('Profile not found');
  } catch (error) {
    console.error('Failed to update browser profile:', error);
    throw error;
  }
});

ipcMain.handle('get-all-browser-profiles', async () => {
  try {
    return browserProfileManager.getAllProfiles();
  } catch (error) {
    console.error('Failed to get all browser profiles:', error);
    throw error;
  }
});

ipcMain.handle('get-current-browser-profile', async () => {
  try {
    return browserProfileManager.getCurrentProfile();
  } catch (error) {
    console.error('Failed to get current browser profile:', error);
    throw error;
  }
});

ipcMain.handle('delete-browser-profile', async (event, id) => {
  try {
    await browserProfileManager.deleteProfile(id);
    return { success: true };
  } catch (error) {
    console.error('Failed to delete browser profile:', error);
    throw error;
  }
});

ipcMain.handle('get-browser-profile-stats', async (event, id) => {
  try {
    return await browserProfileManager.getProfileStats(id);
  } catch (error) {
    console.error('Failed to get browser profile stats:', error);
    throw error;
  }
});

ipcMain.handle('export-browser-profile', async (event, id) => {
  try {
    const { dialog } = require('electron');
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Browser Profile',
      defaultPath: `profile-export-${id}`,
      properties: ['createDirectory']
    });

    if (!result.canceled && result.filePath) {
      const exportPath = await browserProfileManager.exportProfile(id, path.dirname(result.filePath));
      return { success: true, path: exportPath };
    }
    return { success: false };
  } catch (error) {
    console.error('Failed to export browser profile:', error);
    throw error;
  }
});

ipcMain.handle('import-browser-profile', async () => {
  try {
    const { dialog } = require('electron');
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Import Browser Profile',
      properties: ['openDirectory']
    });

    if (!result.canceled && result.filePaths[0]) {
      const profile = await browserProfileManager.importProfile(result.filePaths[0]);
      return { success: true, profileId: profile.id };
    }
    return { success: false };
  } catch (error) {
    console.error('Failed to import browser profile:', error);
    throw error;
  }
});

// Generate random user agent for fingerprint protection
function generateRandomUserAgent() {
  const browsers = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36 Edge/118.0.0.0'
  ];
  return browsers[Math.floor(Math.random() * browsers.length)];
}

// App event handlers
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle certificate errors for proxy connections
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  event.preventDefault();
  callback(true);
});

// Clean up on exit
app.on('before-quit', async () => {
  console.log('Application is quitting...');

  if (discordBrowser) {
    console.log('Closing Discord browser...');
    await discordBrowser.close();
  }

  // Clear cache if enabled
  const preferences = store.get('userPreferences');
  if (preferences.clearCacheOnExit && mainWindow && !mainWindow.isDestroyed()) {
    try {
      console.log('Clearing cache before exit...');
      const session = mainWindow.webContents.session;
      await session.clearCache();
      console.log('Cache cleared successfully');
    } catch (error) {
      console.error('Failed to clear cache on exit:', error);
    }
  }

  // Close log stream
  if (logStream) {
    logStream.end();
  }
});