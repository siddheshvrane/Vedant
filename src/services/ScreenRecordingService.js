// src/services/ScreenRecordingService.js

import { PopupService } from './PopupService.js';

/**
 * Screen Recording Service for Flythrough Tools
 * Handles screen recording with optional microphone audio
 */
export class ScreenRecordingService {
    constructor() {
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.isRecording = false;
        this.stream = null;
        this.startTime = null;
        this.recordingConfig = {
            video: {
                mediaSource: 'screen',
                width: { ideal: 1920, max: 1920 },
                height: { ideal: 1080, max: 1080 },
                frameRate: { ideal: 30, max: 60 }
            },
            audio: false // Will be set based on user preference
        };
    }

    /**
     * Shows recording permission dialog and starts recording if approved
     * @param {Object} options - Recording options
     * @param {boolean} options.includeAudio - Whether to include microphone audio
     * @param {string} options.toolName - Name of the tool requesting recording
     * @param {Function} options.onStart - Callback when recording starts
     * @param {Function} options.onStop - Callback when recording stops
     * @param {Function} options.onError - Callback for errors
     * @returns {Promise<boolean>} True if recording started successfully
     */
    async requestRecordingPermission(options = {}) {
        const { 
            includeAudio = false, 
            toolName = 'Flythrough Tool',
            onStart = null,
            onStop = null,
            onError = null 
        } = options;

        try {
            console.log('ScreenRecordingService: Requesting recording permission for', toolName);

            // Show permission dialog
            const userConsent = await this.showRecordingPermissionDialog(includeAudio, toolName);
            
            if (!userConsent.approved) {
                console.log('ScreenRecordingService: User declined recording');
                return false;
            }

            // Start recording with user's preferences
            const success = await this.startRecording({
                includeAudio: userConsent.includeAudio,
                audioDeviceId: userConsent.audioDeviceId,
                onStart,
                onStop,
                onError
            });

            return success;

        } catch (error) {
            console.error('ScreenRecordingService: Error requesting permission:', error);
            if (options.onError) {
                options.onError(error);
            }
            return false;
        }
    }

    /**
     * Shows recording permission dialog using PopupService
     */
    async showRecordingPermissionDialog(includeAudio, toolName) {
        return new Promise(async (resolve) => {
            try {
                // Get available audio devices
                const audioDevices = includeAudio ? await this.getAudioDevices() : [];
                
                // Show permission dialog
                PopupService.showRecordingPermissionDialog({
                    toolName: toolName,
                    includeAudio: includeAudio,
                    audioDevices: audioDevices,
                    onApprove: (config) => {
                        console.log('ScreenRecordingService: Recording approved with config:', config);
                        resolve({
                            approved: true,
                            includeAudio: config.includeAudio,
                            audioDeviceId: config.audioDeviceId
                        });
                    },
                    onDecline: () => {
                        console.log('ScreenRecordingService: Recording declined');
                        resolve({ approved: false });
                    }
                });

            } catch (error) {
                console.error('ScreenRecordingService: Error showing dialog:', error);
                resolve({ approved: false });
            }
        });
    }

    /**
     * Gets available audio input devices
     */
    async getAudioDevices() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioDevices = devices
                .filter(device => device.kind === 'audioinput')
                .map(device => ({
                    deviceId: device.deviceId,
                    label: device.label || `Microphone ${device.deviceId.substr(0, 8)}...`,
                    isDefault: device.deviceId === 'default'
                }));

            console.log('ScreenRecordingService: Found audio devices:', audioDevices);
            return audioDevices;

        } catch (error) {
            console.error('ScreenRecordingService: Error getting audio devices:', error);
            return [];
        }
    }

    /**
     * Starts screen recording with optional audio
     */
    async startRecording(options = {}) {
        const { 
            includeAudio = false, 
            audioDeviceId = null,
            onStart = null,
            onStop = null,
            onError = null 
        } = options;

        if (this.isRecording) {
            console.warn('ScreenRecordingService: Recording already in progress');
            return false;
        }

        try {
            console.log('ScreenRecordingService: Starting recording with options:', { includeAudio, audioDeviceId });

            // Reset recorded chunks
            this.recordedChunks = [];

            // Get screen capture stream
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: this.recordingConfig.video,
                audio: false // We'll handle audio separately for better control
            });

            let finalStream = screenStream;

            // If audio is requested, get microphone stream and combine
            if (includeAudio) {
                try {
                    const audioConstraints = {
                        audio: audioDeviceId ? 
                            { deviceId: { exact: audioDeviceId } } : 
                            true
                    };

                    const audioStream = await navigator.mediaDevices.getUserMedia(audioConstraints);
                    
                    // Combine video and audio streams
                    const combinedStream = new MediaStream([
                        ...screenStream.getVideoTracks(),
                        ...audioStream.getAudioTracks()
                    ]);

                    finalStream = combinedStream;
                    console.log('ScreenRecordingService: Combined screen and audio streams');

                } catch (audioError) {
                    console.warn('ScreenRecordingService: Audio capture failed, continuing with video only:', audioError);
                    PopupService.showToolInstruction(
                        'Microphone access denied. Recording video only.',
                        'Recording Notice',
                        false
                    );
                }
            }

            this.stream = finalStream;

            // Create MediaRecorder
            const options = {
                mimeType: this.getSupportedMimeType(),
                videoBitsPerSecond: 8000000, // 8 Mbps for good quality
                audioBitsPerSecond: 128000   // 128 kbps for audio
            };

            this.mediaRecorder = new MediaRecorder(finalStream, options);

            // Set up event handlers
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                console.log('ScreenRecordingService: Recording stopped');
                this.handleRecordingStop(onStop);
            };

            this.mediaRecorder.onerror = (error) => {
                console.error('ScreenRecordingService: MediaRecorder error:', error);
                if (onError) {
                    onError(error);
                }
            };

            // Handle stream ending (user stops screen share)
            finalStream.getVideoTracks()[0].addEventListener('ended', () => {
                console.log('ScreenRecordingService: Screen sharing ended by user');
                this.stopRecording();
            });

            // Start recording
            this.mediaRecorder.start(1000); // Capture data every second
            this.isRecording = true;
            this.startTime = Date.now();

            console.log('ScreenRecordingService: Recording started successfully');

            if (onStart) {
                onStart();
            }

            return true;

        } catch (error) {
            console.error('ScreenRecordingService: Error starting recording:', error);
            
            // Show user-friendly error message
            let errorMessage = 'Failed to start screen recording. ';
            if (error.name === 'NotAllowedError') {
                errorMessage += 'Permission denied. Please allow screen recording.';
            } else if (error.name === 'NotSupportedError') {
                errorMessage += 'Screen recording is not supported in this browser.';
            } else {
                errorMessage += 'Please try again or use a different browser.';
            }

            PopupService.showToolInstruction(errorMessage, 'Recording Error', true);

            if (onError) {
                onError(error);
            }

            return false;
        }
    }

    /**
     * Stops the current recording
     */
    stopRecording() {
        if (!this.isRecording || !this.mediaRecorder) {
            console.warn('ScreenRecordingService: No active recording to stop');
            return false;
        }

        try {
            console.log('ScreenRecordingService: Stopping recording');

            this.mediaRecorder.stop();
            
            // Stop all tracks
            if (this.stream) {
                this.stream.getTracks().forEach(track => {
                    track.stop();
                });
            }

            this.isRecording = false;
            return true;

        } catch (error) {
            console.error('ScreenRecordingService: Error stopping recording:', error);
            return false;
        }
    }

    /**
     * Handles recording stop and prepares download
     */
    handleRecordingStop(onStopCallback) {
        if (this.recordedChunks.length === 0) {
            console.warn('ScreenRecordingService: No recorded data available');
            PopupService.showToolInstruction(
                'No recording data available. The recording may have failed.',
                'Recording Error',
                true
            );
            return;
        }

        const recordingDuration = this.startTime ? (Date.now() - this.startTime) / 1000 : 0;
        const recordingSize = this.recordedChunks.reduce((total, chunk) => total + chunk.size, 0);

        console.log(`ScreenRecordingService: Recording completed - Duration: ${recordingDuration.toFixed(1)}s, Size: ${(recordingSize / 1024 / 1024).toFixed(2)}MB`);

        // Create download blob
        const mimeType = this.getSupportedMimeType();
        const blob = new Blob(this.recordedChunks, { type: mimeType });
        
        // Generate filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `flythrough-recording-${timestamp}.${this.getFileExtension(mimeType)}`;

        // Show download ready dialog
        this.showDownloadDialog(blob, filename, recordingDuration, recordingSize);

        // Call callback if provided
        if (onStopCallback) {
            onStopCallback({
                blob: blob,
                filename: filename,
                duration: recordingDuration,
                size: recordingSize
            });
        }

        // Clean up
        this.cleanup();
    }

    /**
     * Shows download dialog for the recorded video
     */
    showDownloadDialog(blob, filename, duration, size) {
        const downloadUrl = URL.createObjectURL(blob);
        
        PopupService.showRecordingDownloadDialog({
            filename: filename,
            duration: duration.toFixed(1),
            size: (size / 1024 / 1024).toFixed(2),
            downloadUrl: downloadUrl,
            onDownload: () => {
                this.downloadRecording(blob, filename);
                URL.revokeObjectURL(downloadUrl); // Clean up URL
            },
            onPreview: () => {
                this.previewRecording(downloadUrl);
            },
            onDiscard: () => {
                URL.revokeObjectURL(downloadUrl); // Clean up URL
                console.log('ScreenRecordingService: Recording discarded by user');
            }
        });
    }

    /**
     * Downloads the recording file
     */
    downloadRecording(blob, filename) {
        try {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.style.display = 'none';
            
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            // Clean up URL after a delay
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            
            console.log('ScreenRecordingService: Download initiated for', filename);

            PopupService.showToolInstruction(
                `Recording downloaded: ${filename}`,
                'Download Complete',
                true
            );

        } catch (error) {
            console.error('ScreenRecordingService: Error downloading recording:', error);
            PopupService.showToolInstruction(
                'Error downloading recording. Please try again.',
                'Download Error',
                true
            );
        }
    }

    /**
     * Opens recording in new tab for preview
     */
    previewRecording(url) {
        try {
            const previewWindow = window.open(url, '_blank');
            if (!previewWindow) {
                PopupService.showToolInstruction(
                    'Popup blocked. Please allow popups to preview recording.',
                    'Preview Blocked',
                    true
                );
            }
        } catch (error) {
            console.error('ScreenRecordingService: Error previewing recording:', error);
        }
    }

    /**
     * Gets the best supported MIME type for recording
     */
    getSupportedMimeType() {
        const types = [
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
            'video/webm;codecs=h264,opus',
            'video/webm',
            'video/mp4'
        ];

        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) {
                console.log('ScreenRecordingService: Using MIME type:', type);
                return type;
            }
        }

        console.warn('ScreenRecordingService: No preferred MIME type supported, using default');
        return 'video/webm';
    }

    /**
     * Gets file extension based on MIME type
     */
    getFileExtension(mimeType) {
        if (mimeType.includes('mp4')) return 'mp4';
        if (mimeType.includes('webm')) return 'webm';
        return 'webm'; // default
    }

    /**
     * Cleans up resources
     */
    cleanup() {
        this.mediaRecorder = null;
        this.stream = null;
        this.recordedChunks = [];
        this.isRecording = false;
        this.startTime = null;
        console.log('ScreenRecordingService: Cleanup completed');
    }

    /**
     * Gets current recording status
     */
    getStatus() {
        return {
            isRecording: this.isRecording,
            duration: this.startTime ? (Date.now() - this.startTime) / 1000 : 0,
            chunksCount: this.recordedChunks.length
        };
    }

    /**
     * Checks if screen recording is supported
     */
    static isSupported() {
        return !!(navigator.mediaDevices && 
                 navigator.mediaDevices.getDisplayMedia && 
                 window.MediaRecorder);
    }
}

// Create singleton instance
export const screenRecordingService = new ScreenRecordingService();