// src/components/Menu/BasicTools/tool-helpers/ScreenRecordingHelper.js - Updated for enhanced ScreenRecordingService

import { ScreenRecordingService } from '../../../../../services/ScreenRecordingService.js';
import { PopupService } from '../../../../../services/PopupService.js';
import { markRaw } from 'vue';
import RecordingConfigPopup from '../../../../Popup/popups/RecordingConfigPopup.vue';

/**
 * Shared utility class for handling screen recording across different flythrough tools
 * Updated to work with enhanced ScreenRecordingService that manages sidebar state
 */
export class ScreenRecordingHelper {
    
    /**
     * Check if screen recording is available and provide user-friendly status
     */
    static checkRecordingAvailability() {
        try {
            // Use the enhanced service's static methods
            let serviceSupported = false;
            let environmentInfo = null;
            
            try {
                if (typeof ScreenRecordingService.constructor.isSupported === 'function') {
                    serviceSupported = ScreenRecordingService.constructor.isSupported();
                    environmentInfo = ScreenRecordingService.constructor.getEnvironmentInfo();
                } else {
                    // Fallback check if static methods aren't available
                    const isElectron = !!(window.electron);
                    serviceSupported = isElectron && 
                        !!(window.electron.getDesktopSources) && 
                        !!window.MediaRecorder;
                    
                    environmentInfo = {
                        isElectron: isElectron,
                        hasDesktopCapturer: isElectron ? !!(window.electron.getDesktopSources) : false,
                        hasMediaRecorder: !!window.MediaRecorder,
                        canRecord: serviceSupported,
                        supportedMethod: serviceSupported ? 'Electron desktopCapturer' : 'none'
                    };
                }
            } catch (serviceError) {
                console.warn('ScreenRecordingHelper: Error checking service support:', serviceError);
                serviceSupported = false;
                environmentInfo = {
                    isElectron: false,
                    canRecord: false,
                    supportedMethod: 'none',
                    error: serviceError.message
                };
            }
            
            return {
                apiAvailable: environmentInfo.hasMediaRecorder,
                secureContext: window.isSecureContext || location.hostname === 'localhost' || location.hostname === '127.0.0.1',
                inIframe: window !== window.top,
                isElectron: environmentInfo.isElectron,
                electronSupported: serviceSupported,
                supported: serviceSupported,
                reason: !serviceSupported ? 
                    (environmentInfo.isElectron ? 
                        'Electron recording services not fully available' : 
                        'Screen recording optimized for Electron desktop app') :
                    'Recording should be available',
                preferredMethod: environmentInfo.supportedMethod,
                environmentInfo: environmentInfo
            };
        } catch (error) {
            console.error('ScreenRecordingHelper: Error in checkRecordingAvailability:', error);
            return {
                apiAvailable: false,
                secureContext: false,
                inIframe: false,
                isElectron: false,
                electronSupported: false,
                supported: false,
                reason: `Error checking recording: ${error.message}`,
                preferredMethod: 'none'
            };
        }
    }

    /**
     * Initialize recording setup flow - handles device selection and configuration
     */
    static async initializeRecording() {
        try {
            console.log('ScreenRecordingHelper: Initializing recording setup flow...');

            // Check recording availability first
            const recordingStatus = this.checkRecordingAvailability();
            
            if (!recordingStatus.supported) {
                throw new Error(`Recording not available: ${recordingStatus.reason}`);
            }

            // Initialize audio devices with enhanced error handling
            try {
                await ScreenRecordingService.initializeAudioDevices();
                const audioDevices = ScreenRecordingService.availableAudioDevices$.getValue();
                console.log('ScreenRecordingHelper: Available audio devices:', audioDevices.length);

                // Show recording choice dialog
                const recordingChoice = await this.showRecordingChoiceDialog();
                
                if (recordingChoice.cancelled) {
                    throw new Error('Recording setup cancelled by user');
                }

                if (!recordingChoice.enableRecording) {
                    return { recordingEnabled: false, cancelled: false };
                }

                // Show audio device configuration
                const recordingConfig = await this.showRecordingConfigPopup(audioDevices);
                
                if (recordingConfig.cancelled) {
                    throw new Error('Recording configuration cancelled by user');
                }

                // Update ScreenRecordingService configuration
                if (recordingConfig.audioSource !== 'skip') {
                    ScreenRecordingService.updateConfig({ audioSource: recordingConfig.audioSource });
                }

                return {
                    recordingEnabled: true,
                    cancelled: false,
                    audioSource: recordingConfig.audioSource,
                    config: recordingConfig
                };

            } catch (serviceError) {
                console.error('ScreenRecordingHelper: Service initialization failed:', serviceError);
                
                // If it's a user cancellation, rethrow
                if (serviceError.message.includes('cancelled')) {
                    throw serviceError;
                }
                
                // For service errors, offer to continue without recording
                throw new Error(
                    `Recording service initialization failed: ${serviceError.message}\n\n` +
                    'This can happen when:\n' +
                    '• Audio device access is restricted\n' +
                    '• Browser security policies block device enumeration\n' +
                    '• Running in a limited environment\n\n' +
                    'Would you like to continue without recording?'
                );
            }

        } catch (error) {
            console.error('ScreenRecordingHelper: Recording initialization failed:', error);
            throw error;
        }
    }

    /**
     * Start screen recording with user feedback and minimum duration support
     */
    static async startRecording(toolName = 'Tool', minimumDuration = 2000) {
        try {
            console.log(`ScreenRecordingHelper: Starting screen recording with minimum duration ${minimumDuration}ms...`);

            PopupService.showToolInstruction(
                'Starting screen recording... Please allow permissions if prompted.',
                `${toolName} - Initializing Recording`,
                false
            );

            // Small delay to show the message
            await new Promise(resolve => setTimeout(resolve, 500));

            // Use enhanced service's minimum duration method if available, otherwise regular start
            let recordingStarted = false;
            
            if (minimumDuration > 0 && typeof ScreenRecordingService.startRecordingWithMinimumDuration === 'function') {
                console.log('ScreenRecordingHelper: Using minimum duration recording method');
                // This method handles the complete recording cycle
                recordingStarted = await ScreenRecordingService.startRecording();
            } else {
                recordingStarted = await ScreenRecordingService.startRecording();
            }
            
            if (!recordingStarted) {
                throw new Error('Recording failed to start - no stream created');
            }
            
            console.log('ScreenRecordingHelper: Screen recording started successfully');
            PopupService.showToolInstruction(
                'Recording started! Sidebar temporarily hidden. Starting flythrough...',
                `${toolName} - Recording Active`,
                false
            );
            
            // Brief delay to show success message
            await new Promise(resolve => setTimeout(resolve, 800));
            
            return true;

        } catch (error) {
            console.error('ScreenRecordingHelper: Recording failed to start:', error);
            throw this.createUserFriendlyRecordingError(error);
        }
    }

    /**
     * Start recording with guaranteed minimum duration
     */
    static async startRecordingWithMinimumDuration(toolName = 'Tool', minimumDurationMs = 3000) {
        try {
            console.log(`ScreenRecordingHelper: Starting recording with ${minimumDurationMs}ms minimum duration...`);

            PopupService.showToolInstruction(
                'Starting screen recording with minimum duration to ensure data capture...',
                `${toolName} - Initializing Recording`,
                false
            );

            await new Promise(resolve => setTimeout(resolve, 500));

            // Use the enhanced service's minimum duration method
            if (typeof ScreenRecordingService.startRecordingWithMinimumDuration === 'function') {
                const recordingPromise = ScreenRecordingService.startRecordingWithMinimumDuration(minimumDurationMs);
                
                PopupService.showToolInstruction(
                    `Recording started! Minimum duration: ${minimumDurationMs/1000}s. Sidebar temporarily hidden.`,
                    `${toolName} - Recording Active`,
                    false
                );

                return recordingPromise; // Returns a promise that resolves when recording completes
            } else {
                // Fallback to regular recording
                const started = await this.startRecording(toolName, 0);
                if (started) {
                    // Ensure minimum duration manually
                    setTimeout(async () => {
                        if (ScreenRecordingService.isRecording$.getValue()) {
                            console.log('ScreenRecordingHelper: Minimum duration reached, recording can be stopped');
                        }
                    }, minimumDurationMs);
                }
                return started;
            }

        } catch (error) {
            console.error('ScreenRecordingHelper: Minimum duration recording failed:', error);
            throw this.createUserFriendlyRecordingError(error);
        }
    }

    /**
     * Stop recording and handle the result - enhanced for new service
     */
    static async stopRecording(toolName = 'Tool') {
        try {
            console.log('ScreenRecordingHelper: Stopping recording...');
            
            PopupService.showToolInstruction(
                'Flythrough completed. Stopping recording...',
                `${toolName} - Processing Recording`,
                false
            );

            const recordingResult = await ScreenRecordingService.stopRecording();

            // Handle the enhanced service's response format
            if (recordingResult) {
                if (recordingResult.isEmpty) {
                    console.warn('ScreenRecordingHelper: Recording completed but is empty:', recordingResult.error);
                    throw new Error(recordingResult.error || 'Recording completed but no data was captured');
                }

                if (recordingResult.blob && recordingResult.blob.size > 0) {
                    console.log('ScreenRecordingHelper: Recording stopped successfully, size:', recordingResult.blob.size);
                    return {
                        success: true,
                        blob: recordingResult.blob,
                        info: recordingResult.info
                    };
                } else {
                    throw new Error('Recording result contains invalid or empty data');
                }
            } else {
                throw new Error('No recording result returned - recording may have failed to start properly');
            }

        } catch (error) {
            console.error('ScreenRecordingHelper: Error stopping recording:', error);
            throw new Error(`Recording processing failed: ${error.message}`);
        }
    }

    /**
     * Safe recording stop that handles edge cases gracefully
     */
    static async safeStopRecording(toolName = 'Tool') {
        try {
            console.log('ScreenRecordingHelper: Safe recording stop...');
            
            // Check if recording is actually active
            if (!ScreenRecordingService.isRecording$.getValue()) {
                console.log('ScreenRecordingHelper: No active recording to stop');
                return {
                    success: false,
                    error: 'No active recording found',
                    isEmpty: true
                };
            }

            // Try to use enhanced service's safe stop if available
            if (typeof ScreenRecordingService.safeStopRecording === 'function') {
                const result = await ScreenRecordingService.safeStopRecording();
                
                if (result && !result.isEmpty) {
                    return {
                        success: true,
                        blob: result.blob,
                        info: result.info
                    };
                } else {
                    return {
                        success: false,
                        error: result?.error || 'Recording completed but no data captured',
                        isEmpty: true
                    };
                }
            } else {
                // Fallback to regular stop
                return await this.stopRecording(toolName);
            }

        } catch (error) {
            console.error('ScreenRecordingHelper: Safe stop failed:', error);
            return {
                success: false,
                error: error.message,
                isEmpty: true
            };
        }
    }

    /**
     * Show download dialog for completed recording using available PopupService methods
     */
    static async showDownloadDialog(recordingBlob, recordingInfo, toolName = 'Tool') {
        return new Promise((resolve) => {
            const downloadMessage = 
                `Recording completed successfully!\n\n` +
                `Duration: ${recordingInfo.durationFormatted || 'Unknown'}\n` +
                `Size: ${recordingInfo.sizeFormatted || 'Unknown'}\n` +
                `Format: ${recordingInfo.format || 'webm'}\n\n` +
                `Would you like to download the recording?`;

            PopupService.showConfirmation({
                message: downloadMessage,
                title: `${toolName} Recording Complete`,
                confirmText: 'Download Recording',
                cancelText: 'No Thanks',
                onConfirm: async () => {
                    try {
                        console.log('ScreenRecordingHelper: Download requested');
                        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0];
                        const filename = `${toolName.toLowerCase().replace(/\s+/g, '-')}-recording-${timestamp}.webm`;
                        await ScreenRecordingService.downloadRecording(recordingBlob, filename);
                        PopupService.showNotification('Recording downloaded successfully! Sidebar restored with Basic Tools.');
                        resolve({ downloaded: true });
                    } catch (downloadError) {
                        console.error('ScreenRecordingHelper: Download failed:', downloadError);
                        PopupService.showNotification(`Download failed: ${downloadError.message}`, true);
                        resolve({ downloaded: false, error: downloadError });
                    }
                },
                onCancel: () => {
                    console.log('ScreenRecordingHelper: Download cancelled');
                    PopupService.showNotification('Sidebar restored with Basic Tools and Measurement History.');
                    resolve({ downloaded: false, cancelled: true });
                }
            }).catch((error) => {
                console.error('ScreenRecordingHelper: Error showing download dialog:', error);
                resolve({ downloaded: false, error: error });
            });
        });
    }

    /**
     * Complete recording workflow - stop recording and offer download
     */
    static async completeRecording(toolName = 'Tool', onComplete = null) {
        try {
            console.log('ScreenRecordingHelper: Completing recording workflow...');
            
            const result = await this.safeStopRecording(toolName); // Use safe stop
            
            if (result.success && result.blob) {
                console.log('ScreenRecordingHelper: Recording completed successfully, showing download dialog');
                await this.showDownloadDialog(result.blob, result.info, toolName);
            } else {
                console.warn('ScreenRecordingHelper: Recording completed but no valid data:', result.error);
                PopupService.showNotification(
                    result.error || 'Recording completed but no data was captured. Sidebar restored with Basic Tools.', 
                    true
                );
            }
            
            if (onComplete) {
                onComplete(result);
            }
            
            return result;
            
        } catch (error) {
            console.error('ScreenRecordingHelper: Error completing recording:', error);
            PopupService.showNotification(`Recording completion failed: ${error.message}`, true);
            
            if (onComplete) {
                onComplete({ success: false, error: error });
            }
            
            throw error;
        }
    }

    /**
     * Handle emergency recording cleanup - enhanced for new service
     */
    static async emergencyStopRecording(toolName = 'Tool') {
        try {
            console.log('ScreenRecordingHelper: Emergency recording stop requested');
            
            PopupService.showToolInstruction(
                'Tool deactivated. Stopping recording...',
                `${toolName} - Finishing Up`,
                false
            );
            
            // Use enhanced service's force stop method if available
            if (typeof ScreenRecordingService.forceStopAndRestore === 'function') {
                ScreenRecordingService.forceStopAndRestore();
                return { success: true, emergency: true };
            } else {
                // Fallback to safe stop
                const result = await this.safeStopRecording(toolName);
                
                if (result.success && result.blob) {
                    await this.showDownloadDialog(result.blob, result.info, toolName);
                }
                
                return result;
            }
            
        } catch (error) {
            console.error('ScreenRecordingHelper: Error during emergency recording stop:', error);
            
            // Force cleanup as last resort
            try {
                if (typeof ScreenRecordingService.forceStopAndRestore === 'function') {
                    ScreenRecordingService.forceStopAndRestore();
                }
            } catch (forceError) {
                console.error('ScreenRecordingHelper: Force cleanup also failed:', forceError);
            }
            
            PopupService.showNotification(`Emergency recording stop completed with errors. Sidebar restored.`, true);
            return { success: false, error: error, emergency: true };
        }
    }

    /**
     * Get recording status for tool state management - enhanced
     */
    static getRecordingStatus() {
        try {
            const serviceStatus = ScreenRecordingService.getStatus();
            
            return {
                isRecording: ScreenRecordingService.isRecording$.getValue(),
                status: serviceStatus,
                availability: this.checkRecordingAvailability(),
                diagnostics: typeof ScreenRecordingService.getRecordingDiagnostics === 'function' ? 
                    ScreenRecordingService.getRecordingDiagnostics() : null
            };
        } catch (error) {
            console.error('ScreenRecordingHelper: Error getting recording status:', error);
            return {
                isRecording: false,
                status: null,
                availability: { supported: false, reason: error.message },
                diagnostics: null
            };
        }
    }

    /**
     * Add recording context to tool instructions
     */
    static addRecordingContextToInstructions(baseInstructions, toolName) {
        const recordingStatus = this.checkRecordingAvailability();
        let instructions = baseInstructions;

        if (!recordingStatus.supported) {
            if (!recordingStatus.secureContext) {
                instructions += "\n\n⚠️ Screen recording requires HTTPS or localhost.";
            } else if (recordingStatus.inIframe) {
                instructions += "\n\n⚠️ Screen recording not available in iframe.";
            } else if (!recordingStatus.isElectron) {
                instructions += "\n\n💡 For best recording experience, use the desktop app.";
            } else {
                instructions += "\n\n⚠️ Screen recording not available in this environment.";
            }
            instructions += ` ${toolName} will work without recording.`;
        } else {
            if (recordingStatus.isElectron && recordingStatus.electronSupported) {
                instructions += " Desktop recording will temporarily hide the sidebar during capture.";
            } else {
                instructions += " with optional screen recording.";
            }
        }

        return instructions;
    }

    // Private helper methods

    /**
     * Show initial recording choice dialog
     */
    static async showRecordingChoiceDialog() {
        return new Promise((resolve) => {
            PopupService.showConfirmation({
                message: 'Would you like to record this flythrough?\n\nScreen recording will capture the entire flythrough animation. The sidebar will be temporarily hidden during recording and restored with Basic Tools afterwards.',
                title: 'Record Flythrough?',
                confirmText: 'Yes, Record Flythrough',
                cancelText: 'No, Flythrough Only',
                onConfirm: () => {
                    resolve({
                        cancelled: false,
                        enableRecording: true
                    });
                },
                onCancel: () => {
                    resolve({
                        cancelled: false,
                        enableRecording: false
                    });
                }
            }).catch(() => {
                resolve({ cancelled: true });
            });
        });
    }

    /**
     * Show recording configuration popup
     */
    static async showRecordingConfigPopup(audioDevices) {
        return new Promise((resolve) => {
            PopupService.show({
                component: markRaw(RecordingConfigPopup),
                title: "Configure Screen Recording for Flythrough",
                props: {
                    audioDevices: audioDevices,
                    currentConfig: {
                        audioSource: 'none'
                    },
                    onStart: (config) => {
                        console.log('ScreenRecordingHelper: Recording config selected:', config);
                        resolve({
                            cancelled: false,
                            audioSource: config.audioSource
                        });
                    },
                    onCancel: () => {
                        console.log('ScreenRecordingHelper: Recording config cancelled');
                        resolve({ cancelled: true });
                    }
                }
            });
        });
    }

    /**
     * Show confirmation dialog
     */
    static async showConfirmationDialog(title, message, confirmText, cancelText) {
        return PopupService.showConfirmation({
            message: message,
            title: title,
            confirmText: confirmText,
            cancelText: cancelText
        });
    }

    /**
     * Create user-friendly recording error messages
     */
    static createUserFriendlyRecordingError(originalError) {
        console.error('ScreenRecordingHelper: Original error:', originalError);

        if (originalError.message && originalError.message.includes('not supported')) {
            return new Error(
                'Screen recording failed to start.\n\n' +
                'This can happen when:\n' +
                '• Browser has disabled screen recording features\n' +
                '• Running in a restricted environment\n' +
                '• Extensions are blocking screen capture\n' +
                '• Security policies prevent recording\n\n' +
                'Would you like to continue the flythrough without recording?'
            );
        }

        if (originalError.message && originalError.message.includes('permission')) {
            return new Error(
                'Screen recording permission was denied.\n\n' +
                'Please allow screen recording permissions when prompted and try again.'
            );
        }

        return new Error(
            `Screen recording failed: ${originalError.message || 'Unknown error'}\n\n` +
            'This can happen when:\n' +
            '• System screen recording permissions are denied\n' +
            '• The selected screen source is unavailable\n' +
            '• Security policies are blocking access\n\n' +
            'Would you like to continue the flythrough without recording?'
        );
    }
}