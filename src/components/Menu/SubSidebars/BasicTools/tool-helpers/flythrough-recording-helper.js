// src/components/Menu/SubSidebars/BasicTools/tool-helpers/flythrough-recording-helper.js

import { screenRecordingService } from '../../../../../services/ScreenRecordingService.js';
import { PopupService } from '../../../../../services/PopupService.js';

/**
 * Flythrough Recording Integration Helper
 * Provides common recording functionality for all flythrough tools
 */
export class FlythroughRecordingHelper {
    constructor() {
        this.recordingActive = false;
        this.toolName = '';
        this.recordingCallbacks = {
            onStart: null,
            onStop: null,
            onError: null
        };
    }

    /**
     * Initiates recording request before flythrough starts
     * @param {string} toolName - Name of the flythrough tool
     * @param {Object} options - Recording options
     * @param {boolean} options.includeAudio - Whether to include microphone audio
     * @param {Function} options.onRecordingStart - Callback when recording starts
     * @param {Function} options.onRecordingStop - Callback when recording stops
     * @param {Function} options.onRecordingError - Callback for recording errors
     * @param {Function} options.onProceedWithoutRecording - Callback to proceed without recording
     * @returns {Promise<boolean>} True if ready to proceed (with or without recording)
     */
    async requestRecordingForFlythrough(toolName, options = {}) {
        const {
            includeAudio = true,
            onRecordingStart = null,
            onRecordingStop = null,
            onRecordingError = null,
            onProceedWithoutRecording = null
        } = options;

        this.toolName = toolName;
        this.recordingCallbacks = {
            onStart: onRecordingStart,
            onStop: onRecordingStop,
            onError: onRecordingError
        };

        console.log(`FlythroughRecordingHelper: Requesting recording for ${toolName}`);

        // Check if screen recording is supported
        if (!screenRecordingService.constructor.isSupported()) {
            console.warn('FlythroughRecordingHelper: Screen recording not supported');
            
            PopupService.showToolInstruction(
                'Screen recording is not supported in this browser.\n\n' +
                'The flythrough will proceed without recording.\n\n' +
                'For recording support, please use Chrome, Firefox, or Edge.',
                `${toolName} - No Recording Support`,
                true
            );

            if (onProceedWithoutRecording) {
                onProceedWithoutRecording();
            }
            return true; // Proceed without recording
        }

        try {
            // Show recording option dialog
            const userChoice = await this.showRecordingOptionDialog(toolName, includeAudio);

            if (userChoice.skipRecording) {
                console.log('FlythroughRecordingHelper: User chose to skip recording');
                if (onProceedWithoutRecording) {
                    onProceedWithoutRecording();
                }
                return true; // Proceed without recording
            }

            if (userChoice.cancelled) {
                console.log('FlythroughRecordingHelper: User cancelled flythrough');
                return false; // Don't proceed
            }

            // User wants to record - request recording permission
            const recordingStarted = await screenRecordingService.requestRecordingPermission({
                includeAudio: userChoice.includeAudio,
                toolName: toolName,
                onStart: () => {
                    this.recordingActive = true;
                    console.log(`FlythroughRecordingHelper: Recording started for ${toolName}`);
                    
                    if (this.recordingCallbacks.onStart) {
                        this.recordingCallbacks.onStart();
                    }
                },
                onStop: (recordingData) => {
                    this.recordingActive = false;
                    console.log(`FlythroughRecordingHelper: Recording stopped for ${toolName}`);
                    
                    if (this.recordingCallbacks.onStop) {
                        this.recordingCallbacks.onStop(recordingData);
                    }
                },
                onError: (error) => {
                    this.recordingActive = false;
                    console.error(`FlythroughRecordingHelper: Recording error for ${toolName}:`, error);
                    
                    if (this.recordingCallbacks.onError) {
                        this.recordingCallbacks.onError(error);
                    }
                    
                    // Ask if user wants to proceed without recording
                    this.handleRecordingError(error);
                }
            });

            if (recordingStarted) {
                console.log(`FlythroughRecordingHelper: Recording setup complete for ${toolName}`);
                return true; // Proceed with recording active
            } else {
                console.log(`FlythroughRecordingHelper: Recording failed to start for ${toolName}`);
                // Ask if user wants to proceed without recording
                return await this.handleRecordingFailure();
            }

        } catch (error) {
            console.error('FlythroughRecordingHelper: Error setting up recording:', error);
            return await this.handleRecordingFailure();
        }
    }

    /**
     * Shows recording option dialog to user
     */
    async showRecordingOptionDialog(toolName, includeAudio) {
        return new Promise((resolve) => {
            PopupService.showRecordingOptionDialog({
                toolName: toolName,
                includeAudioDefault: includeAudio,
                onRecord: (config) => {
                    resolve({
                        skipRecording: false,
                        cancelled: false,
                        includeAudio: config.includeAudio
                    });
                },
                onSkipRecording: () => {
                    resolve({
                        skipRecording: true,
                        cancelled: false
                    });
                },
                onCancel: () => {
                    resolve({
                        skipRecording: false,
                        cancelled: true
                    });
                }
            });
        });
    }

    /**
     * Handles recording errors by asking user if they want to proceed
     */
    async handleRecordingError(error) {
        return new Promise((resolve) => {
            let errorMessage = 'Recording failed to start. ';
            
            if (error.name === 'NotAllowedError') {
                errorMessage += 'Screen recording permission was denied.';
            } else if (error.name === 'NotSupportedError') {
                errorMessage += 'Screen recording is not supported.';
            } else {
                errorMessage += 'An unknown error occurred.';
            }

            PopupService.showConfirmationDialog({
                title: `${this.toolName} - Recording Error`,
                message: `${errorMessage}\n\nWould you like to proceed with the flythrough without recording?`,
                confirmText: 'Proceed Without Recording',
                cancelText: 'Cancel Flythrough',
                onConfirm: () => {
                    console.log('FlythroughRecordingHelper: User chose to proceed without recording after error');
                    if (this.recordingCallbacks.onStart) {
                        this.recordingCallbacks.onStart(); // Notify that we're proceeding
                    }
                    resolve(true);
                },
                onCancel: () => {
                    console.log('FlythroughRecordingHelper: User cancelled flythrough after recording error');
                    resolve(false);
                }
            });
        });
    }

    /**
     * Handles recording failure by asking user if they want to proceed
     */
    async handleRecordingFailure() {
        return new Promise((resolve) => {
            PopupService.showConfirmationDialog({
                title: `${this.toolName} - Recording Not Available`,
                message: 'Screen recording could not be started.\n\nWould you like to proceed with the flythrough without recording?',
                confirmText: 'Proceed Without Recording',
                cancelText: 'Cancel Flythrough',
                onConfirm: () => {
                    console.log('FlythroughRecordingHelper: User chose to proceed without recording');
                    if (this.recordingCallbacks.onStart) {
                        this.recordingCallbacks.onStart(); // Notify that we're proceeding
                    }
                    resolve(true);
                },
                onCancel: () => {
                    console.log('FlythroughRecordingHelper: User cancelled flythrough');
                    resolve(false);
                }
            });
        });
    }

    /**
     * Stops recording (called when flythrough ends)
     */
    stopRecording() {
        if (this.recordingActive) {
            console.log(`FlythroughRecordingHelper: Stopping recording for ${this.toolName}`);
            screenRecordingService.stopRecording();
            this.recordingActive = false;
        }
    }

    /**
     * Gets current recording status
     */
    getRecordingStatus() {
        return {
            isRecording: this.recordingActive,
            ...screenRecordingService.getStatus()
        };
    }

    /**
     * Forcefully stops recording and cleans up
     */
    cleanup() {
        if (this.recordingActive) {
            this.stopRecording();
        }
        
        this.recordingActive = false;
        this.toolName = '';
        this.recordingCallbacks = {
            onStart: null,
            onStop: null,
            onError: null
        };
        
        console.log('FlythroughRecordingHelper: Cleanup completed');
    }

    /**
     * Shows recording status during flythrough
     */
    showRecordingStatus(flythroughProgress) {
        if (!this.recordingActive) return;

        const status = screenRecordingService.getStatus();
        const recordingInfo = `🔴 Recording: ${status.duration.toFixed(1)}s`;
        
        // This can be called periodically during flythrough to show recording status
        console.log(`FlythroughRecordingHelper: ${recordingInfo} - ${flythroughProgress}`);
        
        // You can update the popup to show recording status alongside flythrough progress
        // This is optional and depends on your PopupService implementation
    }
}

// Export singleton instance for easy use
export const flythroughRecordingHelper = new FlythroughRecordingHelper();

/**
 * Utility function to integrate recording into any flythrough tool
 * This is the main function that flythrough tools should call
 * 
 * @param {string} toolName - Name of the flythrough tool
 * @param {Function} flythroughFunction - The actual flythrough function to execute
 * @param {Object} flythroughOptions - Options to pass to the flythrough function
 * @param {Object} recordingOptions - Recording-specific options
 */
export async function executeFlythroughWithRecording(
    toolName, 
    flythroughFunction, 
    flythroughOptions = {}, 
    recordingOptions = {}
) {
    const {
        includeAudio = true,
        showRecordingStatus = true
    } = recordingOptions;

    console.log(`executeFlythroughWithRecording: Starting ${toolName} with recording integration`);

    try {
        // Request recording setup
        const readyToProceed = await flythroughRecordingHelper.requestRecordingForFlythrough(
            toolName,
            {
                includeAudio: includeAudio,
                onRecordingStart: () => {
                    console.log(`executeFlythroughWithRecording: Recording started for ${toolName}`);
                    
                    if (showRecordingStatus) {
                        PopupService.showToolInstruction(
                            `🔴 Recording started!\n\n${toolName} will begin shortly...`,
                            'Recording Active',
                            false
                        );
                    }
                },
                onRecordingStop: (recordingData) => {
                    console.log(`executeFlythroughWithRecording: Recording completed for ${toolName}`, recordingData);
                },
                onRecordingError: (error) => {
                    console.error(`executeFlythroughWithRecording: Recording error for ${toolName}:`, error);
                },
                onProceedWithoutRecording: () => {
                    console.log(`executeFlythroughWithRecording: Proceeding without recording for ${toolName}`);
                }
            }
        );

        if (!readyToProceed) {
            console.log(`executeFlythroughWithRecording: User cancelled ${toolName}`);
            return false;
        }

        // Execute the actual flythrough function
        console.log(`executeFlythroughWithRecording: Starting ${toolName} execution`);
        
        // Add recording cleanup to flythrough options
        const enhancedOptions = {
            ...flythroughOptions,
            onComplete: (...args) => {
                // Stop recording when flythrough completes
                flythroughRecordingHelper.stopRecording();
                
                // Call original completion callback if provided
                if (flythroughOptions.onComplete) {
                    flythroughOptions.onComplete(...args);
                }
            },
            onError: (...args) => {
                // Stop recording on error
                flythroughRecordingHelper.stopRecording();
                
                // Call original error callback if provided
                if (flythroughOptions.onError) {
                    flythroughOptions.onError(...args);
                }
            }
        };

        // Execute the flythrough
        await flythroughFunction(enhancedOptions);
        
        console.log(`executeFlythroughWithRecording: ${toolName} completed successfully`);
        return true;

    } catch (error) {
        console.error(`executeFlythroughWithRecording: Error in ${toolName}:`, error);
        
        // Ensure recording is stopped on error
        flythroughRecordingHelper.stopRecording();
        
        PopupService.showToolInstruction(
            `${toolName} encountered an error: ${error.message}`,
            'Flythrough Error',
            true
        );
        
        return false;
    }
}