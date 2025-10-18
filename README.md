# Discord Secure Launcher - Ultimate Stealth Edition

A military-grade undetectable Discord launcher with comprehensive anti-fingerprinting protection, full proxy support (including WebRTC/SRTP routing), and advanced browser spoofing that makes it indistinguishable from a normal Chrome browser.

## Features

### Privacy & Security - UNDETECTABLE BROWSER
- **Complete Browser Spoofing**: Appears as a normal, frequently-used Chrome browser
- **Pre-seeded Browser History**: Simulates 2+ weeks of browsing history with popular sites
- **Advanced Anti-Fingerprinting**:
  - ✅ Proper `navigator.plugins` PluginArray (not detectable arrays)
  - ✅ Complete `window.chrome` object with all real Chrome properties
  - ✅ Real canvas fingerprint noise injection (actually works)
  - ✅ WebGL randomization from real GPU database
  - ✅ AudioContext fingerprint protection
  - ✅ Font enumeration blocking
  - ✅ Battery API spoofing
  - ✅ Timezone complete override (all Date methods)
  - ✅ Screen properties with proper color/pixel depth
  - ✅ Hardware concurrency randomization
  - ✅ Device memory spoofing
  - ✅ Navigator credentials API (simulates saved passwords)
  - ✅ CSS :visited link history simulation
- **Behavioral Simulation**:
  - Random idle periods (simulates AFK)
  - Tab switching simulation
  - Typing mistakes and corrections
  - Random text selection
  - Focus/blur events
  - Scroll behavior
  - Zoom changes
- **WebRTC/SRTP Protection**:
  - Forces `disable_non_proxied_udp` policy
  - Blocks STUN servers at network level
  - Forces relay-only mode
  - Prevents ALL IP leaks through proxy
- **Session Realism**:
  - IndexedDB databases from popular sites
  - Service worker registrations
  - localStorage data for common sites
  - Realistic cookies with proper timestamps
  - Simulated autofill profiles

### Proxy Support
- HTTP/HTTPS/SOCKS5 proxy configuration
- Proxy authentication support
- Easy proxy switching through the UI

### Token Management
- Secure local token storage (encrypted)
- Automatic token extraction and updates
- Optional auto-login with saved tokens
- **Token Validation**: Built-in "Check Token" button to verify token validity and display Discord username

### User-Friendly Interface
- Clean, modern UI design
- One-click Discord launch
- Settings persistence
- Real-time status updates
- **Developer Console**: Built-in console window for debugging (F12 or Ctrl+Shift+C)
- **Chrome Extensions Support**: Load custom Chrome extensions from the plugins folder

## Installation

### Requirements
- Windows 10/11 (or Linux/macOS with modifications)
- Node.js 16 or higher
- NPM or Yarn

### Quick Start

1. **Clone or download this repository**
   ```bash
   git clone https://github.com/yourusername/discord-secure-launcher.git
   cd discord-secure-launcher
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run the launcher**
   - **Windows**: Double-click `start.bat`
   - **Command line**: `npm start`

### Building Executable

To create a standalone executable:

1. **Windows**: Double-click `build.bat`
2. **Command line**: `npm run build`

The installer will be created in the `dist` folder.

## Usage Guide

### First Launch

1. **Open the launcher** by running `start.bat` or `npm start`
2. The launcher window will appear with options for configuration

### Proxy Configuration

1. **Enable Proxy**: Check the "Enable Proxy Connection" box
2. **Configure Settings**:
   - **Protocol**: Select HTTP, HTTPS, or SOCKS5
   - **Host**: Enter your proxy server address
   - **Port**: Enter the proxy port (e.g., 8080)
   - **Authentication** (optional): Enter username and password if required
3. **Save Settings**: Click "Save Settings" to store your configuration

### Token Usage (Optional)

If you have a Discord token:
1. Enter it in the "Discord Token" field
2. Enable "Auto-login with saved token"
3. The launcher will automatically log you in

**Note**: Leave the token field empty to login manually through Discord's interface.

### Privacy Options

- **Auto-login with saved token**: Automatically uses your saved token
- **Clear cache on exit**: Removes all browser data when closing
- **Randomize user agent**: Changes browser fingerprint each session

### Launching Discord

1. Configure your desired settings
2. Click **"Launch Discord"**
3. Discord will open in a secure browser window
4. The launcher will minimize automatically
5. When you close Discord, the launcher will reappear

### Using Chrome Extensions

The launcher supports loading Chrome extensions for additional functionality:

1. **Access the plugins folder**:
   - From the app menu: File → Open Plugins Folder
   - Or navigate to the `plugins` folder in the application directory
2. **Add extensions**:
   - Download Chrome extensions (.crx files) or unpacked extensions
   - Extract .crx files using 7-Zip or similar tool
   - Place each extension in its own subfolder within `plugins`
3. **Extensions are automatically loaded** when Discord launches

Example structure:
```
plugins/
  ublock-origin/
    manifest.json
    ...
  privacy-badger/
    manifest.json
    ...
```

## Security Features Explained

### Device Fingerprinting Protection

The launcher implements multiple layers of protection:

1. **Browser Fingerprints**: Randomized on each launch
2. **Canvas Fingerprinting**: Adds noise to canvas operations
3. **WebGL Information**: Spoofs GPU/vendor information
4. **Navigator Properties**: Overrides telltale automation properties
5. **Plugin Detection**: Mimics normal browser plugin arrays

### Session Isolation

- Each launch creates a new isolated browser context (not incognito mode)
- Temporary user data directories that are cleaned up after each session
- No cookies or data persist between sessions (unless token saved)
- Separate from your regular browser profile
- Chrome extensions can be loaded from the `plugins` folder

### Network Security

- WebRTC disabled to prevent IP leaks through proxy
- Certificate verification for secure connections
- Proxy authentication support for additional security

## Troubleshooting

### Common Issues

**Launcher won't start**
- Ensure Node.js is installed: `node --version`
- Run `npm install` to install dependencies
- Check antivirus isn't blocking the application

**Discord won't load**
- Check your internet connection
- Verify proxy settings if using a proxy
- Try disabling proxy to test direct connection

**Token not working**
- Tokens can expire or be revoked
- Try logging in manually to get a new token
- Ensure token format is correct (no extra quotes or spaces)

**Proxy connection failed**
- Verify proxy server is running
- Check host and port are correct
- Test proxy credentials if authentication required

### Getting Your Discord Token (Advanced)

**Warning**: Only use your own token. Never share it with others.

1. Open Discord in a regular browser
2. Press F12 to open Developer Tools
3. Go to the Network tab
4. Look for requests to Discord API
5. Find the "Authorization" header in request headers

## File Structure

```
DiscordNoFingerprinting/
├── src/
│   ├── main.js              # Main Electron process
│   ├── preload.js           # Preload script for IPC
│   ├── launcher.html        # UI HTML
│   ├── launcher.js          # UI JavaScript
│   ├── discord-browser.js   # Puppeteer automation
│   └── console.html         # Developer console window
├── plugins/                 # Chrome extensions folder
│   └── README.txt          # Instructions for adding extensions
├── assets/
│   └── icon.txt            # Icon placeholder
├── package.json            # Project configuration
├── start.bat              # Windows start script
├── build.bat              # Windows build script
└── README.md              # This file
```

## Privacy & Legal

### Privacy Notice
- This launcher stores settings locally only
- Tokens are encrypted on your device
- No data is sent to external servers
- All privacy features are client-side

### Disclaimer
- This tool is for privacy protection and security research
- Use in compliance with Discord's Terms of Service
- The developers are not responsible for account actions
- This is not affiliated with Discord Inc.

### Security Best Practices
- Regularly update your Discord password
- Use 2FA on your Discord account
- Don't share your token with anyone
- Use trusted proxy services only
- Keep the launcher updated

## Development

### Technologies Used
- **Electron**: Desktop application framework
- **Puppeteer**: Browser automation
- **electron-store**: Secure settings storage
- **Node.js**: Runtime environment

### Contributing
Feel free to submit issues and enhancement requests!

### Building from Source
```bash
# Install dependencies
npm install

# Run in development
npm start

# Build distributables
npm run build
```

## Support

If you encounter issues:
1. Check the troubleshooting section
2. Ensure all dependencies are installed
3. Try running with administrator privileges
4. Check if antivirus is blocking the app

## License

MIT License - See LICENSE file for details

## Acknowledgments

- Built for privacy-conscious Discord users
- Inspired by the need for better device fingerprinting protection
- Thanks to the Electron and Puppeteer communities

---

**Remember**: Your privacy and security are important. Always use security tools responsibly and in accordance with platform terms of service.