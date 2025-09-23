// electron/main.js

const { app, BrowserWindow, session, Menu } = require('electron');
const path = require('path');

// CRITICAL: Import the recording handler to enable screen recording
require('./electron-recording-main.js');

function createWindow () {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,

    // Make app work in full screen
    fullscreen: true,
    autoHideMenuBar: true,

    // App icon
    icon: path.join(__dirname, '../src/assets/icon.png'),

    webPreferences: {
      // CRITICAL: Use the recording-enabled preload script
      preload: path.join(__dirname, 'electron-preload-recording.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // For debugging - remove in production
      enableRemoteModule: false
    }
  });

  // Remove default menu bar
  Menu.setApplicationMenu(null);

  // Load the Vite development server URL
  mainWindow.loadURL('http://localhost:5173');

  // Open DevTools for debugging
  mainWindow.webContents.openDevTools();

  // Debug logging to verify setup
  mainWindow.webContents.once('did-finish-load', () => {
    console.log('🚀 Electron app loaded successfully');
    console.log('📁 Preload script path:', path.join(__dirname, 'electron-preload-recording.js'));
    
    // Test if recording APIs are available
    mainWindow.webContents.executeJavaScript(`
      console.log('🔍 Testing window.electron availability:', !!window.electron);
      if (window.electron) {
        console.log('✅ window.electron methods:', Object.keys(window.electron));
      } else {
        console.error('❌ window.electron is not available - preload script failed');
      }
    `);
  });
}

app.whenReady().then(() => {
  // Configure session for Bhuvan and Vedas services
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['Referer'] = 'https://bhuvanlite.nrsc.gov.in';
    callback({ cancel: false, requestHeaders: details.requestHeaders });
  });

  createWindow();

  // Handle macOS specific app lifecycle events
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Enhanced error handling
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});