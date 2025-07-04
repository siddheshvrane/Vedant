// electron/main.js

const { app, BrowserWindow, session, Menu } = require('electron'); // <-- Added 'Menu'
const path = require('path');

function createWindow () {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800, // Optional: recommended for full screen apps
    minHeight: 600, // Optional: recommended for full screen apps

    // --- 1. Make app work in full screen ---
    fullscreen: true, // Starts the window in fullscreen mode
    // You can also add 'autoHideMenuBar: true' if you want it hidden but still accessible via Alt key
    autoHideMenuBar: true, // Hides the menu bar by default, but it can be toggled with Alt ke857k

    // --- 2. Give icon to app ---
    // The path should be relative to the root of your Electron project
    // Make sure 'public/app-icon.png' exists.
    // For production builds, electron-builder will typically handle icons more robustly.
    icon: path.join(__dirname, '../src/assets/icon.png'), // Adjust path as per your project structure

    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false, // Keep as false for security
      contextIsolation: true, // Keep as true for security
      webSecurity: false // ⭐ TEMPORARILY SET TO FALSE FOR DEBUGGING EXTERNAL RESOURCES - REMOVE IN PRODUCTION!
    }
  });

  // --- 3. Remove default taskbar (menu bar) ---
  // This completely removes the default menu bar for the application.
  Menu.setApplicationMenu(null);

  // Load the Vite development server URL
  mainWindow.loadURL('http://localhost:5173');

  // Open the DevTools for debugging
  mainWindow.webContents.openDevTools();

  // Optional: Allow F11 to toggle fullscreen if needed later
  // mainWindow.webContents.on('before-input-event', (event, input) => {
  //   if (input.type === 'keyDown' && input.key === 'F11') {
  //     mainWindow.setFullScreen(!mainWindow.isFullScreen());
  //     event.preventDefault(); // Prevent default F11 browser behavior
  //   }
  // });
}

app.whenReady().then(() => {
  // This logic is crucial for accessing Bhuvan and Vedas services
  // It modifies the request headers to include the necessary Referer.
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
      details.requestHeaders['Referer'] = 'https://bhuvanlite.nrsc.gov.in';
    callback({ cancel: false, requestHeaders: details.requestHeaders });
  });

  createWindow();

  // Handle macOS specific app lifecycle events
  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});