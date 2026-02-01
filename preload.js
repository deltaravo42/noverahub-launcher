const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('launcher', {
  launchHub: () => ipcRenderer.invoke('launch-hub'),
  openHubWindow: (url) => ipcRenderer.invoke('open-hub-window', url),
  getConfig: () => ipcRenderer.invoke('get-config'),
  getProfile: () => ipcRenderer.invoke('get-profile'),
  login: (username, password) => ipcRenderer.invoke('auth-login', { username, password }),
  logout: () => ipcRenderer.invoke('auth-logout'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadAndRunUpdate: (url) => ipcRenderer.invoke('download-and-run-update', url),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  onLoggedOut: (callback) => {
    if (typeof callback === 'function') {
      ipcRenderer.on('launcher:logged-out', () => callback());
    }
  },
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
});
