const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
  // Settings management
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),

  // Discord browser control
  launchDiscord: (options) => ipcRenderer.invoke('launch-discord', options),
  closeDiscord: () => ipcRenderer.invoke('close-discord'),
  checkToken: (token, proxySettings) => ipcRenderer.invoke('check-token', token, proxySettings),

  // Utility functions
  selectFile: () => ipcRenderer.invoke('select-file'),
  showMessage: (type, title, message) => ipcRenderer.invoke('show-message', type, title, message),

  // Event listeners
  onDiscordClosed: (callback) => {
    ipcRenderer.on('discord-closed', callback);
  },
  onTokenUpdated: (callback) => {
    ipcRenderer.on('token-updated', (event, token) => callback(token));
  },
  onProxyError: (callback) => {
    ipcRenderer.on('proxy-error', (event, error) => callback(error));
  }
});