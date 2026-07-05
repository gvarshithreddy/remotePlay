const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Pre-flight checks and installation
  checkDrivers: () => ipcRenderer.invoke('check-drivers'),
  installDrivers: () => ipcRenderer.invoke('install-drivers'),
  
  // Steam integration
  scanLibrary: () => ipcRenderer.invoke('scan-library'),
  launchGame: (appid) => ipcRenderer.invoke('launch-game', appid),
  
  // Session orchestration
  startSession: (config) => ipcRenderer.invoke('start-session', config),
  killSession: () => ipcRenderer.invoke('kill-session'),
  
  // Event listeners
  onDriverStatus: (callback) => ipcRenderer.on('driver-status', (event, value) => callback(value)),
  onSessionStatus: (callback) => ipcRenderer.on('session-status', (event, value) => callback(value)),
  onGamepadInput: (callback) => ipcRenderer.on('gamepad-input', (event, value) => callback(value)),
  onSessionLog: (callback) => ipcRenderer.on('session-log', (event, value) => callback(value))
});
