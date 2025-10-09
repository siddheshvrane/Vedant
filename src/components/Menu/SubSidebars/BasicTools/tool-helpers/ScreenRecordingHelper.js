// src/services/ScreenRecordingHelper.js - Shared utility for screen recording across flythrough tools
// Fixed version with better error handling for isSupported check

import { ScreenRecordingService } from '../../../../../services/ScreenRecordingService.js';
import { PopupService } from '../../../../../services/PopupService.js';
import { markRaw } from 'vue';
import RecordingConfigPopup from '../../../../Popup/popups/RecordingConfigPopup.vue';

/**
 * Shared utility class for handling screen recording across different flythrough tools
 */
export class ScreenRecordingHelper {
    
    /**
     * Check if screen recording is available and provide user-friendly status
     */
    static checkRecordingAvailability() {
        try {
            // Check basic API availability without calling them
            const hasDisplayMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
            const hasMediaRecorder = !!window.MediaRecorder;
            const isSecureContext = window.isSecureContext || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
            const isInIframe = window !== window.top;
            const isElectron = !!(window.electron);
            
            // Safe check for service support
            let electronSupported = false;
            try {
                // Check if the service class and static method exist
                if (ScreenRecordingService && 
                    ScreenRecordingService.constructor && 
                    typeof ScreenRecordingService.constructor.isSupported === 'function') {
                    electronSupported = ScreenRecordingService.constructor.isSupported();
                } else {
                    // Fallback manual check if static method isn't available
                    electronSupported = isElectron && 
                        !!(window.electron.getDesktopSources) && 
                        !!window.MediaRecorder;
                }
            } catch (serviceError) {
                console.warn('ScreenRecordingHelper: Error checking service support:', serviceError);
                // Fallback to manual check
                electronSupported = isElectron && 
                    !!(window.electron && window.electron.getDesktopSources) && 
                    !!window.MediaRecorder;
            }
            
            return {
                apiAvailable: hasDisplayMedia && hasMediaRecorder,
                secureContext: isSecureContext,
                inIframe: isInIframe,
                isElectron: isElectron,
                electronSupported: electronSupported,
                supported: electronSupported || (hasDisplayMedia && hasMediaRecorder && isSecureContext && !isInIframe),
                reason: !isElectron ? 'Screen recording optimized for Electron desktop app' :
                       !electronSupported ? 'Electron recording services not available' :
                       !hasDisplayMedia ? 'getDisplayMedia API not available' :
                       !hasMediaRecorder ? 'MediaRecorder API not available' :
                       !isSecureContext ? 'Requires secure context (HTTPS/localhost)' :
                       isInIframe ? 'Cannot record from iframe' :
                       'Recording should be available',
                preferredMethod: isElectron ? 'Electron desktopCapturer' : 'Browser getDisplayMedia'
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

            // Initialize audio devices with error handling
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
     * Start screen recording with user feedback
     */
    static async startRecording(toolName = 'Tool') {
        try {
            console.log('ScreenRecordingHelper: Starting screen recording...');

            PopupService.showToolInstruction(
                'Starting screen recording... Please allow permissions if prompted.',
                `${toolName} - Initializing Recording`,
                false
            );

            // Small delay to show the message
            await new Promise(resolve => setTimeout(resolve, 500));

            const recordingStarted = await ScreenRecordingService.startRecording();
            
            if (!recordingStarted) {
                throw new Error('Recording failed to start - no stream created');
            }
            
            console.log('ScreenRecordingHelper: Screen recording started successfully');
            PopupService.showToolInstruction(
                'Recording started! Starting flythrough...',
                `${toolName} - Recording Active`,
                false
            );
            
            // Brief delay to show success message
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            return true;

        } catch (error) {
            console.error('ScreenRecordingHelper: Recording failed to start:', error);
            throw this.createUserFriendlyRecordingError(error);
        }
    }

    /**
     * Stop recording and handle the result
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

            if (recordingResult && recordingResult.blob && recordingResult.blob.size > 0) {
                console.log('ScreenRecordingHelper: Recording stopped successfully, size:', recordingResult.blob.size);
                return {
                    success: true,
                    blob: recordingResult.blob,
                    info: recordingResult.info
                };
            } else {
                throw new Error('Recording result is empty or invalid');
            }

        } catch (error) {
            console.error('ScreenRecordingHelper: Error stopping recording:', error);
            throw new Error(`Recording processing failed: ${error.message}`);
        }
    }

    /**
     * Show download dialog for completed recording using available PopupService methods
     */
    static async showDownloadDialog(recordingBlob, recordingInfo, toolName = 'Tool') {
        return new Promise((resolve) => {
            const sizeFormatted = recordingInfo.sizeFormatted || this.formatFileSize(recordingBlob.size);
            const durationFormatted = recordingInfo.durationFormatted || this.formatDuration(recordingInfo.duration || 0);
            
            const message = `Recording completed successfully!\n\n` +
                `📊 Size: ${sizeFormatted}\n` +
                `⏱️ Duration: ${durationFormatted}\n` +
                `📱 Format: ${recordingInfo.format || 'webm'}\n\n` +
                `Would you like to download the recording?`;

            PopupService.showConfirmation(
                message,
                `${toolName} - Recording Complete`,
                'Download Recording',
                'Skip Download'
            ).then(async (shouldDownload) => {
                if (shouldDownload) {
                    try {
                        console.log('ScreenRecordingHelper: Download requested');
                        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0];
                        const filename = `${toolName.toLowerCase().replace(/\s+/g, '-')}-recording-${timestamp}.webm`;
                        await ScreenRecordingService.downloadRecording(recordingBlob, filename);
                        resolve({ downloaded: true });
                    } catch (downloadError) {
                        console.error('ScreenRecordingHelper: Download failed:', downloadError);
                        PopupService.showNotification(`Download failed: ${downloadError.message}`, true);
                        resolve({ downloaded: false, error: downloadError });
                    }
                } else {
                    console.log('ScreenRecordingHelper: Download cancelled by user');
                    resolve({ downloaded: false, cancelled: true });
                }
            }).catch((error) => {
                console.error('ScreenRecordingHelper: Error in download dialog:', error);
                resolve({ downloaded: false, error: error });
            });
        });
    }

    /**
     * Complete recording workflow - stop recording and offer download
     */
    static async completeRecording(toolName = 'Tool', onComplete = null) {
        try {
            const result = await this.stopRecording(toolName);
            
            if (result.success && result.blob) {
                await this.showDownloadDialog(result.blob, result.info, toolName);
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
     * Handle emergency recording cleanup
     */
    static async emergencyStopRecording(toolName = 'Tool') {
        try {
            console.log('ScreenRecordingHelper: Emergency recording stop requested');
            
            PopupService.showToolInstruction(
                'Tool deactivated. Stopping recording...',
                `${toolName} - Finishing Up`,
                false
            );
            
            const result = await this.stopRecording(toolName);
            
            if (result.success && result.blob) {
                await this.showDownloadDialog(result.blob, result.info, toolName);
            }
            
            return result;
            
        } catch (error) {
            console.error('ScreenRecordingHelper: Error during emergency recording stop:', error);
            PopupService.showNotification(`Emergency recording stop failed: ${error.message}`, true);
            return { success: false, error: error };
        }
    }

    /**
     * Get recording status for tool state management
     */
    static getRecordingStatus() {
        return {
            isRecording: ScreenRecordingService.isRecording$.getValue(),
            status: ScreenRecordingService.getStatus(),
            availability: this.checkRecordingAvailability()
        };
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
                instructions += "\n\n⚠️ Screen recording not available in this browser.";
            }
            instructions += ` ${toolName} will work without recording.`;
        } else {
            if (recordingStatus.isElectron && recordingStatus.electronSupported) {
                instructions += " with desktop-quality screen recording.";
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
            PopupService.showConfirmation(
                'Would you like to record this flythrough?\n\nScreen recording will capture the entire flythrough animation. You can choose audio settings in the next step.',
                'Record Flythrough?',
                'Yes, Record Flythrough',
                'No, Flythrough Only'
            ).then((enableRecording) => {
                resolve({
                    cancelled: false,
                    enableRecording: enableRecording
                });
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
        return PopupService.showConfirmation(
            message,
            title,
            confirmText,
            cancelText
        );
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

    // Utility methods for formatting

    /**
     * Format duration in seconds to MM:SS format
     */
    static formatDuration(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Format file size in bytes to human-readable format
     */
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}