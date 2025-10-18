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

  // Hardware Profile Management
  getCurrentProfile: () => ipcRenderer.invoke('get-current-profile'),
  setCurrentProfile: (profile) => ipcRenderer.invoke('set-current-profile', profile),
  setCurrentHardwareProfile: (profile) => ipcRenderer.invoke('set-current-hardware-profile', profile),
  generateProfile: (template) => ipcRenderer.invoke('generate-profile', template),
  generateHardwareProfile: (template) => ipcRenderer.invoke('generate-hardware-profile', template),
  saveProfile: (profile) => ipcRenderer.invoke('save-profile', profile),
  loadProfile: (id) => ipcRenderer.invoke('load-profile', id),
  getAllProfiles: () => ipcRenderer.invoke('get-all-profiles'),
  deleteProfile: (id) => ipcRenderer.invoke('delete-profile', id),

  // Browser Profile Management
  createBrowserProfile: (name, hardwareProfile, blockWebRTC) => ipcRenderer.invoke('create-browser-profile', name, hardwareProfile, blockWebRTC),
  loadBrowserProfile: (id) => ipcRenderer.invoke('load-browser-profile', id),
  updateBrowserProfile: (id, profile) => ipcRenderer.invoke('update-browser-profile', id, profile),
  getAllBrowserProfiles: () => ipcRenderer.invoke('get-all-browser-profiles'),
  getCurrentBrowserProfile: () => ipcRenderer.invoke('get-current-browser-profile'),
  deleteBrowserProfile: (id) => ipcRenderer.invoke('delete-browser-profile', id),
  getBrowserProfileStats: (id) => ipcRenderer.invoke('get-browser-profile-stats', id),
  exportBrowserProfile: (id) => ipcRenderer.invoke('export-browser-profile', id),
  importBrowserProfile: () => ipcRenderer.invoke('import-browser-profile'),

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