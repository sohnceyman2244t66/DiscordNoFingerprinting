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
    width: 500,
    height: 700,
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
      await discordBrowser.close();
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

    const https = require('https');
    const http = require('http');

    // Prepare options
    const apiPath = '/api/v10/users/@me';
    const headers = {
      'Authorization': token.startsWith('Bot ') ? token : token,
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };

    // If proxy is enabled, use different approach
    if (proxySettings && proxySettings.enabled && proxySettings.host) {
      console.log('Using proxy for token check:', proxySettings.host);

      const ProxyAgent = require('https-proxy-agent');
      const proxyUrl = `${proxySettings.protocol}://${proxySettings.username ? proxySettings.username + ':' + proxySettings.password + '@' : ''}${proxySettings.host}:${proxySettings.port}`;
      const agent = new ProxyAgent(proxyUrl);

      return new Promise((resolve) => {
        const options = {
          hostname: 'discord.com',
          port: 443,
          path: apiPath,
          method: 'GET',
          headers: headers,
          agent: agent
        };

        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => data += chunk);
          res.on('end', () => {
            handleTokenResponse(res.statusCode, data, resolve);
          });
        });

        req.on('error', (error) => {
          console.error('Proxy request error:', error);
          resolve({ success: false, error: `Proxy error: ${error.message}` });
        });

        req.end();
      });
    } else {
      // Direct connection without proxy
      return new Promise((resolve) => {
        const options = {
          hostname: 'discord.com',
          port: 443,
          path: apiPath,
          method: 'GET',
          headers: headers
        };

        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => data += chunk);
          res.on('end', () => {
            handleTokenResponse(res.statusCode, data, resolve);
          });
        });

        req.on('error', (error) => {
          console.error('Direct request error:', error);
          resolve({ success: false, error: error.message });
        });

        req.end();
      });
    }

    function handleTokenResponse(statusCode, data, resolve) {
      try {
        if (statusCode === 200) {
          const userInfo = JSON.parse(data);
          // Handle cases where global_name might be null
          const username = userInfo.global_name || userInfo.username || 'Unknown User';
          const discriminator = userInfo.discriminator && userInfo.discriminator !== '0' ? `#${userInfo.discriminator}` : '';

          console.log(`Token valid! User: ${username}${discriminator}`);
          console.log('User data:', userInfo);

          resolve({
            success: true,
            username: username,
            discriminator: discriminator,
            fullUsername: `${username}${discriminator}`,
            id: userInfo.id,
            avatar: userInfo.avatar,
            email: userInfo.email,
            verified: userInfo.verified,
            locale: userInfo.locale,
            mfa_enabled: userInfo.mfa_enabled,
            premium_type: userInfo.premium_type
          });
        } else if (statusCode === 401) {
          console.error('Token invalid or expired');
          resolve({ success: false, error: 'Invalid or expired token' });
        } else {
          console.error(`Discord API returned status code: ${statusCode}`);
          console.error('Response data:', data);
          resolve({ success: false, error: `API error: ${statusCode}` });
        }
      } catch (error) {
        console.error('Error parsing Discord response:', error);
        resolve({ success: false, error: 'Failed to parse response' });
      }
    }
  } catch (error) {
    console.error('Failed to check token:', error);
    return { success: false, error: error.message };
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