// Enhanced ScreenRecordingService.js

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

        // Initialize
        this.initializeAudioDevices();
    }

    /**
     * Check if screen recording is supported
     */
    static isSupported() {
        try {
            return !!(navigator.mediaDevices && 
                     navigator.mediaDevices.getDisplayMedia && 
                     window.MediaRecorder &&
                     (window.isSecureContext || location.hostname === 'localhost'));
        } catch (error) {
            console.warn('ScreenRecordingService: Support check failed:', error);
            return false;
        }
    }

    /**
     * Enhanced initialization with better error recovery
     */
    async initializeAudioDevices() {
        try {
            console.log('🎤 ScreenRecording: Initializing audio devices...');

            if (window.electron && window.electron.getAudioDevices) {
                console.log('🖥️ ScreenRecording: Using Electron audio device detection');
                const electronDevices = await window.electron.getAudioDevices();
                this.audioDevices = electronDevices;
                this.availableAudioDevices$.next(electronDevices);
                console.log('✅ ScreenRecording: Electron audio devices detected:', electronDevices);
                return;
            }

            console.log('🌐 ScreenRecording: Using browser audio device detection');
            
            try {
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
     * Enhanced screen stream acquisition with better error handling
     */
    async getScreenStream() {
        console.log('🎥 ScreenRecording: Attempting to get screen stream...');

        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
            throw new Error('Screen capture not supported. Please use Chrome 72+, Firefox 66+, or Edge 79+.');
        }

        try {
            // Try Electron desktop capturer first
            if (window.electron && window.electron.getDesktopSources) {
                console.log('🖥️ ScreenRecording: Using Electron desktop capturer');
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
                            minWidth: this.recordingConfig.videoWidth,
                            maxWidth: this.recordingConfig.videoWidth,
                            minHeight: this.recordingConfig.videoHeight,
                            maxHeight: this.recordingConfig.videoHeight,
                            minFrameRate: this.recordingConfig.frameRate,
                            maxFrameRate: this.recordingConfig.frameRate
                        }
                    }
                });
            }

            // Browser-based screen capture
            console.log('🌐 ScreenRecording: Using browser getDisplayMedia');
            
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

            const stream = await navigator.mediaDevices.getDisplayMedia(constraints);
            
            if (!stream || stream.getVideoTracks().length === 0) {
                throw new Error('No video tracks available in screen stream');
            }

            console.log('✅ ScreenRecording: Screen stream created successfully');
            return stream;

        } catch (error) {
            console.error('❌ ScreenRecording: Screen capture failed:', error);
            
            if (error.name === 'NotAllowedError') {
                throw new Error('Screen recording permission denied. Please allow screen sharing when prompted.');
            } else if (error.name === 'NotSupportedError') {
                throw new Error('Screen recording not supported in this browser or environment. Try using Chrome, Firefox, or Edge.');
            } else if (error.name === 'NotFoundError') {
                throw new Error('No screen sources available for recording.');
            } else if (error.name === 'AbortError') {
                throw new Error('Screen recording was cancelled by the user.');
            } else {
                throw new Error(`Screen capture failed: ${error.message || 'Unknown error'}`);
            }
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

        screenStream.getVideoTracks().forEach(track => {
            combinedStream.addTrack(track);
        });

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
     * Enhanced start recording with pre-flight checks
     */
    async startRecording() {
        if (this.isRecording$.value) {
            console.warn('⚠️ ScreenRecording: Recording already in progress');
            return false;
        }

        console.log('🎬 ScreenRecording: Starting recording with config:', this.recordingConfig);

        try {
            // Get screen capture stream
            const screenStream = await this.getScreenStream();
            if (!screenStream) {
                throw new Error('Failed to capture screen stream');
            }

            // Get audio stream based on configuration
            let audioStream = null;
            if (this.recordingConfig.audioSource !== 'none') {
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

            // Set up MediaRecorder
            const options = {
                mimeType: this.getSupportedMimeType(),
                videoBitsPerSecond: 5000000, // 5 Mbps
                audioBitsPerSecond: 128000   // 128 kbps
            };

            this.mediaRecorder = new MediaRecorder(combinedStream, options);
            this.recordedChunks = [];

            // Set up event handlers
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };

            // Start recording
            this.mediaRecorder.start(1000); // Request data every second
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
            PopupService.showNotification(`Recording failed: ${error.message}`, true);
            return false;
        }
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

            const recordingStarted = this.recordingStartTime;

            this.mediaRecorder.onstop = async () => {
                try {
                    console.log('✅ ScreenRecording: MediaRecorder stopped, processing chunks...');

                    if (this.recordedChunks.length === 0) {
                        throw new Error('No recording data available');
                    }

                    // Create the final blob
                    const recordingBlob = new Blob(this.recordedChunks, {
                        type: this.getOutputMimeType()
                    });
                    
                    if (recordingBlob.size === 0) {
                        throw new Error('Recording blob is empty - no data was captured');
                    }

                    const recordingInfo = this.getRecordingInfo(recordingBlob, recordingStarted);

                    // Clean up
                    this.cleanup(false); // Don't clear chunks yet
                    
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

            // Request final data chunk and stop
            try {
                this.mediaRecorder.requestData();
                this.mediaRecorder.stop();
            } catch (stopError) {
                console.error('❌ ScreenRecording: Error calling stop on MediaRecorder:', stopError);
                this.cleanup();
                reject(stopError);
            }
        });
    }

    /**
     * Download the recording file
     */
    async downloadRecording(blob, filename) {
        try {
            console.log('💾 ScreenRecording: Starting download:', filename);

            if (!blob || blob.size === 0) {
                throw new Error('Invalid or empty recording blob');
            }

            // Try Electron save dialog first
            if (window.electron && window.electron.saveRecording) {
                console.log('Desktop: Using Electron save dialog');
                const arrayBuffer = await blob.arrayBuffer();
                const buffer = new Uint8Array(arrayBuffer);
                
                const result = await window.electron.saveRecording(buffer, filename, blob.type);
                if (result.success) {
                    console.log('ScreenRecording: File saved via Electron:', result.filePath);
                    PopupService.showNotification(`Recording saved: ${result.filePath}`);
                } else {
                    throw new Error(result.error || 'Electron save failed');
                }
                return;
            }

            // Browser download fallback
            console.log('Browser: Using browser download');
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

            console.log('ScreenRecording: Browser download triggered');
            PopupService.showNotification('Recording download started');

        } catch (error) {
            console.error('ScreenRecording: Download failed:', error);
            PopupService.showNotification(`Download failed: ${error.message}`, true);
            throw error;
        }
    }

    /**
     * Get recording information
     */
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
            recordingEndTime: Date.now()
        };
    }

    /**
     * Update recording configuration
     */
    updateConfig(newConfig) {
        this.recordingConfig = { ...this.recordingConfig, ...newConfig };
        console.log('ScreenRecording: Configuration updated:', this.recordingConfig);
    }

    /**
     * Get current recording status
     */
    getStatus() {
        return {
            isRecording: this.isRecording$.value,
            duration: this.recordingStartTime ? (Date.now() - this.recordingStartTime) / 1000 : 0,
            chunksCount: this.recordedChunks.length,
            totalSize: this.recordedChunks.reduce((total, chunk) => total + chunk.size, 0)
        };
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
                console.log('ScreenRecording: Using MIME type:', type);
                return type;
            }
        }

        console.warn('ScreenRecording: No supported MIME type found, using default');
        return 'video/webm';
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
    cleanup(clearChunks = true) {
        console.log('ScreenRecording: Cleaning up resources...');

        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }

        if (this.currentStream) {
            this.currentStream.getTracks().forEach(track => {
                track.stop();
                console.log('ScreenRecording: Stopped track:', track.kind);
            });
            this.currentStream = null;
        }

        if (clearChunks) {
            this.recordedChunks = [];
        }
        
        this.mediaRecorder = null;
        this.recordingStartTime = null;
        this.isRecording$.next(false);
        this.recordingProgress$.next({ duration: 0, size: 0 });

        console.log('ScreenRecording: Cleanup completed');
    }
}

export const ScreenRecordingService = new ScreenRecordingServiceClass();