// ScreenRecordingService.js - Enhanced with sidebar management during recording
// Removes getDisplayMedia completely and uses only Electron's native screen capture
// Manages sidebar visibility during recording

import { BehaviorSubject } from 'rxjs';
import { PopupService } from './PopupService.js';
import { UserInterfaceService } from './UserInterfaceService.js';

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

        // Sidebar state management during recording
        this.sidebarStateBeforeRecording = {
            wasOpen: false,
            activeFeature: null,
            sidebarWidth: '0px'
        };

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
     * Store current sidebar state and close sidebar for recording
     */
    prepareSidebarForRecording() {
        try {
            console.log('ScreenRecording: Preparing sidebar for recording...');
            
            // Store current sidebar state
            this.sidebarStateBeforeRecording = {
                wasOpen: UserInterfaceService.isSidebarOpen$.value,
                sidebarWidth: UserInterfaceService.sidebarWidthUpdated$.value,
                activeFeature: null // We'll restore to Basic Tools instead of previous feature
            };

            console.log('ScreenRecording: Stored sidebar state:', this.sidebarStateBeforeRecording);

            // Close sidebar during recording
            if (this.sidebarStateBeforeRecording.wasOpen) {
                UserInterfaceService.closeAll();
                console.log('ScreenRecording: Sidebar closed for recording');
            }

        } catch (error) {
            console.warn('ScreenRecording: Error preparing sidebar:', error);
        }
    }

    /**
     * Restore sidebar state after recording with Basic Tools and Measurement History
     */
    restoreSidebarAfterRecording() {
        try {
            console.log('ScreenRecording: Restoring sidebar after recording...');
            console.log('ScreenRecording: Previous sidebar state:', this.sidebarStateBeforeRecording);

            // Only restore if sidebar was open before recording
            if (this.sidebarStateBeforeRecording.wasOpen) {
                // Open sidebar
                UserInterfaceService.setSidebarOpen(true);
                
                // Activate Basic Tools feature to show Basic Tools Subsidebar with Measurement History
                UserInterfaceService.handleMenuItemClick('Basic Tools');
                
                // Restore sidebar width if it was previously set
                if (this.sidebarStateBeforeRecording.sidebarWidth !== '0px') {
                    UserInterfaceService.updateSidebarWidth(this.sidebarStateBeforeRecording.sidebarWidth);
                }

                console.log('ScreenRecording: Sidebar restored with Basic Tools and Measurement History');
                
                // Show notification about restored state
                PopupService.showNotification('Recording completed! Basic Tools with Measurement History restored.');
            } else {
                console.log('ScreenRecording: Sidebar was closed before recording, keeping it closed');
            }

            // Reset stored state
            this.sidebarStateBeforeRecording = {
                wasOpen: false,
                activeFeature: null,
                sidebarWidth: '0px'
            };

        } catch (error) {
            console.warn('ScreenRecording: Error restoring sidebar:', error);
        }
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
     * Start recording using Electron desktopCapturer with sidebar management
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
            // Prepare sidebar for recording (close it)
            this.prepareSidebarForRecording();

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

            // Get optimal MIME type and options with Electron-specific fallback strategy
            const mimeType = this.getSupportedMimeType();
            
            // Start with very conservative settings for Electron compatibility
            let options = {
                mimeType: 'video/webm; codecs=vp8', // No audio codec initially
                videoBitsPerSecond: 1000000 // 1 Mbps - very conservative
            };

            // Progressive configuration attempts for Electron
            const configAttempts = [
                { mimeType: 'video/webm; codecs=vp8', videoBitsPerSecond: 1000000 },
                { mimeType: 'video/webm', videoBitsPerSecond: 1000000 },
                { mimeType: 'video/webm; codecs=vp8', videoBitsPerSecond: 500000 },
                { mimeType: 'video/webm' } // No bitrate specified
            ];

            console.log('ScreenRecording: Attempting MediaRecorder configuration for Electron...');
            
            let mediaRecorderCreated = false;
            
            for (let i = 0; i < configAttempts.length && !mediaRecorderCreated; i++) {
                const attemptConfig = configAttempts[i];
                
                try {
                    console.log(`ScreenRecording: Attempt ${i + 1}: Testing config:`, attemptConfig);
                    
                    // Test if this configuration is supported
                    if (MediaRecorder.isTypeSupported(attemptConfig.mimeType)) {
                        this.mediaRecorder = new MediaRecorder(combinedStream, attemptConfig);
                        options = attemptConfig;
                        mediaRecorderCreated = true;
                        console.log('ScreenRecording: MediaRecorder created successfully with config:', attemptConfig);
                    } else {
                        console.log(`ScreenRecording: Config ${i + 1} not supported:`, attemptConfig.mimeType);
                    }
                } catch (configError) {
                    console.warn(`ScreenRecording: Config ${i + 1} failed:`, configError);
                    continue;
                }
            }

            // Final fallback - create without any options
            if (!mediaRecorderCreated) {
                try {
                    console.log('ScreenRecording: All configs failed, using default MediaRecorder...');
                    this.mediaRecorder = new MediaRecorder(combinedStream);
                    options = { mimeType: 'default' };
                    mediaRecorderCreated = true;
                } catch (defaultError) {
                    console.error('ScreenRecording: Even default MediaRecorder failed:', defaultError);
                    throw new Error(`Failed to create MediaRecorder: ${defaultError.message}`);
                }
            }

            console.log('ScreenRecording: Final MediaRecorder options used:', options);
            this.recordedChunks = [];

            // Set up event handlers with enhanced logging
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                    console.log('ScreenRecording: Data chunk received, size:', event.data.size, 'Total chunks:', this.recordedChunks.length);
                } else {
                    console.warn('ScreenRecording: Empty data chunk received:', event.data?.size || 0, 'bytes');
                    
                    // Still push empty chunks to maintain count, but don't count them as valid data
                    if (event.data) {
                        console.warn('ScreenRecording: Empty chunk details:', {
                            size: event.data.size,
                            type: event.data.type,
                            lastModified: event.data.lastModified
                        });
                    }
                }
            };

            this.mediaRecorder.onerror = (event) => {
                console.error('ScreenRecording: MediaRecorder error:', event.error);
                this.logRecordingDiagnostics();
                this.cleanup();
                this.restoreSidebarAfterRecording(); // Restore sidebar on error
                PopupService.showNotification(`Recording error: ${event.error}`, true);
            };

            // Additional event handlers for debugging
            this.mediaRecorder.onstart = () => {
                console.log('ScreenRecording: MediaRecorder started successfully');
            };

            this.mediaRecorder.onpause = () => {
                console.log('ScreenRecording: MediaRecorder paused');
            };

            this.mediaRecorder.onresume = () => {
                console.log('ScreenRecording: MediaRecorder resumed');
            };

            this.mediaRecorder.onwarning = (event) => {
                console.warn('ScreenRecording: MediaRecorder warning:', event);
            };

            // Start recording with more frequent data requests and immediate data capture
            console.log('ScreenRecording: Starting MediaRecorder with aggressive chunk collection strategy...');
            
            // Try even more frequent intervals for immediate data detection
            this.mediaRecorder.start(100); // Very frequent chunks to capture any data quickly
            this.recordingStartTime = Date.now();
            this.isRecording$.next(true);
            this.currentStream = combinedStream;

            // Multiple immediate data capture attempts
            const requestDataAttempts = [100, 300, 500, 1000];
            requestDataAttempts.forEach(delay => {
                setTimeout(() => {
                    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                        console.log(`ScreenRecording: Requesting data after ${delay}ms...`);
                        try {
                            this.mediaRecorder.requestData();
                        } catch (requestError) {
                            console.warn(`ScreenRecording: Error requesting data at ${delay}ms:`, requestError);
                        }
                    }
                }, delay);
            });

            // Force a longer recording attempt if no chunks after 2 seconds
            setTimeout(() => {
                if (this.mediaRecorder && this.mediaRecorder.state === 'recording' && this.recordedChunks.length === 0) {
                    console.warn('ScreenRecording: No chunks after 2 seconds, attempting stream restart...');
                    try {
                        // Get video track settings to verify stream health
                        const videoTracks = combinedStream.getVideoTracks();
                        const audioTracks = combinedStream.getAudioTracks();
                        
                        console.log('ScreenRecording: Stream health check:', {
                            videoTracks: videoTracks.length,
                            audioTracks: audioTracks.length,
                            videoEnabled: videoTracks[0]?.enabled,
                            videoReadyState: videoTracks[0]?.readyState,
                            audioEnabled: audioTracks[0]?.enabled,
                            audioReadyState: audioTracks[0]?.readyState
                        });

                        // Try to restart recording with a different approach
                        if (videoTracks[0]?.readyState === 'live' && videoTracks[0]?.enabled) {
                            this.mediaRecorder.requestData();
                            console.log('ScreenRecording: Forced data request after stream health check');
                        } else {
                            console.warn('ScreenRecording: Video track not in optimal state for recording');
                        }
                    } catch (healthCheckError) {
                        console.error('ScreenRecording: Stream health check failed:', healthCheckError);
                    }
                }
            }, 2000);

            // Set up stream ended handlers
            combinedStream.getVideoTracks().forEach(track => {
                track.addEventListener('ended', () => {
                    console.warn('ScreenRecording: Video track ended');
                    this.stopRecording();
                });
            });

            // Start progress tracking
            this.startProgressTracking();

            // Ensure we wait a bit for initial chunk collection
            setTimeout(() => {
                if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                    console.log('ScreenRecording: Recording running for 2 seconds, checking chunk collection...');
                    if (this.recordedChunks.length === 0) {
                        console.warn('ScreenRecording: No chunks collected after 2 seconds - potential recording issue');
                        this.logRecordingDiagnostics();
                    }
                }
            }, 2000);

            console.log('ScreenRecording: Recording started successfully using Electron desktopCapturer');
            PopupService.showNotification('Screen recording started successfully! Sidebar temporarily hidden.');
            return true;

        } catch (error) {
            console.error('ScreenRecording: Failed to start recording:', error);
            this.cleanup();
            this.restoreSidebarAfterRecording(); // Restore sidebar on error
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
                    console.log('ScreenRecording: Chunks collected:', this.recordedChunks.length);

                    // Check if we have any chunks at all
                    if (this.recordedChunks.length === 0) {
                        console.warn('ScreenRecording: No chunks collected - recording may have failed to start properly');
                        this.cleanup();
                        this.restoreSidebarAfterRecording();
                        
                        // For compatibility with ScreenRecordingHelper, return an empty result object instead of null
                        const emptyResult = {
                            blob: new Blob([], { type: this.getOutputMimeType() }),
                            info: this.getRecordingInfo(new Blob([], { type: this.getOutputMimeType() }), recordingStarted),
                            isEmpty: true,
                            error: 'No recording data was captured. This can happen if recording was stopped too quickly or if there were permission issues.'
                        };
                        
                        PopupService.showNotification('Recording stopped - no data was captured. Recording may have been too short or failed to start properly.', true);
                        resolve(emptyResult);
                        return;
                    }

                    const totalSize = this.recordedChunks.reduce((sum, chunk) => sum + chunk.size, 0);
                    console.log('ScreenRecording: Total data size:', this.formatFileSize(totalSize));

                    // Check if total size is meaningful (at least 1KB for a valid recording)
                    if (totalSize < 1024) {
                        console.warn('ScreenRecording: Recording data too small - likely invalid or corrupted');
                        this.cleanup();
                        this.restoreSidebarAfterRecording();
                        
                        const tinyResult = {
                            blob: new Blob(this.recordedChunks, { type: this.getOutputMimeType() }),
                            info: this.getRecordingInfo(new Blob(this.recordedChunks, { type: this.getOutputMimeType() }), recordingStarted),
                            isEmpty: true,
                            error: `Recording data too small (${this.formatFileSize(totalSize)}). Recording may have been too brief or failed.`
                        };
                        
                        PopupService.showNotification(`Recording completed but data is very small (${this.formatFileSize(totalSize)}). Recording may have been too brief.`, true);
                        resolve(tinyResult);
                        return;
                    }

                    const recordingBlob = new Blob(this.recordedChunks, {
                        type: this.getOutputMimeType()
                    });

                    // Final check on blob size
                    if (recordingBlob.size === 0) {
                        console.warn('ScreenRecording: Recording blob is empty after processing');
                        this.cleanup();
                        this.restoreSidebarAfterRecording();
                        
                        PopupService.showNotification('Recording processed but resulted in empty file. Recording may have been too short or failed.', true);
                        resolve(null);
                        return;
                    }

                    const recordingInfo = this.getRecordingInfo(recordingBlob, recordingStarted);
                    this.cleanup(false);

                    // Restore sidebar after successful recording completion
                    this.restoreSidebarAfterRecording();

                    console.log('ScreenRecording: Recording processed successfully');
                    PopupService.showNotification(`Recording completed successfully! Duration: ${recordingInfo.durationFormatted}, Size: ${recordingInfo.sizeFormatted}`);

                    resolve({ blob: recordingBlob, info: recordingInfo });
                } catch (error) {
                    console.error('ScreenRecording: Error processing recording:', error);
                    this.cleanup();
                    this.restoreSidebarAfterRecording(); // Restore sidebar on error
                    PopupService.showNotification(`Recording processing failed: ${error.message}`, true);
                    reject(error);
                }
            };

            this.mediaRecorder.onerror = (event) => {
                console.error('ScreenRecording: MediaRecorder error on stop:', event.error);
                this.cleanup();
                this.restoreSidebarAfterRecording(); // Restore sidebar on error
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
                this.restoreSidebarAfterRecording(); // Restore sidebar on error
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

            // Fallback - should not happen in pure Electron implementation
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
            selectedSource: this.selectedDesktopSource ? this.selectedDesktopSource.name : null,
            sidebarState: this.sidebarStateBeforeRecording
        };
    }

    getSupportedMimeType() {
        // More conservative approach - test in order of reliability
        const types = [
            'video/webm; codecs=vp8,opus',  // Most widely supported
            'video/webm; codecs=vp8',       // VP8 without audio
            'video/webm',                   // Basic WebM
            'video/webm; codecs=vp9,opus',  // VP9 with audio (less compatible)
            'video/webm; codecs=vp9',       // VP9 without audio
            'video/mp4; codecs=h264,aac',   // H.264 with AAC (if supported)
            'video/mp4'                     // Basic MP4
        ];

        for (const type of types) {
            try {
                if (MediaRecorder.isTypeSupported(type)) {
                    console.log('ScreenRecording: Using MIME type:', type);
                    return type;
                }
            } catch (error) {
                console.warn('ScreenRecording: Error testing MIME type:', type, error);
            }
        }

        console.warn('ScreenRecording: No supported MIME type found, using basic webm');
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

    /**
     * Force stop recording and restore sidebar (emergency cleanup)
     */
    forceStopAndRestore() {
        console.log('ScreenRecording: Force stopping recording and restoring sidebar...');
        
        try {
            this.cleanup(true);
            this.restoreSidebarAfterRecording();
            PopupService.showNotification('Recording stopped and sidebar restored.', false);
        } catch (error) {
            console.error('ScreenRecording: Error in force stop:', error);
        }
    }
}

// Singleton pattern to ensure only one instance is created
export const ScreenRecordingService = new ScreenRecordingServiceClass();