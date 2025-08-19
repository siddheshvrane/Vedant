// src/services/ScreenRecordingService.js

import { BehaviorSubject } from 'rxjs';
import { PopupService } from './PopupService.js';

class ScreenRecordingServiceClass {
    constructor() {
        // Recording state observables
        this.isRecording$ = new BehaviorSubject(false);
        this.recordingProgress$ = new BehaviorSubject({ duration: 0, size: 0 });
        this.availableAudioDevices$ = new BehaviorSubject([]);
        
        // Recording configuration - Updated with realistic settings
        this.recordingConfig = {
            audioSource: 'none', // 'none', 'default', or a deviceId
            videoFormat: 'webm',
            // Realistic quality settings
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
        
        // Debug logging
        this.debugRecordingSetup();
        
        // Initialize audio devices detection
        this.initializeAudioDevices();
    }

    // --- Debug Methods ---
    
    /**
     * Debug the recording setup to identify issues
     */
    debugRecordingSetup() {
        console.log('ScreenRecording: Debug - Checking recording capabilities...');
        console.log('ScreenRecording: Electron API available:', !!window.electron);
        console.log('ScreenRecording: MediaRecorder available:', !!window.MediaRecorder);
        
        if (window.MediaRecorder) {
            console.log('ScreenRecording: WebM support:', MediaRecorder.isTypeSupported('video/webm'));
            console.log('ScreenRecording: WebM+VP9 support:', MediaRecorder.isTypeSupported('video/webm; codecs=vp9'));
            console.log('ScreenRecording: WebM+VP8 support:', MediaRecorder.isTypeSupported('video/webm; codecs=vp8'));
        }
        
        if (navigator.mediaDevices) {
            console.log('ScreenRecording: getUserMedia available:', !!navigator.mediaDevices.getUserMedia);
            console.log('ScreenRecording: getDisplayMedia available:', !!navigator.mediaDevices.getDisplayMedia);
        }
    }

    // --- Public API ---

    /**
     * Initializes and detects all available audio input devices.
     */
    async initializeAudioDevices() {
        try {
            console.log('ScreenRecording: Initializing audio devices...');
            
            // Check if we're in Electron environment
            if (window.electron && window.electron.getAudioDevices) {
                console.log('ScreenRecording: Using Electron audio device detection');
                const electronDevices = await window.electron.getAudioDevices();
                this.audioDevices = electronDevices;
                this.availableAudioDevices$.next(electronDevices);
                console.log('ScreenRecording: Electron audio devices detected:', electronDevices);
                return;
            }

            // Fallback to browser audio device detection
            console.log('ScreenRecording: Using browser audio device detection');
            
            // Request permissions first
            const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            tempStream.getTracks().forEach(track => track.stop()); // Stop the temp stream
            
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
            console.log('ScreenRecording: Browser audio devices detected:', audioDevicesList);
            
        } catch (error) {
            console.error('ScreenRecording: Failed to initialize audio devices:', error);
            const fallbackDevices = [{ id: 'none', label: 'No Audio', type: 'none' }];
            this.audioDevices = fallbackDevices;
            this.availableAudioDevices$.next(fallbackDevices);
        }
    }

    /**
     * Updates the recording configuration.
     */
    updateConfig(newConfig) {
        this.recordingConfig = { ...this.recordingConfig, ...newConfig };
        console.log('ScreenRecording: Configuration updated:', this.recordingConfig);
    }
    
    /**
     * Starts the screen recording.
     */
    async startRecording() {
        if (this.isRecording$.value) {
            console.warn('ScreenRecording: Recording already in progress');
            return false;
        }

        console.log('ScreenRecording: Starting recording with config:', this.recordingConfig);

        try {
            // Get screen capture stream
            const screenStream = await this.getScreenStream();
            if (!screenStream) {
                throw new Error('Failed to capture screen stream');
            }
            console.log('ScreenRecording: Screen stream obtained successfully');

            // Get audio stream based on configuration
            let audioStream = null;
            if (this.recordingConfig.audioSource !== 'none') {
                audioStream = await this.getAudioStream();
                if (audioStream) {
                    console.log('ScreenRecording: Audio stream obtained successfully');
                } else {
                    console.log('ScreenRecording: Audio stream failed, continuing with video only');
                }
            }
            
            // Combine streams
            const combinedStream = this.combineStreams(screenStream, audioStream);
            console.log('ScreenRecording: Streams combined successfully');
            
            // Set up MediaRecorder
            await this.setupMediaRecorder(combinedStream);
            
            // Start recording
            this.mediaRecorder.start(1000); // Collect data every second
            this.recordingStartTime = Date.now();
            this.isRecording$.next(true);
            this.currentStream = combinedStream;
            
            // Start progress tracking
            this.startProgressTracking();
            
            console.log('ScreenRecording: Recording started successfully');
            PopupService.showNotification('Recording started successfully!');
            return true;
            
        } catch (error) {
            console.error('ScreenRecording: Failed to start recording:', error);
            this.cleanup();
            PopupService.showNotification(`Failed to start recording: ${error.message}`, true);
            return false;
        }
    }

    /**
     * Stops the screen recording and processes the result.
     */
    async stopRecording() {
        return new Promise((resolve, reject) => {
            if (!this.isRecording$.value || !this.mediaRecorder) {
                console.warn('ScreenRecording: No active recording to stop');
                resolve(null);
                return;
            }

            console.log('ScreenRecording: Stopping recording...');
            
            // Set up the stop handler before stopping
            this.mediaRecorder.onstop = async () => {
                try {
                    console.log('ScreenRecording: MediaRecorder stopped, processing chunks...');
                    console.log('ScreenRecording: Recorded chunks count:', this.recordedChunks.length);
                    
                    if (this.recordedChunks.length === 0) {
                        throw new Error('No recording data available');
                    }
                    
                    const recordingBlob = new Blob(this.recordedChunks, { 
                        type: this.getOutputMimeType() 
                    });
                    console.log('ScreenRecording: Blob created, size:', recordingBlob.size);
                    
                    const recordingInfo = this.getRecordingInfo(recordingBlob);
                    
                    this.cleanup();
                    PopupService.showNotification('Recording completed successfully!');
                    console.log('ScreenRecording: Recording stopped and processed successfully');

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

            this.mediaRecorder.stop();
        });
    }

    /**
     * Download the recorded video.
     */
    async downloadRecording(blob, filename = null) {
        try {
            if (!blob) {
                throw new Error('No recording data to download.');
            }

            if (!filename) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0];
                filename = `flythrough-recording-${timestamp}.${this.recordingConfig.videoFormat}`;
            }

            console.log('ScreenRecording: Starting download process...');

            // Try Electron first
            if (window.electron && window.electron.saveRecording) {
                console.log('ScreenRecording: Using Electron save dialog');
                const arrayBuffer = await blob.arrayBuffer();
                const result = await window.electron.saveRecording(arrayBuffer, filename, this.getOutputMimeType());
                
                if (result.success) {
                    console.log(`ScreenRecording: File saved successfully to: ${result.filePath}`);
                    PopupService.showNotification(`Recording saved: ${result.filePath}`);
                } else {
                    throw new Error(result.error || 'Unknown save error');
                }
            } else {
                // Fallback for web environment
                console.log('ScreenRecording: Using browser download fallback');
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                console.log(`ScreenRecording: Browser download initiated for ${filename}`);
                PopupService.showNotification(`Download started: ${filename}`);
            }

        } catch (error) {
            console.error('ScreenRecording: Download failed:', error);
            PopupService.showNotification(`Download failed: ${error.message}`, true);
            throw error;
        }
    }

    // --- Internal/Private Methods ---

    /**
     * Get screen capture stream - supports both Electron and browser environments.
     */
    async getScreenStream() {
        try {
            console.log('ScreenRecording: Attempting to get screen stream...');
            
            // Try Electron desktop capturer first
            if (window.electron && window.electron.getDesktopSources) {
                console.log('ScreenRecording: Using Electron desktop capturer');
                const sources = await window.electron.getDesktopSources({ types: ['screen'] });
                
                if (sources.length === 0) {
                    throw new Error('No screen sources available from Electron');
                }

                const primaryScreen = sources[0];
                console.log('ScreenRecording: Using screen source:', primaryScreen.name);

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
                
                console.log('ScreenRecording: Electron screen stream created successfully');
                return stream;
            }
            
            // Fallback to browser screen capture
            console.log('ScreenRecording: Using browser getDisplayMedia fallback');
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    width: { ideal: this.recordingConfig.videoWidth },
                    height: { ideal: this.recordingConfig.videoHeight },
                    frameRate: { ideal: this.recordingConfig.frameRate }
                },
                audio: false
            });
            
            console.log('ScreenRecording: Browser screen stream created successfully');
            return stream;

        } catch (error) {
            console.error('ScreenRecording: Screen capture failed:', error);
            throw new Error(`Screen capture failed: ${error.message}`);
        }
    }

    /**
     * Get audio stream based on the selected configuration.
     */
    async getAudioStream() {
        const audioSourceId = this.recordingConfig.audioSource;
        if (audioSourceId === 'none') {
            return null;
        }

        try {
            console.log('ScreenRecording: Getting audio stream for source:', audioSourceId);
            
            const constraints = {
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: { ideal: 48000 },
                    channelCount: { ideal: 2 }
                }
            };

            // Add device ID constraint if not default
            if (audioSourceId !== 'default') {
                const audioDevice = this.audioDevices.find(d => d.id === audioSourceId);
                if (audioDevice && audioDevice.id !== 'none') {
                    constraints.audio.deviceId = { exact: audioDevice.id };
                }
            }

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            console.log('ScreenRecording: Audio stream created successfully');
            return stream;
            
        } catch (error) {
            console.error('ScreenRecording: Audio capture failed:', error);
            PopupService.showNotification(
                `Audio capture failed: ${error.message}. Continuing with video-only recording.`,
                true
            );
            return null;
        }
    }

    /**
     * Combine video and audio streams into a single stream.
     */
    combineStreams(videoStream, audioStream) {
        if (!audioStream) {
            console.log('ScreenRecording: Using video-only stream');
            return videoStream;
        }

        console.log('ScreenRecording: Combining video and audio streams');
        const combinedStream = new MediaStream();
        
        // Add video tracks
        videoStream.getVideoTracks().forEach(track => {
            combinedStream.addTrack(track);
            console.log('ScreenRecording: Added video track:', track.label);
        });
        
        // Add audio tracks
        audioStream.getAudioTracks().forEach(track => {
            combinedStream.addTrack(track);
            console.log('ScreenRecording: Added audio track:', track.label);
        });
        
        return combinedStream;
    }

    /**
     * Set up MediaRecorder with optimal settings.
     */
    async setupMediaRecorder(stream) {
        console.log('ScreenRecording: Setting up MediaRecorder...');
        
        // Try different codec options in order of preference
        const codecOptions = [
            { mimeType: 'video/webm; codecs=vp9,opus', videoBitsPerSecond: 8000000 },
            { mimeType: 'video/webm; codecs=vp8,opus', videoBitsPerSecond: 6000000 },
            { mimeType: 'video/webm; codecs=vp9', videoBitsPerSecond: 8000000 },
            { mimeType: 'video/webm; codecs=vp8', videoBitsPerSecond: 6000000 },
            { mimeType: 'video/webm', videoBitsPerSecond: 4000000 }
        ];

        let selectedOptions = null;
        for (const options of codecOptions) {
            if (MediaRecorder.isTypeSupported(options.mimeType)) {
                selectedOptions = options;
                console.log('ScreenRecording: Selected codec:', options.mimeType);
                break;
            }
        }

        if (!selectedOptions) {
            console.warn('ScreenRecording: No preferred codecs supported, using default');
            selectedOptions = { videoBitsPerSecond: 4000000 };
        }

        try {
            this.mediaRecorder = new MediaRecorder(stream, selectedOptions);
            console.log('ScreenRecording: MediaRecorder created with options:', selectedOptions);
        } catch (error) {
            console.warn('ScreenRecording: Failed to create MediaRecorder with options, using defaults:', error);
            this.mediaRecorder = new MediaRecorder(stream);
        }

        this.recordedChunks = [];
        
        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                this.recordedChunks.push(event.data);
                console.log(`ScreenRecording: Data chunk received, size: ${event.data.size} bytes`);
            }
        };

        this.mediaRecorder.onerror = (event) => {
            console.error('ScreenRecording: MediaRecorder error:', event.error);
        };

        console.log('ScreenRecording: MediaRecorder setup completed');
    }
    
    /**
     * Start tracking recording progress.
     */
    startProgressTracking() {
        console.log('ScreenRecording: Starting progress tracking');
        this.progressInterval = setInterval(() => {
            const duration = (Date.now() - this.recordingStartTime) / 1000;
            const estimatedSize = this.recordedChunks.reduce((total, chunk) => total + chunk.size, 0);
            
            this.recordingProgress$.next({
                duration: duration,
                size: estimatedSize,
                formattedDuration: this.formatDuration(duration),
                formattedSize: this.formatFileSize(estimatedSize)
            });
        }, 1000);
    }

    /**
     * Get recording information.
     */
    getRecordingInfo(blob) {
        const duration = this.recordingStartTime ? (Date.now() - this.recordingStartTime) / 1000 : 0;
        
        return {
            duration: duration,
            durationFormatted: this.formatDuration(duration),
            size: blob.size,
            sizeFormatted: this.formatFileSize(blob.size),
            format: this.recordingConfig.videoFormat,
            mimeType: blob.type,
            hasAudio: this.recordingConfig.audioSource !== 'none',
            audioSource: this.getAudioSourceLabel(),
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Cleanup recording resources.
     */
    cleanup() {
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
        
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.recordingStartTime = null;
        this.isRecording$.next(false);
        this.recordingProgress$.next({ duration: 0, size: 0 });
        
        console.log('ScreenRecording: Cleanup completed');
    }

    // --- Utility Methods ---

    getOutputMimeType() {
        return 'video/webm';
    }

    getAudioSourceLabel() {
        const device = this.audioDevices.find(d => d.id === this.recordingConfig.audioSource);
        return device ? device.label : 'No Audio';
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
}

export const ScreenRecordingService = new ScreenRecordingServiceClass();