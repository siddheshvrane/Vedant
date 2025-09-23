// electron/electron-preload-recording.js - FIXED VERSION

const { contextBridge, ipcRenderer } = require('electron');

// Enhanced error handling wrapper
function createSafeIpcInvoker(channel, name) {
    return async (...args) => {
        try {
            console.log(`Preload: ${name} called with args:`, args.length > 0 ? args[0] : 'none');
            const result = await ipcRenderer.invoke(channel, ...args);
            console.log(`Preload: ${name} completed successfully`);
            return result;
        } catch (error) {
            console.error(`Preload: ${name} failed:`, error);
            throw error;
        }
    };
}

// Expose a comprehensive and safe API to the renderer process
contextBridge.exposeInMainWorld('electron', {
    // Screen recording functions with enhanced error handling
    getDesktopSources: createSafeIpcInvoker('get-desktop-sources', 'getDesktopSources'),
    
    getAudioDevices: createSafeIpcInvoker('get-audio-devices', 'getAudioDevices'),
    
    getSystemAudio: createSafeIpcInvoker('get-system-audio', 'getSystemAudio'),
    
    getRecordingCapabilities: createSafeIpcInvoker('get-recording-capabilities', 'getRecordingCapabilities'),
    
    // File operations with comprehensive parameter validation
    saveRecording: async (arrayBuffer, filename, mimeType = 'video/webm') => {
        try {
            // Validate parameters
            if (!arrayBuffer || !(arrayBuffer instanceof ArrayBuffer)) {
                throw new Error('Invalid arrayBuffer parameter - must be ArrayBuffer instance');
            }
            
            if (arrayBuffer.byteLength === 0) {
                throw new Error('ArrayBuffer is empty - no data to save');
            }
            
            if (!filename || typeof filename !== 'string') {
                throw new Error('Invalid filename parameter - must be non-empty string');
            }
            
            if (!mimeType || typeof mimeType !== 'string') {
                mimeType = 'video/webm'; // Safe fallback
            }
            
            console.log('Preload: saveRecording called with validated parameters:', { 
                filename, 
                mimeType, 
                bufferSize: arrayBuffer.byteLength,
                bufferType: arrayBuffer.constructor.name
            });
            
            const result = await ipcRenderer.invoke('save-recording', arrayBuffer, filename, mimeType);
            
            if (!result) {
                throw new Error('Save operation returned null/undefined result');
            }
            
            console.log('Preload: saveRecording completed:', result.success ? 'SUCCESS' : 'FAILED');
            return result;
            
        } catch (error) {
            console.error('Preload: saveRecording failed with error:', error);
            return { 
                success: false, 
                error: error.message,
                details: error.stack
            };
        }
    },
    
    // Platform and system information
    platform: process.platform,
    
    versions: {
        node: process.versions.node,
        electron: process.versions.electron,
        chrome: process.versions.chrome
    },
    
    // Utility functions for the renderer
    formatFileSize: (bytes) => {
        if (!bytes || bytes === 0) return '0 B';
        
        try {
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            const size = parseFloat((bytes / Math.pow(k, i)).toFixed(2));
            return `${size} ${sizes[i]}`;
        } catch (error) {
            console.error('Preload: formatFileSize error:', error);
            return `${bytes} B`;
        }
    },
    
    formatDuration: (seconds) => {
        try {
            if (!seconds || seconds < 0) return '0:00';
            
            const hrs = Math.floor(seconds / 3600);
            const mins = Math.floor((seconds % 3600) / 60);
            const secs = Math.floor(seconds % 60);
            
            if (hrs > 0) {
                return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            }
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        } catch (error) {
            console.error('Preload: formatDuration error:', error);
            return '0:00';
        }
    },

    // Enhanced debug and connectivity functions
    testElectronAPI: async () => {
        try {
            console.log('Preload: Testing Electron API connectivity...');
            const result = await ipcRenderer.invoke('test-electron-api');
            console.log('Preload: Electron API test result:', result);
            return {
                success: true,
                preloadActive: true,
                mainProcessActive: result.success,
                platform: process.platform,
                versions: {
                    node: process.versions.node,
                    electron: process.versions.electron,
                    chrome: process.versions.chrome
                },
                timestamp: new Date().toISOString(),
                mainProcessData: result
            };
        } catch (error) {
            console.error('Preload: Electron API test failed:', error);
            return {
                success: false,
                preloadActive: true,
                mainProcessActive: false,
                error: error.message,
                platform: process.platform,
                timestamp: new Date().toISOString()
            };
        }
    },

    // System capabilities detection
    checkSystemCapabilities: async () => {
        try {
            const capabilities = await ipcRenderer.invoke('get-recording-capabilities');
            return {
                recording: capabilities,
                mediaDevices: !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia),
                mediaRecorder: !!window.MediaRecorder,
                secureContext: window.isSecureContext || location.hostname === 'localhost'
            };
        } catch (error) {
            console.error('Preload: System capabilities check failed:', error);
            return {
                recording: null,
                mediaDevices: false,
                mediaRecorder: false,
                secureContext: false,
                error: error.message
            };
        }
    },

    // Enhanced logging for debugging
    log: {
        info: (message, ...args) => {
            console.log(`[Electron-Renderer] ${message}`, ...args);
        },
        warn: (message, ...args) => {
            console.warn(`[Electron-Renderer] ${message}`, ...args);
        },
        error: (message, ...args) => {
            console.error(`[Electron-Renderer] ${message}`, ...args);
        }
    }
});

// Also expose the original electronAPI for backward compatibility
contextBridge.exposeInMainWorld('electronAPI', {
    send: (channel, data) => ipcRenderer.send(channel, data),
    on: (channel, callback) => ipcRenderer.on(channel, (event, ...args) => callback(...args))
});

// Comprehensive startup diagnostics
console.log('='.repeat(60));
console.log('Electron Preload: Recording bridge initialized successfully');
console.log(`Platform: ${process.platform}`);
console.log(`Node version: ${process.versions.node}`);
console.log(`Electron version: ${process.versions.electron}`);
console.log(`Chrome version: ${process.versions.chrome}`);
console.log(`Process ID: ${process.pid}`);
console.log(`Context isolated: ${process.contextIsolated}`);
console.log(`Sandbox enabled: ${process.sandboxed}`);
console.log('='.repeat(60));

// Test IPC connection immediately
(async () => {
    try {
        const testResult = await ipcRenderer.invoke('test-electron-api');
        if (testResult.success) {
            console.log('✅ Preload: IPC connection to main process verified');
        } else {
            console.warn('⚠️ Preload: IPC test returned unsuccessful result:', testResult);
        }
    } catch (testError) {
        console.error('❌ Preload: IPC connection test failed:', testError);
    }
})();

// Handle any uncaught errors in the preload script
process.on('uncaughtException', (error) => {
    console.error('Preload: Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Preload: Unhandled rejection at:', promise, 'reason:', reason);
});

// Export for potential CommonJS usage (fallback)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        preloadInitialized: true,
        platform: process.platform,
        versions: process.versions
    };
}