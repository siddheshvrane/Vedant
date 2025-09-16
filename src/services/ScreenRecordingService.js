// Enhanced ScreenRecordingService.js - HTTP/HTTPS handling

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

        // Initialize immediately
        this.initializeAudioDevices();
    }

    /**
     * Enhanced support check with HTTP/HTTPS validation
     */
    static isSupported() {
        try {
            const hasDisplayMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
            const hasMediaRecorder = !!window.MediaRecorder;
            const isValidContext = window.isSecureContext ||
                                   location.hostname === 'localhost' ||
                                   location.hostname === '127.0.0.1' ||
                                   location.protocol === 'file:';

            console.log('ScreenRecording: Detailed support check:', {
                hasDisplayMedia,
                hasMediaRecorder,
                protocol: location.protocol,
                hostname: location.hostname,
                isSecureContext: window.isSecureContext,
                isValidContext
            });

            return hasDisplayMedia && hasMediaRecorder && isValidContext;
        } catch (error) {
            console.warn('ScreenRecording: Support check failed:', error);
            return false;
        }
    }

    /**
     * Get detailed environment info for diagnostics
     */
    static getEnvironmentInfo() {
        return {
            protocol: location.protocol,
            hostname: location.hostname,
            isSecureContext: window.isSecureContext,
            hasDisplayMedia: !!(navigator.mediaDevices?.getDisplayMedia),
            hasMediaRecorder: !!window.MediaRecorder,
            userAgent: navigator.userAgent.substring(0, 100),
            isElectron: !!window.electron,
            canRecord: this.isSupported()
        };
    }

    /**
     * Enhanced initialization with better error recovery
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
            console.log('🎤 ScreenRecording: Initializing audio devices...');

            if (window.electron && window.electron.getAudioDevices) {
                console.log('🖥️ ScreenRecording: Using Electron audio device detection');
                try {
                    const electronDevices = await window.electron.getAudioDevices();
                    this.audioDevices = electronDevices;
                    this.availableAudioDevices$.next(electronDevices);
                    console.log('✅ ScreenRecording: Electron audio devices detected:', electronDevices.length);
                    return;
                } catch (electronError) {
                    console.warn('⚠️ ScreenRecording: Electron audio detection failed, falling back to browser:', electronError);
                }
            }

            console.log('🌐 ScreenRecording: Using browser audio device detection');

            const audioDevicesList = [
                { id: 'none', label: 'No Audio', type: 'none' },
                { id: 'default', label: 'Default Microphone', type: 'default' }
            ];

            // Only try browser audio enumeration if we have a secure context
            if (window.isSecureContext || location.hostname === 'localhost') {
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

                    console.log('✅ ScreenRecording: Browser audio devices detected:', audioDevicesList.length);

                } catch (audioError) {
                    console.warn('⚠️ ScreenRecording: Audio device detection failed:', audioError);
                }
            } else {
                console.warn('⚠️ ScreenRecording: Insecure context, skipping audio enumeration');
                audioDevicesList.push({
                    id: 'unsupported',
                    label: 'Audio unavailable (requires HTTPS)',
                    type: 'disabled',
                    disabled: true
                });
            }

            this.audioDevices = audioDevicesList;
            this.availableAudioDevices$.next(audioDevicesList);

        } catch (error) {
            console.error('❌ ScreenRecording: Failed to initialize audio devices:', error);
            const emergencyFallback = [{ id: 'none', label: 'No Audio', type: 'none' }];
            this.audioDevices = emergencyFallback;
            this.availableAudioDevices$.next(emergencyFallback);
        }
    }

    /**
     * Enhanced screen stream acquisition with HTTP/HTTPS handling
     */
    async getScreenStream() {
        console.log('🎥 ScreenRecording: Attempting to get screen stream...');

        const envInfo = ScreenRecordingServiceClass.getEnvironmentInfo();
        console.log('🔍 ScreenRecording: Environment check:', envInfo);

        // Check if we can use screen recording APIs
        if (!this.canUseScreenRecording()) {
            throw this.createContextError();
        }

        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
            throw new Error('Screen capture APIs not available in this browser.');
        }

        // Try multiple approaches in order of preference
        const approaches = [
            () => this.tryElectronScreenCapture(),
            () => this.tryBrowserScreenCapture(),
            () => this.tryFallbackScreenCapture()
        ];

        let lastError;

        for (let i = 0; i < approaches.length; i++) {
            try {
                console.log(`🎯 ScreenRecording: Trying approach ${i + 1}/3...`);
                const stream = await approaches[i]();
                if (stream && stream.getVideoTracks().length > 0) {
                    console.log('✅ ScreenRecording: Screen stream created successfully via approach', i + 1);
                    console.log('🔍 ScreenRecording: Video track settings:', stream.getVideoTracks()[0].getSettings());
                    return stream;
                }
            } catch (error) {
                console.warn(`⚠️ ScreenRecording: Approach ${i + 1} failed:`, error.message);
                lastError = error;
            }
        }

        // All approaches failed
        console.error('❌ ScreenRecording: All screen capture approaches failed');
        throw this.createUserFriendlyError(lastError);
    }

    /**
     * Check if screen recording can be used in current context
     */
    canUseScreenRecording() {
        // Electron always works
        if (window.electron && window.electron.getDesktopSources) {
            return true;
        }

        // Browser requirements
        return window.isSecureContext ||
               location.hostname === 'localhost' ||
               location.hostname === '127.0.0.1' ||
               location.protocol === 'file:';
    }

    /**
     * Create context-specific error
     */
    createContextError() {
        if (location.protocol === 'http:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
            return new Error(
                'Screen recording requires HTTPS or localhost. Current context is HTTP.\n\n' +
                'Solutions:\n' +
                '• Switch to HTTPS\n' +
                '• Use localhost or 127.0.0.1\n' +
                '• Use Electron app version'
            );
        }

        return new Error('Screen recording is not supported in this browser context.');
    }

    async tryElectronScreenCapture() {
        if (!window.electron || !window.electron.getDesktopSources) {
            throw new Error('Electron not available');
        }

        console.log('🖥️ ScreenRecording: Trying Electron desktop capturer');

        const sources = await window.electron.getDesktopSources({ types: ['screen'] });

        if (sources.length === 0) {
            throw new Error('No screen sources available from Electron');
        }

        const primaryScreen = sources[0];
        console.log('🖥️ ScreenRecording: Using screen source:', primaryScreen.name);

        return await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                mandatory: {
                    chromeMediaSource: 'desktop',
                    chromeMediaSourceId: primaryScreen.id,
                    minWidth: Math.min(this.recordingConfig.videoWidth, 1920),
                    maxWidth: this.recordingConfig.videoWidth,
                    minHeight: Math.min(this.recordingConfig.videoHeight, 1080),
                    maxHeight: this.recordingConfig.videoHeight,
                    minFrameRate: Math.min(this.recordingConfig.frameRate, 30),
                    maxFrameRate: this.recordingConfig.frameRate
                }
            }
        });
    }

    async tryBrowserScreenCapture() {
        console.log('🌐 ScreenRecording: Trying browser getDisplayMedia');

        // Check context again
        if (!this.canUseScreenRecording()) {
            throw new Error('Insecure context - requires HTTPS or localhost');
        }
        
        // **FIX:** Re-ordering constraints to prioritize a generic, high-success-rate constraint first
        const constraintSets = [
            // 1. The simplest and most likely to succeed.
            { video: true, audio: true },
            // 2. Try the user-defined resolution.
            {
                video: {
                    width: { ideal: this.recordingConfig.videoWidth, max: 2560 },
                    height: { ideal: this.recordingConfig.videoHeight, max: 1440 },
                    frameRate: { ideal: this.recordingConfig.frameRate, max: 60 }
                },
                audio: true
            },
            // 3. Fallback to a common HD resolution.
            {
                video: {
                    width: { ideal: 1280, max: 1920 },
                    height: { ideal: 720, max: 1080 },
                    frameRate: { ideal: 30, max: 30 }
                },
                audio: true
            }
        ];

        for (const constraints of constraintSets) {
            try {
                console.log('🎯 ScreenRecording: Trying constraints:', constraints);
                return await navigator.mediaDevices.getDisplayMedia(constraints);
            } catch (constraintError) {
                console.warn('⚠️ ScreenRecording: Constraint failed:', constraintError.message);
                continue;
            }
        }

        throw new Error('All constraint sets failed');
    }

    async tryFallbackScreenCapture() {
        console.log('🔄 ScreenRecording: Trying fallback screen capture');

        try {
            return await navigator.mediaDevices.getDisplayMedia({
                video: {},
                audio: true
            });
        } catch (error) {
            throw new Error('Fallback screen capture failed: ' + error.message);
        }
    }

    createUserFriendlyError(originalError) {
        console.error('❌ ScreenRecording: Original error:', originalError);

        // Check for HTTP context first
        if (location.protocol === 'http:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
            return new Error(
                'Screen recording blocked: Application is running on HTTP.\n\n' +
                'Modern browsers require HTTPS for screen recording.\n\n' +
                'Solutions:\n' +
                '• Enable HTTPS on your server\n' +
                '• Access via localhost or 127.0.0.1\n' +
                '• Use the Electron desktop app'
            );
        }

        if (originalError.name === 'NotAllowedError') {
            return new Error('Screen recording permission denied. Please allow screen sharing when prompted and try again.');
        } else if (originalError.name === 'NotSupportedError' || originalError.message?.includes('Not supported')) {
            return new Error(
                'Screen recording not supported in this browser environment.\n\n' +
                'Please try:\n' +
                '• Chrome 88+, Firefox 88+, or Edge 88+\n' +
                '• HTTPS connection\n' +
                '• Localhost development\n' +
                '• Desktop application'
            );
        } else if (originalError.name === 'NotFoundError') {
            return new Error('No screen sources available for recording.');
        } else if (originalError.name === 'AbortError') {
            return new Error('Screen recording was cancelled.');
        } else {
            return new Error(
                `Screen capture failed: ${originalError.message || 'Unknown error'}\n\n` +
                'Try:\n' +
                '• Refreshing the page\n' +
                '• Using HTTPS or localhost\n' +
                '• Different browser'
            );
        }
    }

    /**
     * Get audio stream based on current configuration
     */
    async getAudioStream() {
        if (this.recordingConfig.audioSource === 'none' ||
            this.recordingConfig.audioSource === 'unsupported' ||
            !this.recordingConfig.audioSource) {
            console.log('🔇 ScreenRecording: No audio source selected');
            return null;
        }

        // Check if we can access microphone
        if (!this.canUseScreenRecording()) {
            console.warn('🔇 ScreenRecording: Audio unavailable in insecure context');
            return null;
        }

        try {
            console.log('🎤 ScreenRecording: Getting audio stream for device:', this.recordingConfig.audioSource);

            // **IMPROVED:** Simplified constraints for clarity and consistency
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
            console.log('✅ ScreenRecording: Audio stream created successfully');
            return audioStream;

        } catch (audioError) {
            console.warn('⚠️ ScreenRecording: Failed to get audio stream:', audioError);
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
            console.log('🔄 ScreenRecording: Added video track:', track.id, track.label);
        });

        if (audioStream) {
            audioStream.getAudioTracks().forEach(track => {
                combinedStream.addTrack(track);
                console.log('🔄 ScreenRecording: Added audio track:', track.id, track.label);
            });
        }

        console.log('🔄 ScreenRecording: Streams combined - Video tracks:',
            combinedStream.getVideoTracks().length, 'Audio tracks:', combinedStream.getAudioTracks().length);

        return combinedStream;
    }

    /**
     * Enhanced start recording with context validation
     */
    async startRecording() {
        if (this.isRecording$.value) {
            console.warn('⚠️ ScreenRecording: Recording already in progress');
            return false;
        }

        console.log('🎬 ScreenRecording: Starting recording with config:', this.recordingConfig);

        // Pre-flight check
        if (!ScreenRecordingServiceClass.isSupported()) {
            const envInfo = ScreenRecordingServiceClass.getEnvironmentInfo();
            console.error('❌ ScreenRecording: Recording not supported:', envInfo);
            throw this.createContextError();
        }

        try {
            // Ensure audio devices are initialized
            await this.initializeAudioDevices();

            // Get screen capture stream
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
                    console.warn('⚠️ ScreenRecording: Audio stream failed, continuing with video only:', audioError);
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

            console.log('🎬 ScreenRecording: MediaRecorder options:', options);

            this.mediaRecorder = new MediaRecorder(combinedStream, options);
            this.recordedChunks = [];

            // Set up event handlers
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                    console.log('📦 ScreenRecording: Data chunk received, size:', event.data.size);
                }
            };

            this.mediaRecorder.onerror = (event) => {
                console.error('❌ ScreenRecording: MediaRecorder error:', event.error);
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
                    console.warn('⚠️ ScreenRecording: Video track ended');
                    this.stopRecording();
                });
            });

            // Start progress tracking
            this.startProgressTracking();

            console.log('✅ ScreenRecording: Recording started successfully');
            PopupService.showNotification('Screen recording started successfully!');
            return true;

        } catch (error) {
            console.error('❌ ScreenRecording: Failed to start recording:', error);
            this.cleanup();
            PopupService.showNotification(`Recording failed: ${error.message}`, true);
            return false;
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
                    console.log(`📊 ScreenRecording: Progress - ${duration.toFixed(0)}s, ${this.formatFileSize(size)}`);
                }
            }
        }, 1000);
    }

    async stopRecording() {
        return new Promise((resolve, reject) => {
            if (!this.isRecording$.value || !this.mediaRecorder) {
                console.warn('⚠️ ScreenRecording: No active recording to stop');
                resolve(null);
                return;
            }

            console.log('🛑 ScreenRecording: Stopping recording...');
            const recordingStarted = this.recordingStartTime;

            this.mediaRecorder.onstop = async () => {
                try {
                    console.log('✅ ScreenRecording: MediaRecorder stopped, processing chunks...');

                    if (this.recordedChunks.length === 0) {
                        throw new Error('No recording data available - no chunks were collected');
                    }

                    const totalSize = this.recordedChunks.reduce((sum, chunk) => sum + chunk.size, 0);
                    console.log('📦 ScreenRecording: Total data size:', this.formatFileSize(totalSize));

                    const recordingBlob = new Blob(this.recordedChunks, {
                        type: this.getOutputMimeType()
                    });

                    if (recordingBlob.size === 0) {
                        throw new Error('Recording blob is empty - no data was captured');
                    }

                    const recordingInfo = this.getRecordingInfo(recordingBlob, recordingStarted);
                    this.cleanup(false);

                    PopupService.showNotification('Recording completed successfully!');
                    console.log('✅ ScreenRecording: Recording processed successfully');

                    resolve({ blob: recordingBlob, info: recordingInfo });
                } catch (error) {
                    console.error('❌ ScreenRecording: Error processing recording:', error);
                    this.cleanup();
                    reject(error);
                }
            };

            this.mediaRecorder.onerror = (event) => {
                console.error('❌ ScreenRecording: MediaRecorder error on stop:', event.error);
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
                console.error('❌ ScreenRecording: Error stopping MediaRecorder:', stopError);
                this.cleanup();
                reject(stopError);
            }
        });
    }

    async downloadRecording(blob, filename) {
        try {
            console.log('💾 ScreenRecording: Starting download:', filename);

            if (!blob || blob.size === 0) {
                throw new Error('Invalid or empty recording blob');
            }

            // Try Electron save dialog first
            if (window.electron && window.electron.saveRecording) {
                console.log('🖥️ ScreenRecording: Using Electron save dialog');
                const arrayBuffer = await blob.arrayBuffer();
                const buffer = new Uint8Array(arrayBuffer);

                const result = await window.electron.saveRecording(buffer, filename, blob.type);
                if (result.success) {
                    console.log('✅ ScreenRecording: File saved via Electron:', result.filePath);
                    PopupService.showNotification(`Recording saved: ${result.filePath}`);
                } else {
                    throw new Error(result.error || 'Electron save failed');
                }
                return;
            }

            // Browser download fallback
            console.log('🌐 ScreenRecording: Using browser download');
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = filename;

            document.body.appendChild(a);
            a.click();

            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);

            console.log('✅ ScreenRecording: Browser download triggered');
            PopupService.showNotification('Recording download started');

        } catch (error) {
            console.error('❌ ScreenRecording: Download failed:', error);
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
            audioSource: this.recordingConfig.audioSource
        };
    }

    updateConfig(newConfig) {
        this.recordingConfig = { ...this.recordingConfig, ...newConfig };
        console.log('🔧 ScreenRecording: Configuration updated:', this.recordingConfig);
    }

    getStatus() {
        return {
            isRecording: this.isRecording$.value,
            duration: this.recordingStartTime ? (Date.now() - this.recordingStartTime) / 1000 : 0,
            chunksCount: this.recordedChunks.length,
            totalSize: this.recordedChunks.reduce((total, chunk) => total + chunk.size, 0),
            mediaRecorderState: this.mediaRecorder ? this.mediaRecorder.state : 'inactive',
            canRecord: ScreenRecordingServiceClass.isSupported(),
            environment: ScreenRecordingServiceClass.getEnvironmentInfo()
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
                console.log('🎬 ScreenRecording: Using MIME type:', type);
                return type;
            }
        }

        console.warn('⚠️ ScreenRecording: No supported MIME type found, using default');
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
        console.log('🧹 ScreenRecording: Cleaning up resources...');

        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }

        if (this.currentStream) {
            this.currentStream.getTracks().forEach(track => {
                track.stop();
                console.log('🛑 ScreenRecording: Stopped track:', track.kind, track.id);
            });
            this.currentStream = null;
        }

        if (clearChunks) {
            this.recordedChunks = [];
        }

        // **FIX:** Resetting MediaRecorder state and observables
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
             this.mediaRecorder.stop();
        }
        this.mediaRecorder = null;
        this.recordingStartTime = null;
        this.isRecording$.next(false);
        this.recordingProgress$.next({ duration: 0, size: 0 });

        console.log('✅ ScreenRecording: Cleanup completed');
    }

}

// Singleton pattern to ensure only one instance is created
export const ScreenRecordingService = new ScreenRecordingServiceClass();