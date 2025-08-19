// components/Menu/SubSidebars/BasicTools/tool-helpers/electron-recording-main.js

const { ipcMain, desktopCapturer, dialog } = require('electron');
const { promises: fs } = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class RecordingHandler {
    constructor() {
        this.setupIpcHandlers();
        console.log('Electron Main: RecordingHandler initialized');
    }

    setupIpcHandlers() {
        // Handle getting desktop sources for screen capture
        ipcMain.handle('get-desktop-sources', this.handleGetDesktopSources.bind(this));

        // Handle getting available audio devices
        ipcMain.handle('get-audio-devices', this.handleGetAudioDevices.bind(this));

        // Handle getting system audio stream details
        ipcMain.handle('get-system-audio', this.handleGetSystemAudio.bind(this));

        // Handle saving the recorded file - Updated to handle mimeType parameter
        ipcMain.handle('save-recording', this.handleSaveRecording.bind(this));

        // Handle getting recording capabilities
        ipcMain.handle('get-recording-capabilities', this.handleGetRecordingCapabilities.bind(this));

        console.log('Electron Main: Recording IPC handlers registered');
    }

    async handleGetDesktopSources(event, options = {}) {
        try {
            console.log('Electron Main: Getting desktop sources with options:', options);
            
            const defaultOptions = {
                types: ['screen', 'window'],
                thumbnailSize: { width: 150, height: 150 },
                fetchWindowIcons: true
            };

            const finalOptions = { ...defaultOptions, ...options };
            
            const sources = await desktopCapturer.getSources(finalOptions);

            // Filter and format sources for the renderer process
            const formattedSources = sources.map(source => ({
                id: source.id,
                name: source.name,
                thumbnail: source.thumbnail ? source.thumbnail.toDataURL() : null,
                display_id: source.display_id,
                appIcon: source.appIcon ? source.appIcon.toDataURL() : null
            }));

            console.log(`Electron Main: Found ${formattedSources.length} desktop sources`);
            return formattedSources;
            
        } catch (error) {
            console.error('Electron Main: Failed to get desktop sources:', error);
            throw error;
        }
    }

    async handleGetAudioDevices() {
        try {
            console.log('Electron Main: Getting audio devices...');
            const devices = await this.getSystemAudioDevices();
            console.log(`Electron Main: Found ${devices.length} audio devices`);
            return devices;
            
        } catch (error) {
            console.error('Electron Main: Failed to get audio devices:', error);
            // Provide a fallback in case of failure
            return [
                { id: 'none', label: 'No Audio', type: 'none' },
                { id: 'default', label: 'System Default', type: 'default' }
            ];
        }
    }

    async handleGetSystemAudio() {
        try {
            console.log('Electron Main: Getting system audio stream...');
            const audioConfig = await this.getSystemAudioConfig();
            return audioConfig;
            
        } catch (error) {
            console.error('Electron Main: Failed to get system audio:', error);
            throw error;
        }
    }

    async handleSaveRecording(event, arrayBuffer, suggestedName, mimeType = 'video/webm') {
        try {
            console.log('Electron Main: Saving recording with suggested name:', suggestedName);
            console.log('Electron Main: MIME type:', mimeType);
            console.log('Electron Main: Buffer size:', arrayBuffer.byteLength);
            
            // Determine file extension based on MIME type
            let extension = 'webm';
            if (mimeType.includes('mp4')) extension = 'mp4';
            else if (mimeType.includes('avi')) extension = 'avi';
            else if (mimeType.includes('mov')) extension = 'mov';

            // Ensure the suggested filename has the correct extension
            if (!suggestedName.endsWith(`.${extension}`)) {
                suggestedName = suggestedName.replace(/\.[^/.]+$/, '') + `.${extension}`;
            }
            
            const { canceled, filePath } = await dialog.showSaveDialog({
                title: 'Save FlyThrough Recording',
                defaultPath: path.join(os.homedir(), 'Downloads', suggestedName),
                filters: [
                    { name: 'WebM Video', extensions: ['webm'] },
                    { name: 'MP4 Video', extensions: ['mp4'] },
                    { name: 'AVI Video', extensions: ['avi'] },
                    { name: 'MOV Video', extensions: ['mov'] },
                    { name: 'All Files', extensions: ['*'] }
                ],
                properties: ['createDirectory']
            });

            if (canceled || !filePath) {
                console.log('Electron Main: Save dialog cancelled');
                return { success: false, cancelled: true };
            }

            // Convert ArrayBuffer to Buffer and write file
            const buffer = Buffer.from(arrayBuffer);
            await fs.writeFile(filePath, buffer);

            console.log(`Electron Main: Recording saved successfully to: ${filePath}`);
            console.log(`Electron Main: File size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);

            return { 
                success: true, 
                filePath: filePath,
                fileSize: buffer.length
            };
            
        } catch (error) {
            console.error('Electron Main: Failed to save recording:', error);
            return { 
                success: false, 
                error: error.message 
            };
        }
    }

    async handleGetRecordingCapabilities() {
        try {
            const capabilities = {
                supportedFormats: ['webm', 'mp4'],
                supportedCodecs: {
                    video: ['vp8', 'vp9', 'h264'],
                    audio: ['opus', 'vorbis', 'aac']
                },
                maxResolution: { width: 3840, height: 2160 },
                maxFrameRate: 120,
                systemAudioSupported: await this.isSystemAudioSupported(),
                platform: process.platform
            };
            
            console.log('Electron Main: Recording capabilities:', capabilities);
            return capabilities;
            
        } catch (error) {
            console.error('Electron Main: Failed to get recording capabilities:', error);
            return {
                supportedFormats: ['webm'],
                supportedCodecs: { video: ['vp8'], audio: ['opus'] },
                maxResolution: { width: 1920, height: 1080 },
                maxFrameRate: 60,
                systemAudioSupported: false,
                platform: process.platform
            };
        }
    }

    /**
     * Get system audio devices based on platform
     */
    async getSystemAudioDevices() {
        const baseDevices = [
            { id: 'none', label: 'No Audio', type: 'none' },
            { id: 'default', label: 'System Default Microphone', type: 'default' }
        ];

        try {
            // Platform-specific audio device detection
            switch (process.platform) {
                case 'win32':
                    return [...baseDevices, ...(await this.getWindowsAudioDevices())];
                case 'darwin':
                    return [...baseDevices, ...(await this.getMacAudioDevices())];
                case 'linux':
                    return [...baseDevices, ...(await this.getLinuxAudioDevices())];
                default:
                    console.log('Electron Main: Unknown platform, using base devices only');
                    return baseDevices;
            }
        } catch (error) {
            console.error('Electron Main: Platform audio device detection failed:', error);
            return baseDevices;
        }
    }

    /**
     * Windows audio device detection
     */
    async getWindowsAudioDevices() {
        try {
            const command = 'Get-WmiObject -Class Win32_SoundDevice | Where-Object {$_.Name -ne $null} | Select-Object Name, DeviceID | ConvertTo-Json';
            const { stdout } = await execAsync(`powershell -Command "${command}"`);
            
            if (!stdout.trim()) return [];
            
            let devices;
            try {
                devices = JSON.parse(stdout);
            } catch (parseError) {
                console.error('Electron Main: Failed to parse Windows audio devices JSON:', parseError);
                return [];
            }

            const deviceArray = Array.isArray(devices) ? devices : [devices];
            
            return deviceArray
                .filter(device => device && device.Name)
                .map(device => ({
                    id: device.DeviceID || `windows-${device.Name.replace(/\s+/g, '-')}`,
                    label: device.Name,
                    type: device.Name.toLowerCase().includes('bluetooth') ? 'bluetooth' : 'microphone'
                }));
                
        } catch (error) {
            console.error('Electron Main: Windows audio device detection failed:', error);
            return [];
        }
    }

    /**
     * macOS audio device detection
     */
    async getMacAudioDevices() {
        try {
            const { stdout } = await execAsync('system_profiler SPAudioDataType -json');
            const audioData = JSON.parse(stdout);

            const devices = [];
            if (audioData.SPAudioDataType) {
                audioData.SPAudioDataType.forEach(audioItem => {
                    if (audioItem._items) {
                        audioItem._items.forEach(device => {
                            if (device._name) {
                                devices.push({
                                    id: `mac-${device._name.replace(/\s+/g, '-')}`,
                                    label: device._name,
                                    type: device._name.toLowerCase().includes('bluetooth') ? 'bluetooth' : 'microphone'
                                });
                            }
                        });
                    }
                });
            }
            return devices;
            
        } catch (error) {
            console.error('Electron Main: macOS audio device detection failed:', error);
            return [];
        }
    }

    /**
     * Linux audio device detection
     */
    async getLinuxAudioDevices() {
        try {
            const { stdout } = await execAsync('pactl list sources short 2>/dev/null || echo ""');
            if (!stdout.trim()) return [];
            
            const lines = stdout.trim().split('\n');

            return lines
                .filter(line => line && !line.includes('monitor'))
                .map(line => {
                    const parts = line.split('\t');
                    const deviceName = parts[1] || '';
                    const description = parts[4] || deviceName;
                    
                    return {
                        id: `linux-${deviceName}`,
                        label: description || 'Linux Audio Device',
                        type: description.toLowerCase().includes('bluetooth') ? 'bluetooth' : 'microphone'
                    };
                })
                .filter(device => device.id && device.label);
                
        } catch (error) {
            console.error('Electron Main: Linux audio device detection failed:', error);
            return [];
        }
    }

    /**
     * Get system audio configuration for recording
     */
    async getSystemAudioConfig() {
        switch (process.platform) {
            case 'win32':
                return this.getWindowsSystemAudio();
            case 'darwin':
                return this.getMacSystemAudio();
            case 'linux':
                return this.getLinuxSystemAudio();
            default:
                throw new Error(`System audio not supported on ${process.platform}`);
        }
    }

    async getWindowsSystemAudio() {
        return {
            type: 'wasapi-loopback',
            deviceId: 'default',
            constraints: {
                audio: {
                    mandatory: {
                        chromeMediaSource: 'system',
                        chromeMediaSourceId: 'default',
                    },
                    optional: [
                        { echoCancellation: false },
                        { autoGainControl: false },
                        { noiseSuppression: false }
                    ]
                }
            }
        };
    }

    async getMacSystemAudio() {
        return {
            type: 'virtual-audio-device',
            deviceId: 'BlackHole',
            instructions: 'Install BlackHole virtual audio device for system audio capture',
            downloadUrl: 'https://existential.audio/blackhole/',
            constraints: {
                audio: {
                    deviceId: { exact: 'BlackHole' },
                    echoCancellation: false,
                    autoGainControl: false,
                    noiseSuppression: false
                }
            }
        };
    }

    async getLinuxSystemAudio() {
        return {
            type: 'pulseaudio-loopback',
            deviceId: 'default',
            constraints: {
                audio: {
                    deviceId: { exact: 'default.monitor' },
                    echoCancellation: false,
                    autoGainControl: false,
                    noiseSuppression: false
                }
            }
        };
    }

    /**
     * Check if system audio capture is supported on the current platform
     */
    async isSystemAudioSupported() {
        switch (process.platform) {
            case 'win32':
                return true;
            case 'darwin':
                return await this.checkMacVirtualAudioDevice();
            case 'linux':
                return await this.checkLinuxPulseAudio();
            default:
                return false;
        }
    }

    async checkMacVirtualAudioDevice() {
        try {
            const { stdout } = await execAsync('system_profiler SPAudioDataType -json');
            const audioData = JSON.parse(stdout);
            
            let hasVirtualDevice = false;
            if (audioData.SPAudioDataType) {
                audioData.SPAudioDataType.forEach(audioItem => {
                    if (audioItem._items) {
                        audioItem._items.forEach(device => {
                            const name = (device._name || '').toLowerCase();
                            if (name.includes('blackhole') || name.includes('soundflower') || name.includes('virtual')) {
                                hasVirtualDevice = true;
                            }
                        });
                    }
                });
            }
            return hasVirtualDevice;
            
        } catch (error) {
            console.error('Electron Main: Failed to check macOS virtual audio device:', error);
            return false;
        }
    }

    async checkLinuxPulseAudio() {
        try {
            await execAsync('which pactl');
            return true;
        } catch (error) {
            console.error('Electron Main: PulseAudio not available on Linux:', error);
            return false;
        }
    }

    /**
     * Create an optimized recording directory structure
     */
    async createRecordingDirectory() {
        try {
            const recordingsDir = path.join(os.homedir(), 'FlythroughRecordings');
            const todayDir = path.join(recordingsDir, new Date().toISOString().split('T')[0]);
            
            await fs.mkdir(todayDir, { recursive: true });
            console.log('Electron Main: Recording directory created:', todayDir);
            return todayDir;
            
        } catch (error) {
            console.error('Electron Main: Failed to create recording directory:', error);
            return os.homedir();
        }
    }

    /**
     * Get optimal recording settings for the current system
     */
    getOptimalRecordingSettings() {
        const cpus = os.cpus().length;
        const totalMemory = os.totalmem();
        const platform = process.platform;
        const totalMemoryGB = totalMemory / (1024 * 1024 * 1024);

        let settings = {
            frameRate: 30,
            videoBitrate: 4000000, // 4 Mbps
            audioBitrate: 128000,  // 128 kbps
            videoQuality: 'medium',
            resolution: { width: 1920, height: 1080 }
        };

        // High-end system detection
        if (cpus >= 8 && totalMemoryGB > 16) {
            settings = {
                frameRate: 60,
                videoBitrate: 8000000, // 8 Mbps
                audioBitrate: 192000,  // 192 kbps
                videoQuality: 'high',
                resolution: { width: 2560, height: 1440 }
            };
        }
        // Low-end system detection
        else if (cpus < 4 || totalMemoryGB < 8) {
            settings = {
                frameRate: 24,
                videoBitrate: 2000000, // 2 Mbps
                audioBitrate: 96000,   // 96 kbps
                videoQuality: 'low',
                resolution: { width: 1280, height: 720 }
            };
        }

        console.log(`Electron Main: Optimal recording settings for ${platform} (${cpus} CPUs, ${totalMemoryGB.toFixed(1)}GB RAM):`, settings);
        return settings;
    }
}

// Create and export the recording handler
const recordingHandler = new RecordingHandler();

module.exports = { RecordingHandler, recordingHandler };