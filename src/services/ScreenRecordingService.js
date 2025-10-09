// ScreenRecordingService.js - Pure Electron desktopCapturer implementation
// Fixed ArrayBuffer conversion for Electron IPC

import { BehaviorSubject } from 'rxjs';
import { PopupService } from './PopupService.js';

class ScreenRecordingServiceClass {
    constructor() {
        // Recording state observables
        this.isRecording$ = new BehaviorSubject(false);
        this.recordingProgress$ = new BehaviorSubject({ duration: 0, size: 0 });
        this.availableAudioDevices$ = new BehaviorSubject([]);

        // Recording configuration
        this.recordingConfig = {
            audioSource: 'none',
            videoFormat: 'webm',
            frameRate: 30,
            videoWidth: 1920,
            videoHeight: 1080,
        };

        // Recording state
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.recordingStartTime = null;
        this.progressInterval = null;
        this.currentStream = null;
        this.audioDevices = [];
        this.initializationPromise = null;

        // Electron-specific state
        this.isElectron = !!(window.electron);
        this.desktopSources = [];
        this.selectedDesktopSource = null;

        console.log('ScreenRecording: Initializing service...');
        console.log('ScreenRecording: Electron environment:', this.isElectron);

        // Initialize immediately
        this.initializeAudioDevices();
        if (this.isElectron) {
            this.initializeDesktopSources();
        } else {
            console.warn('ScreenRecording: Non-Electron environment detected - screen recording not available');
        }
    }

    /**
     * Support check - ONLY supports Electron with desktopCapturer
     */
    static isSupported() {
        try {
            const isElectron = !!(window.electron);
            
            if (!isElectron) {
                console.log('ScreenRecording: Not in Electron environment - screen recording unavailable');
                return false;
            }

            const hasDesktopCapturer = !!(window.electron.getDesktopSources);
            const hasMediaRecorder = !!window.MediaRecorder;
            
            console.log('ScreenRecording: Electron support check:', {
                isElectron,
                hasDesktopCapturer,
                hasMediaRecorder
            });

            return hasDesktopCapturer && hasMediaRecorder;
        } catch (error) {
            console.warn('ScreenRecording: Support check failed:', error);
            return false;
        }
    }

    /**
     * Get environment info
     */
    static getEnvironmentInfo() {
        const isElectron = !!(window.electron);
        
        return {
            isElectron: isElectron,
            hasDesktopCapturer: isElectron ? !!(window.electron.getDesktopSources) : false,
            hasMediaRecorder: !!window.MediaRecorder,
            userAgent: navigator.userAgent.substring(0, 100),
            canRecord: this.isSupported(),
            supportedMethod: 'Electron desktopCapturer only'
        };
    }

    /**
     * Initialize Electron desktop sources
     */
    async initializeDesktopSources() {
        if (!this.isElectron) {
            console.warn('ScreenRecording: Cannot initialize desktop sources - not in Electron');
            return;
        }

        try {
            console.log('ScreenRecording: Getting desktop sources from Electron...');
            
            const sources = await window.electron.getDesktopSources({
                types: ['screen', 'window'],
                thumbnailSize: { width: 150, height: 150 },
                fetchWindowIcons: false
            });

            this.desktopSources = sources;
            console.log(`ScreenRecording: Found ${sources.length} desktop sources`);
            
            // Log available sources for debugging
            sources.forEach((source, index) => {
                console.log(`ScreenRecording: Source ${index}: "${source.name}" (${source.type}) - ID: ${source.id}`);
            });

            // Auto-select the first screen source, or first available source
            this.selectedDesktopSource = sources.find(source => source.type === 'screen') || sources[0];
            if (this.selectedDesktopSource) {
                console.log(`ScreenRecording: Auto-selected source: "${this.selectedDesktopSource.name}"`);
            }

        } catch (error) {
            console.error('ScreenRecording: Failed to get desktop sources:', error);
            this.desktopSources = [];
            this.selectedDesktopSource = null;
        }
    }

    /**
     * Initialize audio devices (supports both Electron and browser)
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
            console.log('ScreenRecording: Initializing audio devices...');

            if (this.isElectron && window.electron.getAudioDevices) {
                console.log('ScreenRecording: Using Electron audio device detection');
                try {
                    const electronDevices = await window.electron.getAudioDevices();
                    this.audioDevices = electronDevices;
                    this.availableAudioDevices$.next(electronDevices);
                    console.log(`ScreenRecording: Electron audio devices detected: ${electronDevices.length}`);
                    return;
                } catch (electronError) {
                    console.warn('ScreenRecording: Electron audio detection failed, falling back to browser:', electronError);
                }
            }

            console.log('ScreenRecording: Using browser audio device detection');

            const audioDevicesList = [
                { id: 'none', label: 'No Audio', type: 'none' },
                { id: 'default', label: 'Default Microphone', type: 'default' }
            ];

            // Try browser audio enumeration
            try {
                const permissionPromise = navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: false,
                        noiseSuppression: false,
                        autoGainControl: false
                    }
                });

                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Audio permission timeout')), 8000)
                );

                const tempStream = await Promise.race([permissionPromise, timeoutPromise]);

                tempStream.getTracks().forEach(track => {
                    track.stop();
                    console.log('ScreenRecording: Stopped temporary audio track:', track.kind);
                });

                const devices = await navigator.mediaDevices.enumerateDevices();
                const audioInputs = devices.filter(device => device.kind === 'audioinput');

                audioInputs.forEach(device => {
                    if (device.deviceId !== 'default' && device.label) {
                        const label = device.label.toLowerCase();
                        let deviceType = 'microphone';

                        if (label.includes('bluetooth')) deviceType = 'bluetooth';
                        else if (label.includes('headset') || label.includes('headphones')) deviceType = 'headset';

                        audioDevicesList.push({
                            id: device.deviceId,
                            label: device.label,
                            type: deviceType
                        });
                    }
                });

                console.log(`ScreenRecording: Browser audio devices detected: ${audioDevicesList.length}`);

            } catch (audioError) {
                console.warn('ScreenRecording: Audio device detection failed:', audioError);
                audioDevicesList.push({
                    id: 'unsupported',
                    label: 'Audio unavailable',
                    type: 'disabled',
                    disabled: true
                });
            }

            this.audioDevices = audioDevicesList;
            this.availableAudioDevices$.next(audioDevicesList);

        } catch (error) {
            console.error('ScreenRecording: Failed to initialize audio devices:', error);
            const emergencyFallback = [{ id: 'none', label: 'No Audio', type: 'none' }];
            this.audioDevices = emergencyFallback;
            this.availableAudioDevices$.next(emergencyFallback);
        }
    }

    /**
     * Get screen stream using ONLY Electron's desktopCapturer
     */
    async getScreenStream() {
        console.log('ScreenRecording: Getting screen stream via Electron desktopCapturer...');

        if (!this.isElectron) {
            throw new Error('Screen recording is only supported in Electron environment. Please use the desktop application.');
        }

        if (!window.electron.getDesktopSources) {
            throw new Error('Electron desktopCapturer API is not available. Please update your Electron app.');
        }

        try {
            // Ensure desktop sources are initialized
            if (this.desktopSources.length === 0 || !this.selectedDesktopSource) {
                console.log('ScreenRecording: Refreshing desktop sources...');
                await this.initializeDesktopSources();
            }

            if (this.desktopSources.length === 0) {
                throw new Error('No desktop sources available for recording. Please ensure you have screens or windows available.');
            }

            if (!this.selectedDesktopSource) {
                throw new Error('No desktop source selected. Please select a screen or window to record.');
            }

            console.log(`ScreenRecording: Using source: "${this.selectedDesktopSource.name}" (${this.selectedDesktopSource.type})`);

            // Create constraints for getUserMedia with Electron's chromeMediaSourceId
            const constraints = {
                audio: false, // We'll handle audio separately
                video: {
                    mandatory: {
                        chromeMediaSource: 'desktop',
                        chromeMediaSourceId: this.selectedDesktopSource.id,
                        maxWidth: this.recordingConfig.videoWidth || 1920,
                        maxHeight: this.recordingConfig.videoHeight || 1080,
                        maxFrameRate: this.recordingConfig.frameRate || 30,
                        minFrameRate: Math.max(1, (this.recordingConfig.frameRate || 30) - 10)
                    }
                }
            };

            console.log('ScreenRecording: getUserMedia constraints:', JSON.stringify(constraints, null, 2));

            const stream = await navigator.mediaDevices.getUserMedia(constraints);

            if (!stream || stream.getVideoTracks().length === 0) {
                throw new Error('Failed to create screen capture stream from selected source.');
            }

            console.log('ScreenRecording: Screen stream created successfully');
            const videoTrack = stream.getVideoTracks()[0];
            if (videoTrack) {
                const settings = videoTrack.getSettings();
                console.log('ScreenRecording: Video track settings:', {
                    width: settings.width,
                    height: settings.height,
                    frameRate: settings.frameRate,
                    deviceId: settings.deviceId,
                    label: videoTrack.label
                });
            }

            return stream;

        } catch (error) {
            console.error('ScreenRecording: Screen capture failed:', error);
            throw this.createUserFriendlyError(error);
        }
    }

    /**
     * Create user-friendly error messages
     */
    createUserFriendlyError(originalError) {
        console.error('ScreenRecording: Original error:', originalError);

        if (!this.isElectron) {
            return new Error(
                'Screen recording is only available in the Electron desktop application.\n\n' +
                'Web browsers are not supported for screen recording in this application.\n\n' +
                'Please download and use the desktop version of this application.'
            );
        }

        if (originalError.message && originalError.message.includes('chromeMediaSourceId')) {
            return new Error(
                'Failed to access the selected screen or window.\n\n' +
                'This can happen when:\n' +
                '• The selected window was closed\n' +
                '• Screen permissions were denied\n' +
                '• The screen source is no longer available\n\n' +
                'Solutions:\n' +
                '• Restart the application\n' +
                '• Try selecting a different screen/window\n' +
                '• Check system permissions for screen recording'
            );
        }

        if (originalError.name === 'NotAllowedError') {
            return new Error(
                'Screen recording permission denied.\n\n' +
                'Please allow screen recording permissions when prompted and try again.\n\n' +
                'You may need to restart the application after granting permissions.'
            );
        }

        if (originalError.name === 'NotFoundError') {
            return new Error(
                'No screen sources available for recording.\n\n' +
                'Please ensure you have at least one screen or window open and try again.'
            );
        }

        return new Error(
            `Screen recording failed: ${originalError.message || 'Unknown error'}\n\n` +
            'This can happen when:\n' +
            '• System screen recording permissions are denied\n' +
            '• The selected screen source is unavailable\n' +
            '• Electron security policies are blocking access\n\n' +
            'Solutions:\n' +
            '• Restart the application\n' +
            '• Check system screen recording permissions\n' +
            '• Try selecting a different screen/window'
        );
    }

    /**
     * Get audio stream based on current configuration
     */
    async getAudioStream() {
        if (this.recordingConfig.audioSource === 'none' ||
            this.recordingConfig.audioSource === 'unsupported' ||
            !this.recordingConfig.audioSource) {
            console.log('ScreenRecording: No audio source selected');
            return null;
        }

        try {
            console.log('ScreenRecording: Getting audio stream for device:', this.recordingConfig.audioSource);

            const constraints = {
                audio: {
                    deviceId: this.recordingConfig.audioSource === 'default' ? 'default' : { exact: this.recordingConfig.audioSource },
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    sampleRate: 44100,
                    channelCount: 2
                }
            };

            const audioStream = await navigator.mediaDevices.getUserMedia(constraints);
            console.log('ScreenRecording: Audio stream created successfully');
            return audioStream;

        } catch (audioError) {
            console.warn('ScreenRecording: Failed to get audio stream:', audioError);
            throw new Error(`Audio capture failed: ${audioError.message}`);
        }
    }

    /**
     * Combine screen and audio streams
     */
    combineStreams(screenStream, audioStream) {
        const combinedStream = new MediaStream();

        screenStream.getVideoTracks().forEach(track => {
            combinedStream.addTrack(track);
            console.log('ScreenRecording: Added video track:', track.id, track.label);
        });

        if (audioStream) {
            audioStream.getAudioTracks().forEach(track => {
                combinedStream.addTrack(track);
                console.log('ScreenRecording: Added audio track:', track.id, track.label);
            });
        }

        console.log('ScreenRecording: Combined stream - Video tracks:',
            combinedStream.getVideoTracks().length, 'Audio tracks:', combinedStream.getAudioTracks().length);

        return combinedStream;
    }

    /**
     * Start recording using Electron desktopCapturer
     */
    async startRecording() {
        if (this.isRecording$.value) {
            console.warn('ScreenRecording: Recording already in progress');
            return false;
        }

        console.log('ScreenRecording: Starting recording with config:', this.recordingConfig);

        // Pre-flight check
        if (!ScreenRecordingServiceClass.isSupported()) {
            const envInfo = ScreenRecordingServiceClass.getEnvironmentInfo();
            console.error('ScreenRecording: Recording not supported:', envInfo);
            throw new Error('Screen recording is only available in the Electron desktop application.');
        }

        try {
            // Ensure audio devices are initialized
            await this.initializeAudioDevices();

            // Get screen capture stream using Electron desktopCapturer
            const screenStream = await this.getScreenStream();
            if (!screenStream) {
                throw new Error('Failed to capture screen stream');
            }

            // Get audio stream based on configuration
            let audioStream = null;
            if (this.recordingConfig.audioSource !== 'none' && this.recordingConfig.audioSource !== 'unsupported') {
                try {
                    audioStream = await this.getAudioStream();
                } catch (audioError) {
                    console.warn('ScreenRecording: Audio stream failed, continuing with video only:', audioError);
                    PopupService.showNotification(
                        `Audio capture failed: ${audioError.message}. Continuing with video-only recording.`,
                        true
                    );
                }
            }

            // Combine streams
            const combinedStream = this.combineStreams(screenStream, audioStream);

            // Get optimal MIME type and options
            const mimeType = this.getSupportedMimeType();
            const options = {
                mimeType: mimeType,
                videoBitsPerSecond: 4000000, // 4 Mbps
                audioBitsPerSecond: 128000  // 128 kbps
            };

            console.log('ScreenRecording: MediaRecorder options:', options);

            this.mediaRecorder = new MediaRecorder(combinedStream, options);
            this.recordedChunks = [];

            // Set up event handlers
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                    console.log('ScreenRecording: Data chunk received, size:', event.data.size);
                }
            };

            this.mediaRecorder.onerror = (event) => {
                console.error('ScreenRecording: MediaRecorder error:', event.error);
                this.cleanup();
                PopupService.showNotification(`Recording error: ${event.error}`, true);
            };

            // Start recording
            this.mediaRecorder.start(1000);
            this.recordingStartTime = Date.now();
            this.isRecording$.next(true);
            this.currentStream = combinedStream;

            // Set up stream ended handlers
            combinedStream.getVideoTracks().forEach(track => {
                track.addEventListener('ended', () => {
                    console.warn('ScreenRecording: Video track ended');
                    this.stopRecording();
                });
            });

            // Start progress tracking
            this.startProgressTracking();

            console.log('ScreenRecording: Recording started successfully using Electron desktopCapturer');
            PopupService.showNotification('Screen recording started successfully!');
            return true;

        } catch (error) {
            console.error('ScreenRecording: Failed to start recording:', error);
            this.cleanup();
            throw error;
        }
    }

    startProgressTracking() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
        }

        this.progressInterval = setInterval(() => {
            if (this.recordingStartTime && this.isRecording$.value) {
                const duration = (Date.now() - this.recordingStartTime) / 1000;
                const size = this.recordedChunks.reduce((total, chunk) => total + chunk.size, 0);

                this.recordingProgress$.next({ duration, size });

                if (Math.floor(duration) % 10 === 0) {
                    console.log(`ScreenRecording: Progress - ${duration.toFixed(0)}s, ${this.formatFileSize(size)}`);
                }
            }
        }, 1000);
    }

    async stopRecording() {
        return new Promise((resolve, reject) => {
            if (!this.isRecording$.value || !this.mediaRecorder) {
                console.warn('ScreenRecording: No active recording to stop');
                resolve(null);
                return;
            }

            console.log('ScreenRecording: Stopping recording...');
            const recordingStarted = this.recordingStartTime;

            this.mediaRecorder.onstop = async () => {
                try {
                    console.log('ScreenRecording: MediaRecorder stopped, processing chunks...');

                    if (this.recordedChunks.length === 0) {
                        throw new Error('No recording data available - no chunks were collected');
                    }

                    const totalSize = this.recordedChunks.reduce((sum, chunk) => sum + chunk.size, 0);
                    console.log('ScreenRecording: Total data size:', this.formatFileSize(totalSize));

                    const recordingBlob = new Blob(this.recordedChunks, {
                        type: this.getOutputMimeType()
                    });

                    if (recordingBlob.size === 0) {
                        throw new Error('Recording blob is empty - no data was captured');
                    }

                    const recordingInfo = this.getRecordingInfo(recordingBlob, recordingStarted);
                    this.cleanup(false);

                    PopupService.showNotification('Recording completed successfully!');
                    console.log('ScreenRecording: Recording processed successfully');

                    resolve({ blob: recordingBlob, info: recordingInfo });
                } catch (error) {
                    console.error('ScreenRecording: Error processing recording:', error);
                    this.cleanup();
                    reject(error);
                }
            };

            this.mediaRecorder.onerror = (event) => {
                console.error('ScreenRecording: MediaRecorder error on stop:', event.error);
                this.cleanup();
                reject(event.error);
            };

            try {
                if (this.mediaRecorder.state === 'recording') {
                    this.mediaRecorder.requestData();
                    this.mediaRecorder.stop();
                } else {
                    throw new Error('MediaRecorder not in recording state: ' + this.mediaRecorder.state);
                }
            } catch (stopError) {
                console.error('ScreenRecording: Error stopping MediaRecorder:', stopError);
                this.cleanup();
                reject(stopError);
            }
        });
    }

    async downloadRecording(blob, filename) {
        try {
            console.log('ScreenRecording: Starting download:', filename);

            if (!blob || blob.size === 0) {
                throw new Error('Invalid or empty recording blob');
            }

            // Use Electron save dialog
            if (this.isElectron && window.electron.saveRecording) {
                console.log('ScreenRecording: Using Electron save dialog');
                
                try {
                    // Convert Blob to ArrayBuffer properly
                    const arrayBuffer = await blob.arrayBuffer();
                    
                    // Verify ArrayBuffer was created successfully
                    if (!arrayBuffer || !(arrayBuffer instanceof ArrayBuffer)) {
                        throw new Error('Failed to convert blob to ArrayBuffer');
                    }
                    
                    console.log('ScreenRecording: Converted blob to ArrayBuffer, size:', arrayBuffer.byteLength, 'bytes');
                    console.log('ScreenRecording: ArrayBuffer type check:', {
                        isArrayBuffer: arrayBuffer instanceof ArrayBuffer,
                        byteLength: arrayBuffer.byteLength,
                        constructor: arrayBuffer.constructor.name
                    });

                    // Pass the ArrayBuffer directly (NOT converted to Uint8Array)
                    // Electron IPC should handle ArrayBuffer natively
                    const result = await window.electron.saveRecording(arrayBuffer, filename, blob.type);
                    
                    if (result.success) {
                        console.log('ScreenRecording: File saved via Electron:', result.filePath);
                        PopupService.showNotification(`Recording saved: ${result.filePath}`);
                        return;
                    } else {
                        throw new Error(result.error || 'Electron save failed');
                    }
                } catch (conversionError) {
                    console.error('ScreenRecording: Blob conversion or save failed:', conversionError);
                    throw new Error(`Failed to save recording: ${conversionError.message}`);
                }
            }

            // Fallback - should not happen in pure Electron implementation
            console.warn('ScreenRecording: Electron not available, cannot download');
            throw new Error('Download only available in Electron desktop application');

        } catch (error) {
            console.error('ScreenRecording: Download failed:', error);
            PopupService.showNotification(`Download failed: ${error.message}`, true);
            throw error;
        }
    }

    getRecordingInfo(blob, recordingStartTime = null) {
        const actualStartTime = recordingStartTime || this.recordingStartTime;
        const duration = actualStartTime
            ? (Date.now() - actualStartTime) / 1000
            : 0;

        return {
            size: blob.size,
            sizeFormatted: this.formatFileSize(blob.size),
            duration: duration,
            durationFormatted: this.formatDuration(duration),
            format: this.recordingConfig.videoFormat,
            timestamp: new Date().toISOString(),
            mimeType: blob.type,
            recordingStartTime: actualStartTime,
            recordingEndTime: Date.now(),
            hasAudio: this.recordingConfig.audioSource !== 'none' && this.recordingConfig.audioSource !== 'unsupported',
            audioSource: this.recordingConfig.audioSource,
            environment: 'Electron',
            captureMethod: 'desktopCapturer',
            sourceUsed: this.selectedDesktopSource ? this.selectedDesktopSource.name : 'Unknown'
        };
    }

    updateConfig(newConfig) {
        this.recordingConfig = { ...this.recordingConfig, ...newConfig };
        console.log('ScreenRecording: Configuration updated:', this.recordingConfig);
    }

    getStatus() {
        return {
            isRecording: this.isRecording$.value,
            duration: this.recordingStartTime ? (Date.now() - this.recordingStartTime) / 1000 : 0,
            chunksCount: this.recordedChunks.length,
            totalSize: this.recordedChunks.reduce((total, chunk) => total + chunk.size, 0),
            mediaRecorderState: this.mediaRecorder ? this.mediaRecorder.state : 'inactive',
            canRecord: ScreenRecordingServiceClass.isSupported(),
            environment: ScreenRecordingServiceClass.getEnvironmentInfo(),
            isElectron: this.isElectron,
            desktopSources: this.desktopSources.length,
            selectedSource: this.selectedDesktopSource ? this.selectedDesktopSource.name : null
        };
    }

    getSupportedMimeType() {
        const types = [
            'video/webm; codecs=vp9,opus',
            'video/webm; codecs=vp8,opus',
            'video/webm; codecs=vp9',
            'video/webm; codecs=vp8',
            'video/webm',
            'video/mp4; codecs=h264,aac',
            'video/mp4'
        ];

        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) {
                console.log('ScreenRecording: Using MIME type:', type);
                return type;
            }
        }

        console.warn('ScreenRecording: No supported MIME type found, using default');
        return 'video/webm';
    }

    getOutputMimeType() {
        return this.getSupportedMimeType();
    }

    formatDuration(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    cleanup(clearChunks = true) {
        console.log('ScreenRecording: Cleaning up resources...');

        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }

        if (this.currentStream) {
            this.currentStream.getTracks().forEach(track => {
                track.stop();
                console.log('ScreenRecording: Stopped track:', track.kind, track.id);
            });
            this.currentStream = null;
        }

        if (clearChunks) {
            this.recordedChunks = [];
        }

        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
             this.mediaRecorder.stop();
        }
        this.mediaRecorder = null;
        this.recordingStartTime = null;
        this.isRecording$.next(false);
        this.recordingProgress$.next({ duration: 0, size: 0 });

        console.log('ScreenRecording: Cleanup completed');
    }

    /**
     * Get available desktop sources for manual selection
     */
    getDesktopSources() {
        if (!this.isElectron) {
            console.warn('ScreenRecording: Desktop sources only available in Electron');
            return [];
        }
        return this.desktopSources;
    }

    /**
     * Select a specific desktop source for recording
     */
    selectDesktopSource(sourceId) {
        if (!this.isElectron) {
            console.warn('ScreenRecording: Desktop source selection only available in Electron');
            return false;
        }

        const source = this.desktopSources.find(s => s.id === sourceId);
        if (!source) {
            console.error('ScreenRecording: Desktop source not found:', sourceId);
            return false;
        }

        this.selectedDesktopSource = source;
        console.log('ScreenRecording: Selected desktop source:', source.name);
        return true;
    }

    /**
     * Refresh available desktop sources
     */
    async refreshDesktopSources() {
        if (!this.isElectron) {
            console.warn('ScreenRecording: Desktop source refresh only available in Electron');
            return [];
        }

        await this.initializeDesktopSources();
        return this.desktopSources;
    }
}

// Singleton pattern to ensure only one instance is created
export const ScreenRecordingService = new ScreenRecordingServiceClass();