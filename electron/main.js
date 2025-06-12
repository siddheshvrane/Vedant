const { app, BrowserWindow, session } = require('electron');
const path = require('path');

function createWindow () {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false // ⭐ TEMPORARILY SET TO FALSE FOR DEBUGGING EXTERNAL RESOURCES
    }
  });

  // Load the Vite development server URL
  mainWindow.loadURL('http://localhost:5173');

  // Open the DevTools for debugging
  mainWindow.webContents.openDevTools();
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