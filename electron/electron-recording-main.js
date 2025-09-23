// electron/electron-recording-main.js - FIXED VERSION

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
        console.log('Electron Main: RecordingHandler initialized successfully');
    }

    setupIpcHandlers() {
        // Handle getting desktop sources for screen capture
        ipcMain.handle('get-desktop-sources', this.handleGetDesktopSources.bind(this));

        // Handle getting available audio devices
        ipcMain.handle('get-audio-devices', this.handleGetAudioDevices.bind(this));

        // Handle getting system audio stream details
        ipcMain.handle('get-system-audio', this.handleGetSystemAudio.bind(this));

        // Handle saving the recorded file - Fixed to handle all parameters properly
        ipcMain.handle('save-recording', this.handleSaveRecording.bind(this));

        // Handle getting recording capabilities
        ipcMain.handle('get-recording-capabilities', this.handleGetRecordingCapabilities.bind(this));

        // Test handler for API connectivity
        ipcMain.handle('test-electron-api', this.handleTestAPI.bind(this));

        console.log('Electron Main: All recording IPC handlers registered successfully');
    }

    // Test API connectivity
    async handleTestAPI(event) {
        console.log('Electron Main: API test requested');
        return {
            success: true,
            platform: process.platform,
            nodeVersion: process.versions.node,
            electronVersion: process.versions.electron,
            timestamp: new Date().toISOString()
        };
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
                display_id: source.display_id || source.id,
                appIcon: source.appIcon ? source.appIcon.toDataURL() : null,
                type: source.id.startsWith('screen:') ? 'screen' : 'window'
            }));

            // Prioritize screen sources
            const screenSources = formattedSources.filter(s => s.type === 'screen');
            const windowSources = formattedSources.filter(s => s.type === 'window');
            const orderedSources = [...screenSources, ...windowSources];

            console.log(`Electron Main: Found ${orderedSources.length} desktop sources (${screenSources.length} screens, ${windowSources.length} windows)`);
            return orderedSources;

        } catch (error) {
            console.error('Electron Main: Failed to get desktop sources:', error);
            return []; // Return empty array instead of throwing
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
            // Provide a reliable fallback
            return [
                { id: 'none', label: 'No Audio', type: 'none' },
                { id: 'default', label: 'System Default Microphone', type: 'default' }
            ];
        }
    }

    async handleGetSystemAudio() {
        try {
            console.log('Electron Main: Getting system audio stream configuration...');
            const audioConfig = await this.getSystemAudioConfig();
            console.log('Electron Main: System audio config generated:', audioConfig.type);
            return audioConfig;

        } catch (error) {
            console.error('Electron Main: Failed to get system audio:', error);
            throw error;
        }
    }

    async handleSaveRecording(event, arrayBuffer, suggestedName, mimeType = 'video/webm') {
        try {
            console.log('Electron Main: Saving recording with details:', {
                suggestedName,
                mimeType,
                bufferSize: arrayBuffer.byteLength,
                bufferType: arrayBuffer.constructor.name
            });

            // Validate input parameters
            if (!arrayBuffer || arrayBuffer.byteLength === 0) {
                throw new Error('Invalid or empty recording data');
            }

            if (!suggestedName || typeof suggestedName !== 'string') {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0];
                suggestedName = `flythrough-recording-${timestamp}`;
            }

            // Determine file extension based on MIME type
            let extension = 'webm';
            if (mimeType && typeof mimeType === 'string') {
                if (mimeType.includes('mp4')) extension = 'mp4';
                else if (mimeType.includes('avi')) extension = 'avi';
                else if (mimeType.includes('mov')) extension = 'mov';
                else if (mimeType.includes('mkv')) extension = 'mkv';
            }

            // Ensure the suggested filename has the correct extension
            const nameWithoutExt = suggestedName.replace(/\.[^/.]+$/, '');
            const finalSuggestedName = `${nameWithoutExt}.${extension}`;

            // Create default save path
            const defaultPath = path.join(os.homedir(), 'Downloads', finalSuggestedName);

            console.log('Electron Main: Showing save dialog with path:', defaultPath);

            const { canceled, filePath } = await dialog.showSaveDialog({
                title: 'Save Flythrough Recording',
                defaultPath: defaultPath,
                filters: [
                    { name: 'WebM Video', extensions: ['webm'] },
                    { name: 'MP4 Video', extensions: ['mp4'] },
                    { name: 'AVI Video', extensions: ['avi'] },
                    { name: 'MOV Video', extensions: ['mov'] },
                    { name: 'MKV Video', extensions: ['mkv'] },
                    { name: 'All Files', extensions: ['*'] }
                ],
                properties: ['createDirectory', 'showOverwriteConfirmation']
            });

            if (canceled || !filePath) {
                console.log('Electron Main: Save dialog was cancelled by user');
                return { success: false, cancelled: true };
            }

            console.log('Electron Main: User selected save path:', filePath);

            // Convert ArrayBuffer to Buffer and write file
            const buffer = Buffer.from(arrayBuffer);
            console.log('Electron Main: Buffer created, size:', buffer.length);

            // Ensure directory exists
            const dir = path.dirname(filePath);
            await fs.mkdir(dir, { recursive: true });

            // Write file
            await fs.writeFile(filePath, buffer);

            // Verify file was written
            const stats = await fs.stat(filePath);
            console.log(`Electron Main: Recording saved successfully to: ${filePath}`);
            console.log(`Electron Main: File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

            return {
                success: true,
                filePath: filePath,
                fileSize: stats.size,
                fileName: path.basename(filePath)
            };

        } catch (error) {
            console.error('Electron Main: Failed to save recording:', error);
            return {
                success: false,
                error: error.message,
                details: error.stack
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
                platform: process.platform,
                desktopCapturerSupported: true,
                recommendedSettings: this.getOptimalRecordingSettings()
            };

            console.log('Electron Main: Recording capabilities compiled:', JSON.stringify(capabilities, null, 2));
            return capabilities;

        } catch (error) {
            console.error('Electron Main: Failed to get recording capabilities:', error);
            // Provide safe fallback
            return {
                supportedFormats: ['webm'],
                supportedCodecs: { video: ['vp8'], audio: ['opus'] },
                maxResolution: { width: 1920, height: 1080 },
                maxFrameRate: 60,
                systemAudioSupported: false,
                platform: process.platform,
                desktopCapturerSupported: false,
                recommendedSettings: {
                    frameRate: 30,
                    videoBitrate: 2000000,
                    audioBitrate: 128000,
                    resolution: { width: 1920, height: 1080 }
                }
            };
        }
    }

    /**
     * Get system audio devices based on platform with enhanced error handling
     */
    async getSystemAudioDevices() {
        const baseDevices = [
            { id: 'none', label: 'No Audio', type: 'none' },
            { id: 'default', label: 'System Default Microphone', type: 'default' }
        ];

        try {
            // Platform-specific audio device detection with timeout
            const devicePromise = (() => {
                switch (process.platform) {
                    case 'win32':
                        return this.getWindowsAudioDevices();
                    case 'darwin':
                        return this.getMacAudioDevices();
                    case 'linux':
                        return this.getLinuxAudioDevices();
                    default:
                        console.log('Electron Main: Unknown platform, using base devices only');
                        return Promise.resolve([]);
                }
            })();

            // Add timeout to prevent hanging
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Audio device detection timeout')), 10000);
            });

            const platformDevices = await Promise.race([devicePromise, timeoutPromise]);
            const allDevices = [...baseDevices, ...platformDevices];

            console.log(`Electron Main: Platform device detection successful, total devices: ${allDevices.length}`);
            return allDevices;

        } catch (error) {
            console.error('Electron Main: Platform audio device detection failed:', error);
            console.log('Electron Main: Falling back to base devices only');
            return baseDevices;
        }
    }

    /**
     * Windows audio device detection with improved error handling
     */
    async getWindowsAudioDevices() {
        try {
            // Use more reliable WMI query
            const command = `
                Get-WmiObject -Class Win32_SoundDevice |
                Where-Object {$_.Status -eq "OK" -and $_.Name -ne $null} |
                Select-Object Name, DeviceID |
                ConvertTo-Json
            `.replace(/\s+/g, ' ').trim();

            const { stdout, stderr } = await execAsync(`powershell -Command "${command}"`, {
                timeout: 8000
            });

            if (stderr) {
                console.warn('Electron Main: Windows audio detection stderr:', stderr);
            }

            if (!stdout.trim()) {
                console.log('Electron Main: No Windows audio devices found via PowerShell');
                return [];
            }

            let devices;
            try {
                devices = JSON.parse(stdout);
            } catch (parseError) {
                console.error('Electron Main: Failed to parse Windows audio devices JSON:', parseError);
                return [];
            }

            const deviceArray = Array.isArray(devices) ? devices : [devices];

            const formattedDevices = deviceArray
                .filter(device => device && device.Name && typeof device.Name === 'string')
                .map(device => {
                    const name = device.Name.trim();
                    let deviceType = 'microphone';

                    const nameLower = name.toLowerCase();
                    if (nameLower.includes('bluetooth')) deviceType = 'bluetooth';
                    else if (nameLower.includes('headset') || nameLower.includes('headphones')) deviceType = 'headset';
                    else if (nameLower.includes('usb')) deviceType = 'usb';

                    return {
                        id: device.DeviceID || `windows-${name.replace(/\s+/g, '-').toLowerCase()}`,
                        label: name,
                        type: deviceType
                    };
                });

            console.log(`Electron Main: Found ${formattedDevices.length} Windows audio devices`);
            return formattedDevices;

        } catch (error) {
            console.error('Electron Main: Windows audio device detection failed:', error);
            return [];
        }
    }

    /**
     * macOS audio device detection with improved error handling
     */
    async getMacAudioDevices() {
        try {
            const { stdout, stderr } = await execAsync('system_profiler SPAudioDataType -json', {
                timeout: 8000
            });

            if (stderr) {
                console.warn('Electron Main: macOS audio detection stderr:', stderr);
            }

            const audioData = JSON.parse(stdout);
            const devices = [];

            if (audioData.SPAudioDataType) {
                audioData.SPAudioDataType.forEach(audioItem => {
                    if (audioItem._items) {
                        audioItem._items.forEach(device => {
                            if (device._name && typeof device._name === 'string') {
                                const name = device._name.trim();
                                let deviceType = 'microphone';

                                const nameLower = name.toLowerCase();
                                if (nameLower.includes('bluetooth')) deviceType = 'bluetooth';
                                else if (nameLower.includes('headset') || nameLower.includes('headphones')) deviceType = 'headset';
                                else if (nameLower.includes('usb')) deviceType = 'usb';
                                else if (nameLower.includes('built-in')) deviceType = 'builtin';

                                devices.push({
                                    id: `mac-${name.replace(/\s+/g, '-').toLowerCase()}`,
                                    label: name,
                                    type: deviceType
                                });
                            }
                        });
                    }
                });
            }

            console.log(`Electron Main: Found ${devices.length} macOS audio devices`);
            return devices;

        } catch (error) {
            console.error('Electron Main: macOS audio device detection failed:', error);
            return [];
        }
    }

    /**
     * Linux audio device detection with improved error handling
     */
    async getLinuxAudioDevices() {
        try {
            const { stdout, stderr } = await execAsync('pactl list sources short 2>/dev/null || echo ""', {
                timeout: 8000
            });

            if (stderr) {
                console.warn('Electron Main: Linux audio detection stderr:', stderr);
            }

            if (!stdout.trim()) {
                console.log('Electron Main: No Linux audio sources found');
                return [];
            }

            const lines = stdout.trim().split('\n').filter(line => line.trim());

            const devices = lines
                .filter(line => !line.includes('monitor')) // Exclude monitor sources
                .map(line => {
                    const parts = line.split('\t');
                    const deviceName = parts[1] || '';
                    const description = parts[4] || deviceName;

                    if (!deviceName || !description) return null;

                    let deviceType = 'microphone';
                    const descLower = description.toLowerCase();
                    if (descLower.includes('bluetooth')) deviceType = 'bluetooth';
                    else if (descLower.includes('headset') || descLower.includes('headphones')) deviceType = 'headset';
                    else if (descLower.includes('usb')) deviceType = 'usb';
                    else if (descLower.includes('built-in') || descLower.includes('internal')) deviceType = 'builtin';

                    return {
                        id: `linux-${deviceName.replace(/[^a-zA-Z0-9]/g, '-')}`,
                        label: description || 'Linux Audio Device',
                        type: deviceType
                    };
                })
                .filter(device => device && device.id && device.label);

            console.log(`Electron Main: Found ${devices.length} Linux audio devices`);
            return devices;

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
            supported: true,
            instructions: 'Windows system audio should work automatically',
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
        const hasBlackHole = await this.checkMacVirtualAudioDevice();

        return {
            type: 'virtual-audio-device',
            deviceId: hasBlackHole ? 'BlackHole' : null,
            supported: hasBlackHole,
            instructions: hasBlackHole
                ? 'BlackHole virtual audio device detected'
                : 'Install BlackHole virtual audio device for system audio capture',
            downloadUrl: 'https://existential.audio/blackhole/',
            constraints: {
                audio: {
                    deviceId: hasBlackHole ? { exact: 'BlackHole' } : undefined,
                    echoCancellation: false,
                    autoGainControl: false,
                    noiseSuppression: false
                }
            }
        };
    }

    async getLinuxSystemAudio() {
        const hasPulseAudio = await this.checkLinuxPulseAudio();

        return {
            type: 'pulseaudio-loopback',
            deviceId: hasPulseAudio ? 'default.monitor' : null,
            supported: hasPulseAudio,
            instructions: hasPulseAudio
                ? 'PulseAudio system audio should work'
                : 'Install PulseAudio for system audio capture',
            constraints: {
                audio: {
                    deviceId: hasPulseAudio ? { exact: 'default.monitor' } : undefined,
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
        try {
            switch (process.platform) {
                case 'win32':
                    return true; // Windows has native support
                case 'darwin':
                    return await this.checkMacVirtualAudioDevice();
                case 'linux':
                    return await this.checkLinuxPulseAudio();
                default:
                    return false;
            }
        } catch (error) {
            console.error('Electron Main: System audio support check failed:', error);
            return false;
        }
    }

    async checkMacVirtualAudioDevice() {
        try {
            const { stdout } = await execAsync('system_profiler SPAudioDataType -json', { timeout: 5000 });
            const audioData = JSON.parse(stdout);

            let hasVirtualDevice = false;
            if (audioData.SPAudioDataType) {
                audioData.SPAudioDataType.forEach(audioItem => {
                    if (audioItem._items) {
                        audioItem._items.forEach(device => {
                            const name = (device._name || '').toLowerCase();
                            if (name.includes('blackhole') || name.includes('soundflower') || name.includes('virtual')) {
                                hasVirtualDevice = true;
                                console.log('Electron Main: Virtual audio device found:', device._name);
                            }
                        });
                    }
                });
            }

            console.log('Electron Main: macOS virtual audio device check:', hasVirtualDevice);
            return hasVirtualDevice;

        } catch (error) {
            console.error('Electron Main: Failed to check macOS virtual audio device:', error);
            return false;
        }
    }

    async checkLinuxPulseAudio() {
        try {
            await execAsync('which pactl', { timeout: 3000 });
            console.log('Electron Main: PulseAudio detected on Linux');
            return true;
        } catch (error) {
            console.log('Electron Main: PulseAudio not available on Linux');
            return false;
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

    /**
     * Clean up resources and temporary files
     */
    async cleanup() {
        console.log('Electron Main: RecordingHandler cleanup started');

        try {
            // Clean up any temporary files if they exist
            const tempDir = path.join(os.tmpdir(), 'flythrough-recordings');
            try {
                await fs.rmdir(tempDir, { recursive: true });
                console.log('Electron Main: Cleaned up temporary directory');
            } catch (cleanupError) {
                // Ignore cleanup errors - directory might not exist
            }

            console.log('Electron Main: RecordingHandler cleanup completed');
        } catch (error) {
            console.error('Electron Main: Cleanup error:', error);
        }
    }
}

// Create and export the recording handler
const recordingHandler = new RecordingHandler();

// Handle app cleanup
if (process && process.on) {
    process.on('exit', () => {
        recordingHandler.cleanup();
    });

    process.on('SIGINT', () => {
        recordingHandler.cleanup();
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        recordingHandler.cleanup();
        process.exit(0);
    });
}

module.exports = { RecordingHandler, recordingHandler };