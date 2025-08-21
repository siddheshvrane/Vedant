// Enhanced ScreenRecordingService.js with improved error handling and diagnostics

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
            frameRate: 60,
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

        // Run comprehensive diagnostics
        this.runDiagnostics();
        this.initializeAudioDevices();
    }

    /**
     * Comprehensive diagnostics to identify recording capability issues
     */
    runDiagnostics() {
        console.log('🔍 ScreenRecording: Running comprehensive diagnostics...');
        
        const diagnostics = {
            browser: this.getBrowserInfo(),
            apis: this.checkAPIAvailability(),
            permissions: null,
            electron: this.checkElectronEnvironment(),
            security: this.checkSecurityContext()
        };

        console.log('📊 ScreenRecording: Diagnostics Results:', diagnostics);

        // Check permissions asynchronously
        this.checkPermissions().then(permissions => {
            diagnostics.permissions = permissions;
            console.log('🔐 ScreenRecording: Permissions check complete:', permissions);
            
            // Provide recommendations based on diagnostics
            this.provideDiagnosticRecommendations(diagnostics);
        });

        return diagnostics;
    }

    getBrowserInfo() {
        const ua = navigator.userAgent;
        const browser = {
            isChrome: ua.includes('Chrome') && !ua.includes('Edg'),
            isFirefox: ua.includes('Firefox'),
            isEdge: ua.includes('Edg'),
            isSafari: ua.includes('Safari') && !ua.includes('Chrome'),
            isElectron: ua.includes('Electron'),
            version: this.getBrowserVersion(ua)
        };
        return browser;
    }

    getBrowserVersion(ua) {
        const match = ua.match(/Chrome\/(\d+)|Firefox\/(\d+)|Edg\/(\d+)|Version\/(\d+)/);
        return match ? (match[1] || match[2] || match[3] || match[4]) : 'unknown';
    }

    checkAPIAvailability() {
        return {
            mediaDevices: !!navigator.mediaDevices,
            getDisplayMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia),
            getUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
            mediaRecorder: !!window.MediaRecorder,
            webRTC: !!(window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection),
            codecs: this.checkCodecSupport()
        };
    }

    checkCodecSupport() {
        if (!window.MediaRecorder) return {};
        
        const codecs = [
            'video/webm',
            'video/webm; codecs=vp8',
            'video/webm; codecs=vp9',
            'video/webm; codecs=vp8,opus',
            'video/webm; codecs=vp9,opus',
            'video/mp4',
            'video/mp4; codecs=h264'
        ];

        return codecs.reduce((support, codec) => {
            support[codec] = MediaRecorder.isTypeSupported(codec);
            return support;
        }, {});
    }

    checkElectronEnvironment() {
        return {
            isElectron: !!window.electron,
            hasDesktopCapturer: !!(window.electron && window.electron.getDesktopSources),
            hasAudioDevices: !!(window.electron && window.electron.getAudioDevices),
            hasSaveDialog: !!(window.electron && window.electron.saveRecording)
        };
    }

    checkSecurityContext() {
        return {
            isHTTPS: location.protocol === 'https:',
            isLocalhost: location.hostname === 'localhost' || location.hostname === '127.0.0.1',
            origin: location.origin,
            crossOrigin: this.checkCrossOrigin()
        };
    }

    checkCrossOrigin() {
        // Check if we're in a cross-origin iframe or have mixed content
        try {
            return window.parent !== window && window.parent.location.origin !== window.location.origin;
        } catch (e) {
            return true; // Likely cross-origin if we can't access parent
        }
    }

    async checkPermissions() {
        const permissions = {};
        
        if (navigator.permissions) {
            try {
                const displayCapture = await navigator.permissions.query({name: 'display-capture'});
                permissions.displayCapture = displayCapture.state;
            } catch (e) {
                permissions.displayCapture = 'not-supported';
            }

            try {
                const microphone = await navigator.permissions.query({name: 'microphone'});
                permissions.microphone = microphone.state;
            } catch (e) {
                permissions.microphone = 'not-supported';
            }
        } else {
            permissions.displayCapture = 'permissions-api-not-supported';
            permissions.microphone = 'permissions-api-not-supported';
        }

        return permissions;
    }

    provideDiagnosticRecommendations(diagnostics) {
        const recommendations = [];

        if (!diagnostics.security.isHTTPS && !diagnostics.security.isLocalhost) {
            recommendations.push('⚠️ Screen recording requires HTTPS or localhost');
        }

        if (!diagnostics.apis.getDisplayMedia) {
            recommendations.push('❌ getDisplayMedia API not available - browser may be too old');
        }

        if (diagnostics.browser.isSafari) {
            recommendations.push('🍎 Safari has limited screen sharing support');
        }

        if (diagnostics.security.crossOrigin) {
            recommendations.push('🔒 Cross-origin context may block screen recording');
        }

        if (!diagnostics.apis.mediaRecorder) {
            recommendations.push('❌ MediaRecorder API not available');
        }

        if (recommendations.length > 0) {
            console.warn('🚨 ScreenRecording: Issues detected:', recommendations);
        } else {
            console.log('✅ ScreenRecording: All diagnostics passed');
        }

        return recommendations;
    }

    /**
     * Enhanced screen stream acquisition with better error handling
     */
    async getScreenStream() {
        console.log('🎥 ScreenRecording: Attempting to get screen stream...');

        // First, run a quick capability check
        if (!navigator.mediaDevices) {
            throw new Error('MediaDevices API not available. This browser may not support screen recording.');
        }

        if (!navigator.mediaDevices.getDisplayMedia) {
            throw new Error('Screen capture not supported. Please use Chrome 72+, Firefox 66+, or Edge 79+.');
        }

        try {
            // Try Electron desktop capturer first
            if (window.electron && window.electron.getDesktopSources) {
                console.log('🖥️ ScreenRecording: Using Electron desktop capturer');
                return await this.getElectronScreenStream();
            }

            // Browser-based screen capture
            console.log('🌐 ScreenRecording: Using browser getDisplayMedia');
            return await this.getBrowserScreenStream();

        } catch (error) {
            console.error('❌ ScreenRecording: Screen capture failed:', error);
            
            // Enhanced error messages based on error type
            if (error.name === 'NotAllowedError') {
                throw new Error('Screen recording permission denied. Please allow screen sharing when prompted.');
            } else if (error.name === 'NotSupportedError') {
                throw new Error('Screen recording not supported in this browser or environment. Try using Chrome, Firefox, or Edge.');
            } else if (error.name === 'NotFoundError') {
                throw new Error('No screen sources available for recording.');
            } else if (error.name === 'AbortError') {
                throw new Error('Screen recording was cancelled by the user.');
            } else if (error.message && error.message.includes('navigator.mediaDevices is undefined')) {
                throw new Error('Screen recording requires HTTPS or localhost environment.');
            } else if (error.message && error.message.includes('Not supported')) {
                // This is likely the error you're encountering
                throw new Error('Screen capture not supported in this environment. Check that you\'re using HTTPS/localhost and a supported browser.');
            } else {
                throw new Error(`Screen capture failed: ${error.message || 'Unknown error'}`);
            }
        }
    }

    async getElectronScreenStream() {
        const sources = await window.electron.getDesktopSources({ types: ['screen'] });
        
        if (sources.length === 0) {
            throw new Error('No screen sources available from Electron');
        }

        const primaryScreen = sources[0];
        console.log('🖥️ ScreenRecording: Using screen source:', primaryScreen.name);

        const stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                mandatory: {
                    chromeMediaSource: 'desktop',
                    chromeMediaSourceId: primaryScreen.id,
                    minWidth: this.recordingConfig.videoWidth,
                    maxWidth: this.recordingConfig.videoWidth,
                    minHeight: this.recordingConfig.videoHeight,
                    maxHeight: this.recordingConfig.videoHeight,
                    minFrameRate: this.recordingConfig.frameRate,
                    maxFrameRate: this.recordingConfig.frameRate
                }
            }
        });

        console.log('✅ ScreenRecording: Electron screen stream created successfully');
        return stream;
    }

    async getBrowserScreenStream() {
        // Check if we're in a secure context
        if (!window.isSecureContext && location.hostname !== 'localhost') {
            throw new Error('Screen recording requires HTTPS or localhost');
        }

        const constraints = {
            video: {
                width: { ideal: this.recordingConfig.videoWidth },
                height: { ideal: this.recordingConfig.videoHeight },
                frameRate: { ideal: this.recordingConfig.frameRate }
            },
            audio: false
        };

        console.log('📹 ScreenRecording: Requesting display media with constraints:', constraints);

        try {
            const stream = await navigator.mediaDevices.getDisplayMedia(constraints);
            console.log('✅ ScreenRecording: Browser screen stream created successfully');
            
            // Check if the stream is valid
            if (!stream || stream.getVideoTracks().length === 0) {
                throw new Error('No video tracks available in screen stream');
            }

            return stream;
        } catch (error) {
            // Log additional context for debugging
            console.error('🔍 ScreenRecording: getDisplayMedia failed with details:', {
                error: error,
                errorName: error.name,
                errorMessage: error.message,
                isSecureContext: window.isSecureContext,
                protocol: location.protocol,
                hostname: location.hostname,
                userAgent: navigator.userAgent
            });
            throw error;
        }
    }

    /**
     * Enhanced initialization with better error recovery
     */
    async initializeAudioDevices() {
        try {
            console.log('🎤 ScreenRecording: Initializing audio devices...');

            // Check if we're in Electron environment
            if (window.electron && window.electron.getAudioDevices) {
                console.log('🖥️ ScreenRecording: Using Electron audio device detection');
                const electronDevices = await window.electron.getAudioDevices();
                this.audioDevices = electronDevices;
                this.availableAudioDevices$.next(electronDevices);
                console.log('✅ ScreenRecording: Electron audio devices detected:', electronDevices);
                return;
            }

            // Browser-based audio device detection with better error handling
            console.log('🌐 ScreenRecording: Using browser audio device detection');
            
            try {
                // Request permissions first with timeout
                const permissionPromise = navigator.mediaDevices.getUserMedia({ 
                    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } 
                });
                
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Audio permission timeout')), 10000)
                );

                const tempStream = await Promise.race([permissionPromise, timeoutPromise]);
                tempStream.getTracks().forEach(track => track.stop());

                const devices = await navigator.mediaDevices.enumerateDevices();
                const audioInputs = devices.filter(device => device.kind === 'audioinput');

                const audioDevicesList = [
                    { id: 'none', label: 'No Audio', type: 'none' },
                    { id: 'default', label: 'Default Microphone', type: 'default' }
                ];

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

                this.audioDevices = audioDevicesList;
                this.availableAudioDevices$.next(audioDevicesList);
                console.log('✅ ScreenRecording: Browser audio devices detected:', audioDevicesList);

            } catch (audioError) {
                console.warn('⚠️ ScreenRecording: Audio device detection failed:', audioError);
                
                // Provide fallback devices
                const fallbackDevices = [
                    { id: 'none', label: 'No Audio (Recommended)', type: 'none' },
                    { id: 'default', label: 'Default Microphone (Untested)', type: 'default' }
                ];
                
                this.audioDevices = fallbackDevices;
                this.availableAudioDevices$.next(fallbackDevices);
            }

        } catch (error) {
            console.error('❌ ScreenRecording: Failed to initialize audio devices:', error);
            const emergencyFallback = [{ id: 'none', label: 'No Audio', type: 'none' }];
            this.audioDevices = emergencyFallback;
            this.availableAudioDevices$.next(emergencyFallback);
        }
    }

    /**
     * Get audio stream based on current configuration
     */
    async getAudioStream() {
        if (this.recordingConfig.audioSource === 'none' || !this.recordingConfig.audioSource) {
            console.log('🔇 ScreenRecording: No audio source selected');
            return null;
        }

        try {
            console.log('🎤 ScreenRecording: Getting audio stream for device:', this.recordingConfig.audioSource);
            
            const constraints = {
                audio: this.recordingConfig.audioSource === 'default' 
                    ? { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
                    : { 
                        deviceId: { exact: this.recordingConfig.audioSource },
                        echoCancellation: false, 
                        noiseSuppression: false, 
                        autoGainControl: false 
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

        // Add video tracks from screen stream
        screenStream.getVideoTracks().forEach(track => {
            combinedStream.addTrack(track);
        });

        // Add audio tracks if available
        if (audioStream) {
            audioStream.getAudioTracks().forEach(track => {
                combinedStream.addTrack(track);
            });
        }

        console.log('🔄 ScreenRecording: Streams combined - Video tracks:', 
            combinedStream.getVideoTracks().length, 'Audio tracks:', combinedStream.getAudioTracks().length);

        return combinedStream;
    }

    /**
     * Set up MediaRecorder with appropriate options
     */
    async setupMediaRecorder(stream) {
        try {
            const options = {
                mimeType: this.getSupportedMimeType(),
                videoBitsPerSecond: 5000000, // 5 Mbps
                audioBitsPerSecond: 128000   // 128 kbps
            };

            this.mediaRecorder = new MediaRecorder(stream, options);

            // Set up event handlers
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                    console.log('📊 ScreenRecording: Chunk recorded, size:', event.data.size);
                }
            };

            this.mediaRecorder.onerror = (event) => {
                console.error('❌ ScreenRecording: MediaRecorder error:', event.error);
            };

            console.log('✅ ScreenRecording: MediaRecorder set up successfully');

        } catch (error) {
            console.error('❌ ScreenRecording: Failed to setup MediaRecorder:', error);
            throw new Error(`MediaRecorder setup failed: ${error.message}`);
        }
    }

    /**
     * Get supported MIME type for recording
     */
    getSupportedMimeType() {
        const types = [
            'video/webm; codecs=vp9,opus',
            'video/webm; codecs=vp8,opus',
            'video/webm; codecs=vp9',
            'video/webm; codecs=vp8',
            'video/webm',
            'video/mp4'
        ];

        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) {
                console.log('📹 ScreenRecording: Using MIME type:', type);
                return type;
            }
        }

        console.warn('⚠️ ScreenRecording: No supported MIME type found, using default');
        return 'video/webm';
    }

    /**
     * Start progress tracking during recording
     */
    startProgressTracking() {
        this.progressInterval = setInterval(() => {
            if (this.recordingStartTime && this.isRecording$.value) {
                const duration = (Date.now() - this.recordingStartTime) / 1000;
                const size = this.recordedChunks.reduce((total, chunk) => total + chunk.size, 0);
                
                this.recordingProgress$.next({ duration, size });
            }
        }, 1000);
    }

    /**
     * Enhanced start recording with pre-flight checks
     */
    async startRecording() {
        if (this.isRecording$.value) {
            console.warn('⚠️ ScreenRecording: Recording already in progress');
            return false;
        }

        console.log('🎬 ScreenRecording: Starting recording with config:', this.recordingConfig);

        try {
            // Run pre-flight diagnostics
            const diagnostics = this.runDiagnostics();
            const recommendations = this.provideDiagnosticRecommendations(diagnostics);
            
            if (recommendations.length > 0) {
                console.warn('⚠️ ScreenRecording: Pre-flight issues detected, proceeding with caution:', recommendations);
            }

            // Get screen capture stream with enhanced error handling
            const screenStream = await this.getScreenStream();
            if (!screenStream) {
                throw new Error('Failed to capture screen stream');
            }
            console.log('✅ ScreenRecording: Screen stream obtained successfully');

            // Get audio stream based on configuration
            let audioStream = null;
            if (this.recordingConfig.audioSource !== 'none') {
                try {
                    audioStream = await this.getAudioStream();
                    if (audioStream) {
                        console.log('✅ ScreenRecording: Audio stream obtained successfully');
                    }
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
            console.log('✅ ScreenRecording: Streams combined successfully');

            // Set up MediaRecorder
            await this.setupMediaRecorder(combinedStream);

            // Start recording
            this.mediaRecorder.start(1000);
            this.recordingStartTime = Date.now();
            this.isRecording$.next(true);
            this.currentStream = combinedStream;

            // Start progress tracking
            this.startProgressTracking();

            console.log('✅ ScreenRecording: Recording started successfully');
            PopupService.showNotification('Recording started successfully!');
            return true;

        } catch (error) {
            console.error('❌ ScreenRecording: Failed to start recording:', error);
            this.cleanup();
            
            // Provide user-friendly error messages
            let userMessage = `Recording failed: ${error.message}`;
            
            if (error.message && error.message.includes('not supported')) {
                userMessage += '\n\nTroubleshooting:\n• Ensure you\'re using HTTPS or localhost\n• Try a different browser (Chrome, Firefox, Edge)\n• Check if running in Electron environment';
            }
            
            PopupService.showNotification(userMessage, true);
            return false;
        }
    }

    /**
     * Stop recording and return the recorded data
     */
    async stopRecording() {
        return new Promise((resolve, reject) => {
            if (!this.isRecording$.value || !this.mediaRecorder) {
                console.warn('⚠️ ScreenRecording: No active recording to stop');
                resolve(null);
                return;
            }

            console.log('🛑 ScreenRecording: Stopping recording...');

            this.mediaRecorder.onstop = async () => {
                try {
                    console.log('✅ ScreenRecording: MediaRecorder stopped, processing chunks...');
                    console.log('📊 ScreenRecording: Recorded chunks count:', this.recordedChunks.length);

                    if (this.recordedChunks.length === 0) {
                        throw new Error('No recording data available');
                    }

                    const recordingBlob = new Blob(this.recordedChunks, {
                        type: this.getOutputMimeType()
                    });
                    console.log('✅ ScreenRecording: Blob created, size:', recordingBlob.size);

                    const recordingInfo = this.getRecordingInfo(recordingBlob);

                    this.cleanup();
                    PopupService.showNotification('Recording completed successfully!');
                    console.log('✅ ScreenRecording: Recording stopped and processed successfully');

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

            this.mediaRecorder.stop();
        });
    }

    /**
     * Download the recording file
     */
    async downloadRecording(blob, filename) {
        try {
            console.log('💾 ScreenRecording: Starting download:', filename);

            // Try Electron save dialog first
            if (window.electron && window.electron.saveRecording) {
                console.log('🖥️ ScreenRecording: Using Electron save dialog');
                const arrayBuffer = await blob.arrayBuffer();
                const buffer = new Uint8Array(arrayBuffer);
                
                const result = await window.electron.saveRecording(buffer, filename);
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
            
            // Cleanup
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

    /**
     * Get recording information
     */
    getRecordingInfo(blob) {
        const duration = this.recordingStartTime 
            ? (Date.now() - this.recordingStartTime) / 1000 
            : 0;

        return {
            size: blob.size,
            sizeFormatted: this.formatFileSize(blob.size),
            duration: duration,
            durationFormatted: this.formatDuration(duration),
            format: this.recordingConfig.videoFormat,
            timestamp: new Date().toISOString(),
            mimeType: blob.type
        };
    }

    /**
     * Update recording configuration
     */
    updateConfig(newConfig) {
        this.recordingConfig = { ...this.recordingConfig, ...newConfig };
        console.log('⚙️ ScreenRecording: Configuration updated:', this.recordingConfig);
    }

    /**
     * Get output MIME type
     */
    getOutputMimeType() {
        return 'video/webm';
    }

    /**
     * Format duration in seconds to MM:SS
     */
    formatDuration(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Format file size in bytes to human readable
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Clean up resources
     */
    cleanup() {
        console.log('🧹 ScreenRecording: Cleaning up resources...');

        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }

        if (this.currentStream) {
            this.currentStream.getTracks().forEach(track => {
                track.stop();
                console.log('🛑 ScreenRecording: Stopped track:', track.kind);
            });
            this.currentStream = null;
        }

        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.recordingStartTime = null;
        this.isRecording$.next(false);
        this.recordingProgress$.next({ duration: 0, size: 0 });

        console.log('✅ ScreenRecording: Cleanup completed');
    }
}

export const ScreenRecordingService = new ScreenRecordingServiceClass();