const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  send: (channel, data) => ipcRenderer.send(channel, data),
  on: (channel, callback) => ipcRenderer.on(channel, (event, ...args) => callback(...args))
});

// preload.js
// Empty or safe bridge if needed
window.addEventListener('DOMContentLoaded', () => {
  console.log('Preload loaded safely');
});
