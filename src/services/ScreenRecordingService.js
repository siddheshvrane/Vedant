// ScreenRecordingService.js - Fixed Audio Device Detection for All Device Types
// Properly detects Bluetooth, AUX, USB, and all connected audio devices

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
        this.permissionGranted = false;

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
     * FIXED: Initialize audio devices with comprehensive detection
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
            console.log('ScreenRecording: Initializing audio devices with enhanced detection...');

            // Start with base devices
            const audioDevicesList = [
                { id: 'none', label: 'No Audio', type: 'none' },
                { id: 'default', label: 'System Default Microphone', type: 'default' }
            ];

            // Try Electron-specific detection first (more reliable)
            if (this.isElectron && window.electron.getAudioDevices) {
                console.log('ScreenRecording: Using Electron audio device detection');
                try {
                    const electronDevices = await window.electron.getAudioDevices();
                    
                    if (electronDevices && electronDevices.length > 0) {
                        // Filter out base devices from Electron results
                        const uniqueDevices = electronDevices.filter(device => 
                            device.id !== 'none' && device.id !== 'default'
                        );
                        
                        audioDevicesList.push(...uniqueDevices);
                        this.audioDevices = audioDevicesList;
                        this.availableAudioDevices$.next(audioDevicesList);
                        console.log(`ScreenRecording: Electron detected ${uniqueDevices.length} unique audio devices`);
                        
                        // Also try browser enumeration to supplement
                        await this.supplementWithBrowserDevices(audioDevicesList);
                        return;
                    }
                } catch (electronError) {
                    console.warn('ScreenRecording: Electron audio detection failed, using browser fallback:', electronError);
                }
            }

            // Browser-based detection with proper permission handling
            await this.detectBrowserAudioDevices(audioDevicesList);

        } catch (error) {
            console.error('ScreenRecording: Failed to initialize audio devices:', error);
            const emergencyFallback = [
                { id: 'none', label: 'No Audio', type: 'none' },
                { id: 'default', label: 'System Default Microphone', type: 'default' }
            ];
            this.audioDevices = emergencyFallback;
            this.availableAudioDevices$.next(emergencyFallback);
        }
    }

    /**
     * FIXED: Detect audio devices using browser APIs with proper permission handling
     */
    async detectBrowserAudioDevices(devicesList) {
        try {
            console.log('ScreenRecording: Starting browser audio device detection...');

            // First check what devices are visible without permission
            const devicesBeforePermission = await navigator.mediaDevices.enumerateDevices();
            const audioInputsBefore = devicesBeforePermission.filter(d => d.kind === 'audioinput');
            
            console.log(`ScreenRecording: Found ${audioInputsBefore.length} audio inputs before permission`);
            
            // Check if we have labels (indicates permission already granted)
            const hasLabels = audioInputsBefore.some(d => d.label && d.label.trim() !== '');
            
            if (!hasLabels) {
                console.log('ScreenRecording: No device labels available, requesting permission...');
                
                // Request permission to get device labels
                try {
                    const permissionStream = await navigator.mediaDevices.getUserMedia({
                        audio: {
                            echoCancellation: false,
                            noiseSuppression: false,
                            autoGainControl: false
                        }
                    });

                    // Store permission state
                    this.permissionGranted = true;
                    console.log('ScreenRecording: Audio permission granted');

                    // Stop the permission stream immediately
                    permissionStream.getTracks().forEach(track => {
                        track.stop();
                        console.log('ScreenRecording: Stopped permission track:', track.label);
                    });

                    // Small delay to ensure device list updates
                    await new Promise(resolve => setTimeout(resolve, 200));

                } catch (permissionError) {
                    console.warn('ScreenRecording: Permission denied or failed:', permissionError);
                    devicesList.push({
                        id: 'permission-denied',
                        label: 'Microphone Permission Required',
                        type: 'disabled',
                        disabled: true
                    });
                    this.audioDevices = devicesList;
                    this.availableAudioDevices$.next(devicesList);
                    return;
                }
            } else {
                console.log('ScreenRecording: Device labels already available (permission granted)');
                this.permissionGranted = true;
            }

            // Now enumerate devices again with labels
            const devicesAfterPermission = await navigator.mediaDevices.enumerateDevices();
            const audioInputs = devicesAfterPermission.filter(device => device.kind === 'audioinput');

            console.log(`ScreenRecording: Found ${audioInputs.length} audio input devices after permission`);

            // Process each device with enhanced detection
            const deviceMap = new Map(); // Use Map to prevent duplicates
            
            audioInputs.forEach((device, index) => {
                // Skip if already in base list or no deviceId
                if (!device.deviceId || device.deviceId === 'default' || device.deviceId === 'communications') {
                    return;
                }

                const label = device.label || `Microphone ${index + 1}`;
                const labelLower = label.toLowerCase();
                
                // Enhanced device type detection
                let deviceType = 'microphone';
                let enhancedLabel = label;

                // Bluetooth detection (multiple patterns)
                if (labelLower.includes('bluetooth') || 
                    labelLower.includes('bt') ||
                    labelLower.includes('wireless') ||
                    labelLower.includes('airpods') ||
                    labelLower.includes('buds') ||
                    labelLower.includes('beats') ||
                    labelLower.includes('bose') ||
                    labelLower.includes('sony wh') ||
                    labelLower.includes('jabra')) {
                    deviceType = 'bluetooth';
                    if (!labelLower.includes('bluetooth')) {
                        enhancedLabel = `${label}`;
                    }
                }
                // Headset/Headphones detection
                else if (labelLower.includes('headset') || 
                         labelLower.includes('headphones') ||
                         labelLower.includes('earphone') ||
                         labelLower.includes('earbuds')) {
                    deviceType = 'headset';
                    enhancedLabel = `🎧 ${label}`;
                }
                // USB detection
                else if (labelLower.includes('usb') || 
                         labelLower.includes('external')) {
                    deviceType = 'usb';
                    enhancedLabel = `🔌 ${label}`;
                }
                // Built-in detection
                else if (labelLower.includes('built-in') || 
                         labelLower.includes('internal') ||
                         labelLower.includes('integrated') ||
                         labelLower.includes('default')) {
                    deviceType = 'builtin';
                    enhancedLabel = `💻 ${label}`;
                }
                // AUX/Line-in detection
                else if (labelLower.includes('line') || 
                         labelLower.includes('aux') ||
                         labelLower.includes('jack') ||
                         labelLower.includes('analog')) {
                    deviceType = 'aux';
                    enhancedLabel = `🔊 ${label}`;
                }
                // Webcam microphone detection
                else if (labelLower.includes('camera') || 
                         labelLower.includes('webcam')) {
                    deviceType = 'webcam';
                    enhancedLabel = `📷 ${label}`;
                }

                // Add to map to prevent duplicates
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

            // Convert map to array and add to device list
            const uniqueDevices = Array.from(deviceMap.values());
            
            // Sort devices: Bluetooth first, then headsets, then USB, then built-in, then others
            const sortOrder = { bluetooth: 1, headset: 2, usb: 3, aux: 4, builtin: 5, webcam: 6, microphone: 7 };
            uniqueDevices.sort((a, b) => {
                const orderA = sortOrder[a.type] || 99;
                const orderB = sortOrder[b.type] || 99;
                if (orderA !== orderB) return orderA - orderB;
                return a.label.localeCompare(b.label);
            });

            devicesList.push(...uniqueDevices);

            console.log(`ScreenRecording: Processed ${uniqueDevices.length} unique audio devices`);
            uniqueDevices.forEach(device => {
                console.log(`  - ${device.label} (${device.type})`);
            });

            this.audioDevices = devicesList;
            this.availableAudioDevices$.next(devicesList);

            // Listen for device changes
            this.setupDeviceChangeListener();

        } catch (error) {
            console.error('ScreenRecording: Browser audio device detection failed:', error);
            devicesList.push({
                id: 'unavailable',
                label: 'Audio devices unavailable',
                type: 'disabled',
                disabled: true
            });
            this.audioDevices = devicesList;
            this.availableAudioDevices$.next(devicesList);
        }
    }

    /**
     * FIXED: Supplement Electron devices with browser enumeration
     */
    async supplementWithBrowserDevices(existingDevices) {
        try {
            console.log('ScreenRecording: Supplementing with browser device detection...');

            if (!this.permissionGranted) {
                const permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                permissionStream.getTracks().forEach(track => track.stop());
                this.permissionGranted = true;
                await new Promise(resolve => setTimeout(resolve, 200));
            }

            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioInputs = devices.filter(d => d.kind === 'audioinput');

            const existingIds = new Set(existingDevices.map(d => d.id));
            let addedCount = 0;

            audioInputs.forEach(device => {
                if (device.deviceId && 
                    device.deviceId !== 'default' && 
                    device.deviceId !== 'communications' &&
                    !existingIds.has(device.deviceId) &&
                    device.label) {
                    
                    const label = device.label;
                    const labelLower = label.toLowerCase();
                    let deviceType = 'microphone';

                    if (labelLower.includes('bluetooth')) deviceType = 'bluetooth';
                    else if (labelLower.includes('headset') || labelLower.includes('headphones')) deviceType = 'headset';
                    else if (labelLower.includes('usb')) deviceType = 'usb';
                    else if (labelLower.includes('aux') || labelLower.includes('line')) deviceType = 'aux';
                    else if (labelLower.includes('built-in')) deviceType = 'builtin';

                    existingDevices.push({
                        id: device.deviceId,
                        label: label,
                        type: deviceType
                    });
                    addedCount++;
                }
            });

            if (addedCount > 0) {
                console.log(`ScreenRecording: Added ${addedCount} supplemental devices from browser`);
                this.audioDevices = existingDevices;
                this.availableAudioDevices$.next(existingDevices);
            }

        } catch (error) {
            console.warn('ScreenRecording: Failed to supplement with browser devices:', error);
        }
    }

    /**
     * NEW: Setup device change listener to detect hotplug events
     */
    setupDeviceChangeListener() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.addEventListener) {
            return;
        }

        try {
            navigator.mediaDevices.addEventListener('devicechange', async () => {
                console.log('ScreenRecording: Audio device change detected, refreshing list...');
                
                // Re-enumerate devices
                const currentDevices = [...this.audioDevices.filter(d => d.id === 'none' || d.id === 'default')];
                await this.detectBrowserAudioDevices(currentDevices);
                
                console.log('ScreenRecording: Audio device list refreshed after device change');
            });
            
            console.log('ScreenRecording: Device change listener setup successfully');
        } catch (error) {
            console.warn('ScreenRecording: Failed to setup device change listener:', error);
        }
    }

    /**
     * NEW: Force refresh audio devices (useful for UI refresh button)
     */
    async refreshAudioDevices() {
        console.log('ScreenRecording: Manually refreshing audio devices...');
        this.initializationPromise = null;
        this.permissionGranted = false;
        return await this.initializeAudioDevices();
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

            const constraints = {
                audio: false,
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
            
            // Log audio track details
            const audioTrack = audioStream.getAudioTracks()[0];
            if (audioTrack) {
                console.log('ScreenRecording: Audio track details:', {
                    label: audioTrack.label,
                    enabled: audioTrack.enabled,
                    muted: audioTrack.muted,
                    readyState: audioTrack.readyState
                });
            }
            
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

        if (!ScreenRecordingServiceClass.isSupported()) {
            const envInfo = ScreenRecordingServiceClass.getEnvironmentInfo();
            console.error('ScreenRecording: Recording not supported:', envInfo);
            throw new Error('Screen recording is only available in the Electron desktop application.');
        }

        try {
            await this.initializeAudioDevices();

            const screenStream = await this.getScreenStream();
            if (!screenStream) {
                throw new Error('Failed to capture screen stream');
            }

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

            const combinedStream = this.combineStreams(screenStream, audioStream);

            const mimeType = this.getSupportedMimeType();
            const options = {
                mimeType: mimeType,
                videoBitsPerSecond: 4000000,
                audioBitsPerSecond: 128000
            };

            console.log('ScreenRecording: MediaRecorder options:', options);

            this.mediaRecorder = new MediaRecorder(combinedStream, options);
            this.recordedChunks = [];

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

            this.mediaRecorder.start(1000);
            this.recordingStartTime = Date.now();
            this.isRecording$.next(true);
            this.currentStream = combinedStream;

            combinedStream.getVideoTracks().forEach(track => {
                track.addEventListener('ended', () => {
                    console.warn('ScreenRecording: Video track ended');
                    this.stopRecording();
                });
            });

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

            if (this.isElectron && window.electron.saveRecording) {
                console.log('ScreenRecording: Using Electron save dialog');
                
                try {
                    const arrayBuffer = await blob.arrayBuffer();
                    
                    if (!arrayBuffer || !(arrayBuffer instanceof ArrayBuffer)) {
                        throw new Error('Failed to convert blob to ArrayBuffer');
                    }
                    
                    console.log('ScreenRecording: Converted blob to ArrayBuffer, size:', arrayBuffer.byteLength, 'bytes');

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
            audioDeviceLabel: this.getAudioDeviceLabel(this.recordingConfig.audioSource),
            environment: 'Electron',
            captureMethod: 'desktopCapturer',
            sourceUsed: this.selectedDesktopSource ? this.selectedDesktopSource.name : 'Unknown'
        };
    }

    getAudioDeviceLabel(deviceId) {
        const device = this.audioDevices.find(d => d.id === deviceId);
        return device ? device.label : 'Unknown Device';
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
            audioDevicesCount: this.audioDevices.length,
            permissionGranted: this.permissionGranted
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

    getDesktopSources() {
        if (!this.isElectron) {
            console.warn('ScreenRecording: Desktop sources only available in Electron');
            return [];
        }
        return this.desktopSources;
    }

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

    async refreshDesktopSources() {
        if (!this.isElectron) {
            console.warn('ScreenRecording: Desktop source refresh only available in Electron');
            return [];
        }

        await this.initializeDesktopSources();
        return this.desktopSources;
    }

    /**
     * Get available audio devices (for UI display)
     */
    getAvailableAudioDevices() {
        return this.audioDevices;
    }

    /**
     * Check if specific device type exists
     */
    hasDeviceType(type) {
        return this.audioDevices.some(device => device.type === type);
    }

    /**
     * Get devices by type
     */
    getDevicesByType(type) {
        return this.audioDevices.filter(device => device.type === type);
    }
}

// Singleton pattern to ensure only one instance is created
export const ScreenRecordingService = new ScreenRecordingServiceClass();