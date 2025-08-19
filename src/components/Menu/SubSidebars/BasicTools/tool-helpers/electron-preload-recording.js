// components/Menu/SubSidebars/BasicTools/tool-helpers/electron-preload-recording.js

const { contextBridge, ipcRenderer } = require('electron');

// Expose a safe API to the renderer process
contextBridge.exposeInMainWorld('electron', {
    // Screen recording functions
    getDesktopSources: (options) => {
        console.log('Preload: getDesktopSources called with options:', options);
        return ipcRenderer.invoke('get-desktop-sources', options);
    },
    
    getAudioDevices: () => {
        console.log('Preload: getAudioDevices called');
        return ipcRenderer.invoke('get-audio-devices');
    },
    
    getSystemAudio: () => {
        console.log('Preload: getSystemAudio called');
        return ipcRenderer.invoke('get-system-audio');
    },
    
    getRecordingCapabilities: () => {
        console.log('Preload: getRecordingCapabilities called');
        return ipcRenderer.invoke('get-recording-capabilities');
    },
    
    // File operations - Fixed parameter handling
    saveRecording: async (arrayBuffer, filename, mimeType = 'video/webm') => {
        try {
            console.log('Preload: saveRecording called', { 
                filename, 
                mimeType, 
                bufferSize: arrayBuffer.byteLength 
            });
            
            return await ipcRenderer.invoke('save-recording', arrayBuffer, filename, mimeType);
        } catch (error) {
            console.error('Preload: Failed to save recording:', error);
            return { success: false, error: error.message };
        }
    },
    
    // Platform information
    platform: process.platform,
    
    // Recording utilities
    formatFileSize: (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
    },
    
    formatDuration: (seconds) => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hrs > 0) {
            return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    },

    // Debug functions
    testElectronAPI: () => {
        console.log('Preload: Electron API test successful');
        return { success: true, platform: process.platform };
    }
});

// Log successful preload
console.log('Electron: Recording preload script loaded successfully');
console.log('Electron: Platform:', process.platform);
console.log('Electron: Node version:', process.versions.node);
console.log('Electron: Electron version:', process.versions.electron);