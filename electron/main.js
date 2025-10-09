// electron/main.js
const { app, BrowserWindow, session, Menu, protocol } = require('electron');
const path = require('path');

// Check if running in development or production
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// CRITICAL: Import the recording handler to enable screen recording
try {
  require('./electron-recording-main.js');
} catch (error) {
  console.log('Recording handler not found, continuing without it');
}

// 🚀 CRITICAL: Register file protocol handler for Cesium assets BEFORE app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'file', privileges: { bypassCSP: true, supportFetchAPI: true } }
]);

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
      webSecurity: false, // 🚀 CRITICAL: Disable for Cesium to load workers
      enableRemoteModule: false,
      devTools: true,
      // 🚀 CRITICAL: Allow file access for Cesium assets
      webviewTag: false,
      allowRunningInsecureContent: false
    }
  });

  // Remove default menu bar
  Menu.setApplicationMenu(null);

  // 🚀 CRITICAL: Intercept requests to Cesium directory
  mainWindow.webContents.session.protocol.interceptFileProtocol('file', (request, callback) => {
    let url = request.url.substr(7); // Remove 'file://' prefix
    
    // Decode URI to handle spaces and special characters
    url = decodeURIComponent(url);
    
    // Handle Cesium resources specifically
    if (url.includes('/Cesium/') || url.includes('\\Cesium\\')) {
      // Extract the Cesium resource path
      const cesiumMatch = url.match(/[\/\\]Cesium[\/\\](.+)$/);
      if (cesiumMatch) {
        const cesiumResource = cesiumMatch[1];
        
        // In production, Cesium is in resources/Cesium
        if (!isDev) {
          const resourcesPath = process.resourcesPath;
          const cesiumPath = path.join(resourcesPath, 'Cesium', cesiumResource);
          console.log('📦 Loading Cesium resource:', cesiumPath);
          callback({ path: cesiumPath });
          return;
        }
      }
    }
    
    // Default handling for other files
    callback({ path: url });
  });

  // Load the app
  if (isDev) {
    // Development mode: Load from Vite dev server
    mainWindow.loadURL('http://localhost:5173').catch(err => {
      console.error('Failed to load dev server:', err);
      loadProductionApp(mainWindow);
    });

    mainWindow.webContents.openDevTools();
  } else {
    // Production mode: Load built files
    loadProductionApp(mainWindow);
    
    // Open DevTools to see any errors
    mainWindow.webContents.openDevTools();
  }

  // Debug logging to verify setup
  mainWindow.webContents.once('did-finish-load', () => {
    console.log('🚀 Electron app loaded successfully');
    console.log('📁 Running in', isDev ? 'DEVELOPMENT' : 'PRODUCTION', 'mode');
    console.log('📂 __dirname:', __dirname);
    console.log('📂 app.getAppPath():', app.getAppPath());
    console.log('📂 process.resourcesPath:', process.resourcesPath);
    
    if (!isDev) {
      console.log('📂 Expected Cesium path:', path.join(process.resourcesPath, 'Cesium'));
    }
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });
}

function loadProductionApp(window) {
  // ✅ FIXED PATH: ../dist/index.html relative to electron directory
  const indexPath = path.join(__dirname, '../dist', 'index.html');
  console.log('📄 Loading index.html from:', indexPath);
  
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