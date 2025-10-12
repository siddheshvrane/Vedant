// ScreenRecordingHelper.js - Complete Recording Business Logic
// Handles all recording operations, device detection, and UI coordination

import { ScreenRecordingService } from '../../../../../services/ScreenRecordingService.js';
import { PopupService } from '../../../../../services/PopupService.js';
import { markRaw } from 'vue';
import RecordingConfigPopup from '../../../../Popup/popups/RecordingConfigPopup.vue';

export class ScreenRecordingHelper {
    constructor() {
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.recordingStartTime = null;
        this.progressInterval = null;
        this.currentStream = null;
        this.isElectron = !!(window.electron);
        this.desktopSources = [];
        this.selectedDesktopSource = null;
        this.permissionGranted = false;
        this.audioDevices = [];
        this.initializationPromise = null;
    }

    /**
     * Check if recording is supported
     */
    static isSupported() {
        try {
            const isElectron = !!(window.electron);
            
            if (!isElectron) {
                return false;
            }

            return !!(window.electron.getDesktopSources) && !!window.MediaRecorder;
        } catch (error) {
            console.warn('ScreenRecordingHelper: Support check failed:', error);
            return false;
        }
    }

    /**
     * Get environment information
     */
    static getEnvironmentInfo() {
        const isElectron = !!(window.electron);
        
        return {
            isElectron: isElectron,
            hasDesktopCapturer: isElectron ? !!(window.electron.getDesktopSources) : false,
            hasMediaRecorder: !!window.MediaRecorder,
            protocol: window.location.protocol,
            hostname: window.location.hostname,
            canRecord: this.isSupported(),
            supportedMethod: 'Electron desktopCapturer only'
        };
    }

    /**
     * Check recording availability with user-friendly status
     */
    static checkRecordingAvailability() {
        const envInfo = this.getEnvironmentInfo();
        const isSecureContext = window.isSecureContext || 
            envInfo.hostname === 'localhost' || 
            envInfo.hostname === '127.0.0.1';
        
        return {
            supported: envInfo.canRecord,
            isElectron: envInfo.isElectron,
            electronSupported: envInfo.canRecord,
            secureContext: isSecureContext,
            reason: !envInfo.isElectron ? 'Screen recording optimized for Electron desktop app' :
                   !envInfo.hasDesktopCapturer ? 'Electron desktopCapturer not available' :
                   !envInfo.hasMediaRecorder ? 'MediaRecorder API not available' :
                   'Recording available',
            preferredMethod: envInfo.isElectron ? 'Electron desktopCapturer' : 'Not available'
        };
    }

    /**
     * Initialize audio devices
     */
    async initializeAudioDevices() {
        if (this.initializationPromise) {
            return this.initializationPromise;
        }

        this.initializationPromise = this._initializeAudioDevicesInternal();
        return this.initializationPromise;
    }

    async _initializeAudioDevicesInternal() {
        try {
            const audioDevicesList = [
                { id: 'none', label: 'No Audio', type: 'none' },
                { id: 'default', label: 'System Default Microphone', type: 'default' }
            ];

            // Try Electron-specific detection first
            if (this.isElectron && window.electron.getAudioDevices) {
                try {
                    const electronDevices = await window.electron.getAudioDevices();
                    
                    if (electronDevices && electronDevices.length > 0) {
                        const uniqueDevices = electronDevices.filter(device => 
                            device.id !== 'none' && device.id !== 'default'
                        );
                        
                        audioDevicesList.push(...uniqueDevices);
                        this.audioDevices = audioDevicesList;
                        ScreenRecordingService.updateAvailableDevices(audioDevicesList);
                        
                        await this._supplementWithBrowserDevices(audioDevicesList);
                        return;
                    }
                } catch (electronError) {
                    console.warn('ScreenRecordingHelper: Electron audio detection failed:', electronError);
                }
            }

            // Browser-based detection
            await this._detectBrowserAudioDevices(audioDevicesList);

        } catch (error) {
            console.error('ScreenRecordingHelper: Failed to initialize audio devices:', error);
            const fallback = [
                { id: 'none', label: 'No Audio', type: 'none' },
                { id: 'default', label: 'System Default Microphone', type: 'default' }
            ];
            this.audioDevices = fallback;
            ScreenRecordingService.updateAvailableDevices(fallback);
        }
    }

    async _detectBrowserAudioDevices(devicesList) {
        try {
            const devicesBeforePermission = await navigator.mediaDevices.enumerateDevices();
            const hasLabels = devicesBeforePermission.some(d => d.label && d.label.trim() !== '');
            
            if (!hasLabels) {
                try {
                    const permissionStream = await navigator.mediaDevices.getUserMedia({
                        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
                    });

                    this.permissionGranted = true;
                    permissionStream.getTracks().forEach(track => track.stop());
                    await new Promise(resolve => setTimeout(resolve, 200));
                } catch (permissionError) {
                    console.warn('ScreenRecordingHelper: Permission denied:', permissionError);
                    devicesList.push({
                        id: 'permission-denied',
                        label: 'Microphone Permission Required',
                        type: 'disabled',
                        disabled: true
                    });
                    this.audioDevices = devicesList;
                    ScreenRecordingService.updateAvailableDevices(devicesList);
                    return;
                }
            } else {
                this.permissionGranted = true;
            }

            const devicesAfterPermission = await navigator.mediaDevices.enumerateDevices();
            const audioInputs = devicesAfterPermission.filter(device => device.kind === 'audioinput');

            const deviceMap = new Map();
            
            audioInputs.forEach((device, index) => {
                if (!device.deviceId || device.deviceId === 'default' || device.deviceId === 'communications') {
                    return;
                }

                const label = device.label || `Microphone ${index + 1}`;
                const deviceType = this._detectDeviceType(label);
                const enhancedLabel = this._enhanceDeviceLabel(label, deviceType);

                if (!deviceMap.has(device.deviceId)) {
                    deviceMap.set(device.deviceId, {
                        id: device.deviceId,
                        label: enhancedLabel,
                        originalLabel: label,
                        type: deviceType,
                        groupId: device.groupId || null
                    });
                }
            });

            const uniqueDevices = Array.from(deviceMap.values());
            this._sortDevicesByType(uniqueDevices);

            devicesList.push(...uniqueDevices);
            this.audioDevices = devicesList;
            ScreenRecordingService.updateAvailableDevices(devicesList);

            this._setupDeviceChangeListener();

        } catch (error) {
            console.error('ScreenRecordingHelper: Browser audio detection failed:', error);
            devicesList.push({
                id: 'unavailable',
                label: 'Audio devices unavailable',
                type: 'disabled',
                disabled: true
            });
            this.audioDevices = devicesList;
            ScreenRecordingService.updateAvailableDevices(devicesList);
        }
    }

    _detectDeviceType(label) {
        const labelLower = label.toLowerCase();
        
        if (labelLower.includes('bluetooth') || labelLower.includes('airpods') || 
            labelLower.includes('buds') || labelLower.includes('beats')) {
            return 'bluetooth';
        } else if (labelLower.includes('headset') || labelLower.includes('headphones')) {
            return 'headset';
        } else if (labelLower.includes('usb') || labelLower.includes('external')) {
            return 'usb';
        } else if (labelLower.includes('built-in') || labelLower.includes('internal')) {
            return 'builtin';
        } else if (labelLower.includes('line') || labelLower.includes('aux')) {
            return 'aux';
        } else if (labelLower.includes('camera') || labelLower.includes('webcam')) {
            return 'webcam';
        }
        return 'microphone';
    }

    _enhanceDeviceLabel(label, deviceType) {
        const icons = {
            bluetooth: '🎧',
            headset: '🎧',
            usb: '🔌',
            builtin: '💻',
            aux: '🔊',
            webcam: '📷'
        };
        
        return icons[deviceType] ? `${icons[deviceType]} ${label}` : label;
    }

    _sortDevicesByType(devices) {
        const sortOrder = { bluetooth: 1, headset: 2, usb: 3, aux: 4, builtin: 5, webcam: 6, microphone: 7 };
        devices.sort((a, b) => {
            const orderA = sortOrder[a.type] || 99;
            const orderB = sortOrder[b.type] || 99;
            if (orderA !== orderB) return orderA - orderB;
            return a.label.localeCompare(b.label);
        });
    }

    async _supplementWithBrowserDevices(existingDevices) {
        try {
            if (!this.permissionGranted) {
                const permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                permissionStream.getTracks().forEach(track => track.stop());
                this.permissionGranted = true;
                await new Promise(resolve => setTimeout(resolve, 200));
            }

            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioInputs = devices.filter(d => d.kind === 'audioinput');
            const existingIds = new Set(existingDevices.map(d => d.id));

            audioInputs.forEach(device => {
                if (device.deviceId && !existingIds.has(device.deviceId) && device.label) {
                    const deviceType = this._detectDeviceType(device.label);
                    existingDevices.push({
                        id: device.deviceId,
                        label: device.label,
                        type: deviceType
                    });
                }
            });

            this.audioDevices = existingDevices;
            ScreenRecordingService.updateAvailableDevices(existingDevices);
        } catch (error) {
            console.warn('ScreenRecordingHelper: Failed to supplement devices:', error);
        }
    }

    _setupDeviceChangeListener() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.addEventListener) return;

        try {
            navigator.mediaDevices.addEventListener('devicechange', async () => {
                const currentDevices = [...this.audioDevices.filter(d => d.id === 'none' || d.id === 'default')];
                await this._detectBrowserAudioDevices(currentDevices);
            });
        } catch (error) {
            console.warn('ScreenRecordingHelper: Failed to setup device listener:', error);
        }
    }

    /**
     * Initialize recording setup with configuration dialog
     */
    static async initializeRecording() {
        try {
            const helper = new ScreenRecordingHelper();
            const recordingStatus = this.checkRecordingAvailability();
            
            if (!recordingStatus.supported) {
                throw new Error(`Recording not available: ${recordingStatus.reason}`);
            }

            await helper.initializeAudioDevices();
            const audioDevices = helper.audioDevices;

            const recordingChoice = await this.showRecordingChoiceDialog();
            
            if (recordingChoice.cancelled) {
                throw new Error('Recording setup cancelled by user');
            }

            if (!recordingChoice.enableRecording) {
                return { recordingEnabled: false, cancelled: false };
            }

            const recordingConfig = await this.showRecordingConfigPopup(audioDevices);
            
            if (recordingConfig.cancelled) {
                throw new Error('Recording configuration cancelled by user');
            }

            if (recordingConfig.audioSource !== 'skip') {
                ScreenRecordingService.updateRecordingConfig({ audioSource: recordingConfig.audioSource });
            }

            return {
                recordingEnabled: true,
                cancelled: false,
                audioSource: recordingConfig.audioSource,
                config: recordingConfig,
                helper: helper
            };

        } catch (error) {
            console.error('ScreenRecordingHelper: Recording initialization failed:', error);
            throw error;
        }
    }

    /**
     * Start recording
     */
    async startRecording(config) {
        try {
            if (!this.isElectron) {
                throw new Error('Screen recording only available in Electron');
            }

            await this._initializeDesktopSources();
            
            const screenStream = await this._getScreenStream();
            let audioStream = null;

            if (config.audioSource && config.audioSource !== 'none') {
                try {
                    audioStream = await this._getAudioStream(config.audioSource);
                } catch (audioError) {
                    console.warn('ScreenRecordingHelper: Audio failed:', audioError);
                }
            }

            const combinedStream = this._combineStreams(screenStream, audioStream);
            const mimeType = this._getSupportedMimeType();

            this.mediaRecorder = new MediaRecorder(combinedStream, {
                mimeType: mimeType,
                videoBitsPerSecond: 4000000,
                audioBitsPerSecond: 128000
            });

            this.recordedChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };

            this.mediaRecorder.onerror = (event) => {
                console.error('ScreenRecordingHelper: MediaRecorder error:', event.error);
                this.cleanup();
            };

            this.mediaRecorder.start(1000);
            this.recordingStartTime = Date.now();
            this.currentStream = combinedStream;

            ScreenRecordingService.updateRecordingState(true);
            this._startProgressTracking();

            return true;
        } catch (error) {
            console.error('ScreenRecordingHelper: Failed to start recording:', error);
            this.cleanup();
            throw error;
        }
    }

    async _initializeDesktopSources() {
        if (!this.isElectron) return;

        try {
            this.desktopSources = await window.electron.getDesktopSources({
                types: ['screen', 'window'],
                thumbnailSize: { width: 150, height: 150 },
                fetchWindowIcons: false
            });

            this.selectedDesktopSource = this.desktopSources.find(s => s.type === 'screen') || this.desktopSources[0];
        } catch (error) {
            console.error('ScreenRecordingHelper: Failed to get desktop sources:', error);
            throw error;
        }
    }

    async _getScreenStream() {
        if (!this.selectedDesktopSource) {
            throw new Error('No desktop source selected');
        }

        const constraints = {
            audio: false,
            video: {
                mandatory: {
                    chromeMediaSource: 'desktop',
                    chromeMediaSourceId: this.selectedDesktopSource.id,
                    maxWidth: 1920,
                    maxHeight: 1080,
                    maxFrameRate: 30
                }
            }
        };

        return await navigator.mediaDevices.getUserMedia(constraints);
    }

    async _getAudioStream(deviceId) {
        const constraints = {
            audio: {
                deviceId: deviceId === 'default' ? 'default' : { exact: deviceId },
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
            }
        };

        return await navigator.mediaDevices.getUserMedia(constraints);
    }

    _combineStreams(screenStream, audioStream) {
        const combinedStream = new MediaStream();

        screenStream.getVideoTracks().forEach(track => {
            combinedStream.addTrack(track);
        });

        if (audioStream) {
            audioStream.getAudioTracks().forEach(track => {
                combinedStream.addTrack(track);
            });
        }

        return combinedStream;
    }

    _getSupportedMimeType() {
        const types = [
            'video/webm; codecs=vp9,opus',
            'video/webm; codecs=vp8,opus',
            'video/webm'
        ];

        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) {
                return type;
            }
        }

        return 'video/webm';
    }

    _startProgressTracking() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
        }

        this.progressInterval = setInterval(() => {
            if (this.recordingStartTime) {
                const duration = (Date.now() - this.recordingStartTime) / 1000;
                const size = this.recordedChunks.reduce((total, chunk) => total + chunk.size, 0);
                ScreenRecordingService.updateRecordingProgress({ duration, size });
            }
        }, 1000);
    }

    /**
     * Stop recording
     */
    async stopRecording() {
        return new Promise((resolve, reject) => {
            if (!this.mediaRecorder) {
                resolve(null);
                return;
            }

            this.mediaRecorder.onstop = async () => {
                try {
                    if (this.recordedChunks.length === 0) {
                        throw new Error('No recording data');
                    }

                    const recordingBlob = new Blob(this.recordedChunks, {
                        type: this._getSupportedMimeType()
                    });

                    const recordingInfo = {
                        size: recordingBlob.size,
                        sizeFormatted: this._formatFileSize(recordingBlob.size),
                        duration: (Date.now() - this.recordingStartTime) / 1000,
                        durationFormatted: this._formatDuration((Date.now() - this.recordingStartTime) / 1000),
                        format: 'webm',
                        timestamp: new Date().toISOString()
                    };

                    this.cleanup(false);
                    resolve({ blob: recordingBlob, info: recordingInfo });
                } catch (error) {
                    this.cleanup();
                    reject(error);
                }
            };

            if (this.mediaRecorder.state === 'recording') {
                this.mediaRecorder.requestData();
                this.mediaRecorder.stop();
            }
        });
    }

    /**
     * Download recording
     */
    static async downloadRecording(blob, filename) {
        try {
            if (!window.electron || !window.electron.saveRecording) {
                throw new Error('Download only available in Electron');
            }

            const arrayBuffer = await blob.arrayBuffer();
            const result = await window.electron.saveRecording(arrayBuffer, filename, blob.type);
            
            if (result.success) {
                PopupService.showNotification(`Recording saved: ${result.filePath}`);
                return result;
            } else {
                throw new Error(result.error || 'Save failed');
            }
        } catch (error) {
            console.error('ScreenRecordingHelper: Download failed:', error);
            throw error;
        }
    }

    cleanup(clearChunks = true) {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }

        if (this.currentStream) {
            this.currentStream.getTracks().forEach(track => track.stop());
            this.currentStream = null;
        }

        if (clearChunks) {
            this.recordedChunks = [];
        }

        this.mediaRecorder = null;
        this.recordingStartTime = null;
        ScreenRecordingService.updateRecordingState(false);
        ScreenRecordingService.updateRecordingProgress({ duration: 0, size: 0 });
    }

    // Dialogs
    static async showRecordingChoiceDialog() {
        return new Promise((resolve) => {
            PopupService.showConfirmation(
                'Would you like to record this flythrough?',
                'Record Flythrough?',
                'Yes, Record',
                'No, Skip Recording'
            ).then((enable) => resolve({ cancelled: false, enableRecording: enable }))
              .catch(() => resolve({ cancelled: true }));
        });
    }

    static async showRecordingConfigPopup(audioDevices) {
        return new Promise((resolve) => {
            PopupService.show({
                component: markRaw(RecordingConfigPopup),
                title: "Configure Screen Recording",
                props: {
                    audioDevices: audioDevices,
                    currentConfig: { audioSource: 'none' },
                    onStart: (config) => resolve({ cancelled: false, ...config }),
                    onCancel: () => resolve({ cancelled: true })
                }
            });
        });
    }

    // Utility methods
    _formatDuration(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    _formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    static formatDuration(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    static formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    static addRecordingContextToInstructions(baseInstructions, toolName) {
        const status = this.checkRecordingAvailability();
        if (!status.supported) {
            return baseInstructions + "\n\n⚠️ Screen recording not available. Tool will work without recording.";
        }
        return baseInstructions + " with optional screen recording.";
    }
}