const { app, BrowserWindow, session, Menu } = require('electron');
const path = require('path');

// Check if running in development or production
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// CRITICAL: Import the recording handler to enable screen recording
try {
  require('./electron-recording-main.js');
} catch (error) {
  console.log('Recording handler not found, continuing without it');
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,

    // Make app work in full screen
    fullscreen: true,
    autoHideMenuBar: true,

    // App icon
    icon: path.join(__dirname, isDev ? '../src/assets/icon.png' : '../build/icon.png'),

    webPreferences: {
      // Use the recording-enabled preload script if available
      preload: path.join(__dirname, 'electron-preload-recording.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: !isDev, // Disable only in development
      enableRemoteModule: false,
      devTools: isDev // Enable DevTools only in development
    }
  });

  // Remove default menu bar
  Menu.setApplicationMenu(null);

  // Load the app
  if (isDev) {
    // Development mode: Load from Vite dev server
    mainWindow.loadURL('http://localhost:5173').catch(err => {
      console.error('Failed to load dev server:', err);
      // Fallback to built files if dev server is not running
      loadProductionApp(mainWindow);
    });

    // Open DevTools for debugging in development
    mainWindow.webContents.openDevTools();
  } else {
    // Production mode: Load built files
    loadProductionApp(mainWindow);
  }

  // Debug logging to verify setup
  mainWindow.webContents.once('did-finish-load', () => {
    console.log('🚀 Electron app loaded successfully');
    console.log('📁 Running in', isDev ? 'DEVELOPMENT' : 'PRODUCTION', 'mode');
    
    if (isDev) {
      // Test if recording APIs are available (dev only)
      mainWindow.webContents.executeJavaScript(`
        console.log('🔍 Testing window.electron availability:', !!window.electron);
        if (window.electron) {
          console.log('✅ window.electron methods:', Object.keys(window.electron));
        } else {
          console.error('❌ window.electron is not available - preload script failed');
        }
      `);
    }
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });
}

function loadProductionApp(window) {
  const indexPath = path.join(__dirname, '../dist/index.html');
  window.loadFile(indexPath).catch(err => {
    console.error('Failed to load production app:', err);
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