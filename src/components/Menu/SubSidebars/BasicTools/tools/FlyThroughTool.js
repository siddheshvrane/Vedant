// src/components/Menu/SubSidebars/BasicTools/tools/FlyThroughTool.js - Complete fix with no getDisplayMedia errors

import * as Cesium from 'cesium';
import { markRaw } from 'vue';
import {
    clearDrawing,
    removeEventHandlers,
    addTemporaryPoint,
    throttle,
    getToolState,
    setToolState,
} from '../tool-helpers/tools-helpers.js';
import { PopupService } from '../../../../../services/PopupService.js';
import { ToolManagementService } from '../../../../../services/ToolManagementService.js';
import { MapService } from '../../../../../services/MapService.js';
import { ScreenRecordingService } from '../../../../../services/ScreenRecordingService.js';
import { FlythroughPlaybackService } from '../../../../../services/FlythroughPlaybackService.js';
import RecordingConfigPopup from '../../../../Popup/popups/RecordingConfigPopup.vue';

// Default configuration values
const DEFAULT_CONFIG = {
    cameraHeight: 20,         // meters above ground
    cameraSpeed: 10,          // meters per second
    cameraTilt: 45,           // degrees (0=straight down, 90=horizontal)
    showProgressUpdates: true, // show progress during animation
    pauseBetweenPoints: 200     // milliseconds pause between flight segments
};

/**
 * Enhanced recording availability check that doesn't trigger getDisplayMedia
 */
function checkRecordingAvailability() {
    try {
        // Check basic API availability without calling them
        const hasDisplayMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
        const hasMediaRecorder = !!window.MediaRecorder;
        const isSecureContext = window.isSecureContext || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
        const isInIframe = window !== window.top;
        
        // Return detailed status without actually testing getDisplayMedia
        return {
            apiAvailable: hasDisplayMedia && hasMediaRecorder,
            secureContext: isSecureContext,
            inIframe: isInIframe,
            supported: hasDisplayMedia && hasMediaRecorder && isSecureContext && !isInIframe,
            reason: !hasDisplayMedia ? 'getDisplayMedia API not available' :
                   !hasMediaRecorder ? 'MediaRecorder API not available' :
                   !isSecureContext ? 'Requires secure context (HTTPS/localhost)' :
                   isInIframe ? 'Cannot record from iframe' :
                   'Recording should be available'
        };
    } catch (error) {
        return {
            apiAvailable: false,
            secureContext: false,
            inIframe: false,
            supported: false,
            reason: `Error checking recording: ${error.message}`
        };
    }
}

/**
 * Sets up the FlyThrough tool with enhanced recording support and context validation
 * @param {Cesium.Viewer} viewer The Cesium Viewer instance.
 */
export function setupFlyThroughTool(viewer) {
    console.log("FlyThroughTool: Setting up enhanced tool with recording support");

    // Get CesiumCoreManager instance from viewer with comprehensive fallback
    const coreManager = getCoreManagerFromViewer(viewer);
    if (!coreManager) {
        console.error("FlyThroughTool: Cannot access CesiumCoreManager");
        PopupService.showToolInstruction(
            "FlyThrough tool requires CesiumCoreManager but it's not available.\n\n" +
            "Please ensure the application is properly initialized.\n\n" +
            "Debug Info:\n" +
            `• Viewer available: ${!!viewer}\n` +
            `• Viewer._coreManager: ${!!viewer?._coreManager}\n` +
            `• window.cesiumCoreManager: ${!!window.cesiumCoreManager}\n` +
            `• MapService.getCoreManager(): ${!!MapService.getCoreManager()}`,
            "Tool Error",
            true
        );
        ToolManagementService.deactivateCurrentTool();
        return;
    }

    console.log("FlyThroughTool: CesiumCoreManager successfully obtained");

    setToolState({
        viewer: viewer,
        coreManager: coreManager,
        handler: viewer ? new Cesium.ScreenSpaceEventHandler(viewer.canvas) : null,
        drawingPoints: [],
        activeShape: null,
        flythroughPath: null,
        animationId: null,
        mousePosition: null,
        config: { ...DEFAULT_CONFIG },
        lastPopupTime: 0,
        isRecordingActive: false,
        recordedBlob: null,
        recordedInfo: null,
        flythroughId: null,
    });

    const { handler } = getToolState();

    const toolName = "Enhanced FlyThrough Tool";

    // Check recording context and show appropriate message without triggering APIs
    const recordingStatus = checkRecordingAvailability();

    let instructionMessage = `Click to add path points (minimum 2). Right-click when ready to configure and start flythrough`;

    if (!recordingStatus.supported) {
        if (!recordingStatus.secureContext) {
            instructionMessage += "\n\n⚠️ Screen recording requires HTTPS or localhost.";
        } else if (recordingStatus.inIframe) {
            instructionMessage += "\n\n⚠️ Screen recording not available in iframe.";
        } else {
            instructionMessage += "\n\n⚠️ Screen recording not available in this browser.";
        }
        instructionMessage += " Flythrough will work without recording.";
    } else {
        instructionMessage += " with optional screen recording.";
    }

    PopupService.showToolInstruction(instructionMessage, toolName);
    console.log("FlyThroughTool: Initial instruction shown with recording context");

    // LEFT_CLICK Handler with reduced popup frequency
    handler.setInputAction((click) => {
        const currentTime = Date.now();
        const { lastPopupTime } = getToolState();

        let cartesian = viewer.scene.pickPosition(click.position);
        if (!Cesium.defined(cartesian)) {
            cartesian = viewer.camera.pickEllipsoid(click.position, viewer.scene.globe.ellipsoid);
        }

        if (Cesium.defined(cartesian)) {
            if (isNaN(cartesian.x) || isNaN(cartesian.y) || isNaN(cartesian.z)) {
                console.error("FlyThroughTool: Invalid position:", cartesian);
                if (currentTime - lastPopupTime > 3000) {
                    PopupService.showToolInstruction(
                        "Invalid position. Please click on the globe.",
                        toolName,
                        true
                    );
                    setToolState({ lastPopupTime: currentTime });
                }
                return;
            }

            const { drawingPoints } = getToolState();
            drawingPoints.push(cartesian);
            setToolState({ drawingPoints: [...drawingPoints] });

            console.log(`FlyThroughTool: Added point ${drawingPoints.length}`);
            addTemporaryPoint(cartesian);

            // Create or update the polyline
            if (drawingPoints.length === 1) {
                const activeShape = viewer.entities.add({
                    polyline: {
                        positions: new Cesium.CallbackProperty(() => {
                            const { drawingPoints: currentDrawingPoints, mousePosition } = getToolState();
                            const positions = [...currentDrawingPoints];
                            if (Cesium.defined(mousePosition)) {
                                positions.push(mousePosition);
                            }
                            return positions;
                        }, false),
                        width: 4,
                        material: Cesium.Color.YELLOW.withAlpha(0.7),
                        clampToGround: true,
                        show: true
                    }
                });
                setToolState({ activeShape: activeShape });
            }

            // Show popup only for significant milestones or after time intervals
            const shouldShowPopup = (
                drawingPoints.length === 1 ||
                drawingPoints.length === 2 ||
                drawingPoints.length % 5 === 0 ||
                (currentTime - lastPopupTime > 10000)
            );

            if (shouldShowPopup) {
                const message = drawingPoints.length === 1
                    ? "First point added. Click to add more points."
                    : drawingPoints.length === 2
                        ? "Minimum points reached. Add more or right-click to configure flythrough."
                        : `${drawingPoints.length} points added. Right-click to start flythrough.`;

                PopupService.showToolInstruction(message, toolName);
                setToolState({ lastPopupTime: currentTime });
            }

            if (viewer.scene.requestRenderMode) {
                viewer.scene.requestRender();
            }
        } else {
            console.warn("FlyThroughTool: Could not pick valid position");
            if (currentTime - lastPopupTime > 5000) {
                PopupService.showToolInstruction(
                    "Please click directly on the globe surface.",
                    toolName,
                    true
                );
                setToolState({ lastPopupTime: currentTime });
            }
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // MOUSE_MOVE Handler
    const throttledMouseMoveHandler = throttle((move) => {
        const { drawingPoints } = getToolState();
        if (drawingPoints.length > 0) {
            let cartesian = viewer.scene.pickPosition(move.endPosition);
            if (!Cesium.defined(cartesian)) {
                cartesian = viewer.camera.pickEllipsoid(move.endPosition, viewer.scene.globe.ellipsoid);
            }

            if (Cesium.defined(cartesian) && !isNaN(cartesian.x) && !isNaN(cartesian.y) && !isNaN(cartesian.z)) {
                setToolState({ mousePosition: cartesian });
            } else {
                setToolState({ mousePosition: null });
            }

            if (viewer.scene.requestRenderMode) {
                viewer.scene.requestRender();
            }
        }
    }, 75);

    handler.setInputAction(throttledMouseMoveHandler, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    // RIGHT_CLICK Handler with enhanced context handling
    handler.setInputAction(async () => {
        console.log("FlyThroughTool: Right-click detected, showing configuration");

        const { drawingPoints, activeShape, config } = getToolState();
        PopupService.hide();

        if (drawingPoints.length < 2) {
            console.warn("FlyThroughTool: Not enough points for flythrough");
            PopupService.showToolInstruction(
                `Need at least 2 points for flythrough. Currently have ${drawingPoints.length}.`,
                `FlyThrough Error`,
                true
            );
            return;
        }

        // Show configuration dialog using PopupService
        PopupService.showFlyThroughForm({
            height: config.cameraHeight,
            tilt: config.cameraTilt,
            speed: config.cameraSpeed,
            duration: null,
            loop: false,
            onStart: async (formConfig) => {
                console.log("FlyThroughTool: Configuration confirmed:", formConfig);

                const finalConfig = {
                    cameraHeight: formConfig.height,
                    cameraSpeed: formConfig.speed,
                    cameraTilt: formConfig.tilt,
                    duration: formConfig.duration,
                    loop: formConfig.loop,
                    showProgressUpdates: config.showProgressUpdates,
                    pauseBetweenPoints: config.pauseBetweenPoints
                };

                console.log("FlyThroughTool: Final mapped config:", finalConfig);

                // Remove event handlers and clean up drawing
                removeEventHandlers();

                if (Cesium.defined(activeShape)) {
                    viewer.entities.remove(activeShape);
                    setToolState({ activeShape: null });
                }
                clearDrawing();

                // Call the new, separate function to handle recording and execution
                await handleFlythroughSetupAndRecording(drawingPoints, finalConfig);
            },
            onCancel: () => {
                console.log("FlyThroughTool: Configuration cancelled");
                PopupService.showToolInstruction(
                    "Flythrough setup cancelled. Continue adding points or right-click again.",
                    toolName
                );
            }
        });

    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
}

/**
 * Helper function to get CesiumCoreManager from viewer
 */
function getCoreManagerFromViewer(viewer) {
    console.log('FlyThroughTool: Looking for CesiumCoreManager...');

    try {
        const coreManagerFromMapService = MapService.getCoreManager();
        if (coreManagerFromMapService) {
            console.log('FlyThroughTool: Found CesiumCoreManager in MapService');
            return coreManagerFromMapService;
        }
    } catch (error) {
        console.warn('FlyThroughTool: Could not get core manager from MapService:', error);
    }

    if (viewer && viewer._coreManager) {
        console.log('FlyThroughTool: Found CesiumCoreManager attached to viewer');
        return viewer._coreManager;
    }

    if (window.cesiumCoreManager) {
        console.log('FlyThroughTool: Found CesiumCoreManager in global window');
        return window.cesiumCoreManager;
    }

    console.error('FlyThroughTool: CesiumCoreManager not found in any expected location');
    return null;
}

/**
 * FIXED: Dedicated function to handle recording setup with complete fallback handling
 */
async function handleFlythroughSetupAndRecording(drawingPoints, config) {
    try {
        console.log("FlyThroughTool: Starting recording setup sequence...");

        const flythroughId = `flythrough_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        setToolState({ flythroughId: flythroughId });

        // Check recording availability without triggering APIs
        const recordingStatus = checkRecordingAvailability();
        let proceedWithRecording = false;

        // Step 1: Handle recording setup based on availability
        if (recordingStatus.supported) {
            // Recording appears to be supported - offer it to the user
            try {
                await ScreenRecordingService.initializeAudioDevices();
                const audioDevices = ScreenRecordingService.availableAudioDevices$.getValue();
                console.log('FlyThroughTool: Available audio devices:', audioDevices.length);

                const recordingChoice = await showRecordingChoiceDialog();
                
                if (recordingChoice.cancelled) {
                    console.log('FlyThroughTool: User cancelled flythrough');
                    ToolManagementService.deactivateCurrentTool();
                    return;
                }

                if (recordingChoice.enableRecording) {
                    const recordingConfig = await showRecordingConfigPopup(audioDevices);
                    
                    if (recordingConfig.cancelled) {
                        console.log('FlyThroughTool: Recording configuration cancelled');
                        ToolManagementService.deactivateCurrentTool();
                        return;
                    }

                    if (recordingConfig.audioSource !== 'skip') {
                        proceedWithRecording = true;
                        ScreenRecordingService.updateConfig({ audioSource: recordingConfig.audioSource });
                    }
                }
            } catch (setupError) {
                console.warn('FlyThroughTool: Recording setup failed:', setupError);
                // Continue without recording
                proceedWithRecording = false;
            }
        } else {
            // Recording is not supported - inform user and continue
            console.log('FlyThroughTool: Recording not supported:', recordingStatus.reason);
            
            const continueWithoutRecording = await showConfirmationDialog(
                'Recording Not Available',
                `Screen recording is not available in this environment:\n\n${recordingStatus.reason}\n\nWould you like to continue with flythrough only (no recording)?`,
                'Continue Without Recording',
                'Cancel Flythrough'
            );

            if (!continueWithoutRecording) {
                console.log('FlyThroughTool: User cancelled due to no recording');
                ToolManagementService.deactivateCurrentTool();
                return;
            }
        }

        // Step 2: Attempt to start recording if user opted in
        let recordingStarted = false;
        if (proceedWithRecording) {
            PopupService.showToolInstruction(
                'Starting screen recording... Please allow permissions if prompted.',
                'Initializing Recording',
                false
            );

            try {
                await new Promise(resolve => setTimeout(resolve, 500));
                recordingStarted = await ScreenRecordingService.startRecording();
                
                if (!recordingStarted) {
                    throw new Error("Recording failed to start - no stream created");
                }
                
                console.log("FlyThroughTool: Screen recording started successfully");
                setToolState({ isRecordingActive: true });
                PopupService.showToolInstruction(
                    'Recording started! Starting flythrough...',
                    'Recording Active',
                    false
                );
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (recordingError) {
                console.error("FlyThroughTool: Recording failed:", recordingError);
                
                // More specific error handling for different types of failures
                let errorMessage = 'Screen recording failed to start.\n\n';
                
                if (recordingError.message && recordingError.message.includes('not supported')) {
                    errorMessage += 'This can happen when:\n' +
                                   '• Browser has disabled screen recording features\n' +
                                   '• Running in a restricted environment\n' +
                                   '• Extensions are blocking screen capture\n' +
                                   '• Security policies prevent recording\n\n';
                } else if (recordingError.message && recordingError.message.includes('permission')) {
                    errorMessage += 'Screen recording permission was denied.\n\n';
                } else {
                    errorMessage += `Error: ${recordingError.message}\n\n`;
                }
                
                errorMessage += 'Would you like to continue the flythrough without recording?';

                const continueWithoutRecording = await showConfirmationDialog(
                    'Recording Failed',
                    errorMessage,
                    'Continue Without Recording',
                    'Cancel Flythrough'
                );

                if (!continueWithoutRecording) {
                    ToolManagementService.deactivateCurrentTool();
                    return;
                }
                recordingStarted = false;
                setToolState({ isRecordingActive: false });
            }
        }

        // Step 3: Execute the flythrough (with or without recording)
        console.log('FlyThroughTool: Proceeding with flythrough. Recording active:', recordingStarted);
        await executeFlythrough(drawingPoints, config, recordingStarted);

    } catch (error) {
        console.error("FlyThroughTool: Critical error during setup:", error);

        // Ensure recording is stopped if it was started
        if (getToolState().isRecordingActive) {
            try {
                await ScreenRecordingService.stopRecording();
                setToolState({ isRecordingActive: false });
            } catch (stopError) {
                console.error("FlyThroughTool: Error stopping recording:", stopError);
            }
        }

        PopupService.showToolInstruction(
            `Flythrough setup failed: ${error.message}`,
            'Error',
            true
        );
        ToolManagementService.deactivateCurrentTool();
    }
}

/**
 * Show initial recording choice dialog
 */
async function showRecordingChoiceDialog() {
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
 * Execute the actual flythrough
 */
async function executeFlythrough(drawingPoints, config, recordingActive) {
    const { coreManager, viewer, flythroughId } = getToolState();

    try {
        console.log("FlyThroughTool: Executing flythrough with terrain sampling");

        // Sample terrain heights
        const sampledPositions = await coreManager.sampleTerrainHeights(drawingPoints, config.cameraHeight);

        if (sampledPositions.length < 2) {
            throw new Error('Could not create valid flythrough path. Please try different points.');
        }

        // Create flythrough path visualization
        const flythroughPath = viewer.entities.add({
            polyline: {
                positions: sampledPositions,
                width: 5,
                material: Cesium.Color.CYAN,
                clampToGround: true,
                show: true,
            }
        });
        setToolState({ flythroughPath: flythroughPath });

        // Calculate total duration
        const totalDuration = FlythroughPlaybackService.calculateFlythroughDuration(sampledPositions, config);

        // Show flythrough status
        const recordingStatus = recordingActive ? "Recording in progress!" : "No recording";
        PopupService.showToolInstruction(
            `Starting flythrough: ${config.cameraHeight}m height, ${config.cameraSpeed}m/s speed, ${config.cameraTilt}° tilt. ${recordingStatus}`,
            'FlyThrough Active',
            false
        );

        config._startTime = Date.now();

        // Create flight animation
        const animationId = coreManager.createFlightAnimation(
            sampledPositions,
            {
                speed: config.cameraSpeed,
                height: config.cameraHeight,
                tilt: config.cameraTilt,
                duration: config.duration,
                pauseBetweenPoints: config.pauseBetweenPoints,
                enableSmoothing: true
            },
            // Progress callback
            (progress) => {
                if (config.showProgressUpdates && (progress.currentIndex % 3 === 0 || progress.currentIndex < 5)) {
                    const progressPercent = Math.round(progress.progress * 100);
                    const recordingText = recordingActive ? "Recording active" : "No recording";
                    PopupService.showToolInstruction(
                        `Flying: ${progressPercent}% complete (${progress.elapsedTime.toFixed(0)}s elapsed) - Point ${progress.currentIndex + 1}/${progress.totalPoints}. ${recordingText}.`,
                        'FlyThrough Progress',
                        false
                    );
                }
            },
            // Completion callback
            async () => {
                console.log("FlyThroughTool: Flythrough animation completed");
                await handleFlythroughCompletion(sampledPositions, config, totalDuration, recordingActive);
            }
        );

        setToolState({ animationId: animationId });

    } catch (error) {
        console.error("FlyThroughTool: Error executing flythrough:", error);
        throw error;
    }
}

/**
 * Handle flythrough completion and recording processing
 */
async function handleFlythroughCompletion(sampledPositions, config, totalDuration, wasRecordingActive) {
    const { flythroughId } = getToolState();

    let recordingBlob = null;
    let recordingInfo = null;

    // Stop recording if it was active
    if (wasRecordingActive) {
        PopupService.showToolInstruction(
            'Flythrough completed. Stopping recording...',
            'Processing Recording',
            false
        );

        try {
            console.log("FlyThroughTool: Stopping recording...");
            const recordingResult = await ScreenRecordingService.stopRecording();

            if (recordingResult && recordingResult.blob && recordingResult.blob.size > 0) {
                recordingBlob = recordingResult.blob;
                recordingInfo = recordingResult.info;
                setToolState({
                    isRecordingActive: false,
                    recordedBlob: recordingBlob,
                    recordedInfo: recordingInfo
                });

                console.log("FlyThroughTool: Recording stopped successfully, size:", recordingBlob.size);

            } else {
                throw new Error("Recording result is empty or invalid");
            }

        } catch (recordingError) {
            console.error('FlyThroughTool: Error stopping recording:', recordingError);
            PopupService.showNotification(`Recording processing failed: ${recordingError.message}`, true);
            setToolState({ isRecordingActive: false });
        }
    } else {
        const totalTime = ((Date.now() - config._startTime) / 1000).toFixed(1);
        console.log("FlyThroughTool: Flythrough completed without recording, total time:", totalTime);
    }

    // Add to measurement history
    const flythroughValue = `${sampledPositions.length} points, ${totalDuration.toFixed(1)}s duration${recordingBlob ? ' (Recorded)' : ''}`;

    const entities = {
        flythroughId: flythroughId,
        recordingBlob: recordingBlob,
        recordingInfo: recordingInfo,
        totalDuration: totalDuration,
        sampledPositions: sampledPositions,
        config: config
    };

    console.log("FlyThroughTool: Creating measurement with entities:", {
        flythroughId: entities.flythroughId,
        hasRecordingBlob: !!entities.recordingBlob,
        totalDuration: entities.totalDuration,
        pathLength: entities.sampledPositions.length
    });

    ToolManagementService.addMeasurement(
        'Flythrough Tool',
        flythroughValue,
        entities
    );

    console.log("FlyThroughTool: Added flythrough to measurement history");

    // Show completion dialog
    if (recordingBlob && recordingInfo) {
        PopupService.showDownloadRecordingForm({
            recordingInfo: recordingInfo,
            onDownload: async () => {
                console.log("FlyThroughTool: Download requested");
                try {
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0];
                    const filename = `flythrough-recording-${timestamp}.webm`;
                    await ScreenRecordingService.downloadRecording(recordingBlob, filename);
                } catch (downloadError) {
                    console.error("FlyThroughTool: Download failed:", downloadError);
                    PopupService.showNotification(`Download failed: ${downloadError.message}`, true);
                }
                ToolManagementService.deactivateCurrentTool();
            },
            onCancel: () => {
                console.log("FlyThroughTool: Download cancelled");
                ToolManagementService.deactivateCurrentTool();
            }
        });
    } else {
        const totalTime = ((Date.now() - config._startTime) / 1000).toFixed(1);
        PopupService.showToolInstruction(
            `Flythrough completed! Total time: ${totalTime}s ${!recordingBlob ? '(No recording was made)' : ''}`,
            "Success",
            false
        );
        setTimeout(() => {
            ToolManagementService.deactivateCurrentTool();
        }, 3000);
    }
}

/**
 * Show recording configuration popup
 */
async function showRecordingConfigPopup(audioDevices) {
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
                    console.log('FlyThroughTool: Recording config selected:', config);
                    resolve({
                        cancelled: false,
                        audioSource: config.audioSource
                    });
                },
                onCancel: () => {
                    console.log('FlyThroughTool: Recording config cancelled');
                    resolve({ cancelled: true });
                }
            }
        });
    });
}

/**
 * Show confirmation dialog
 */
async function showConfirmationDialog(title, message, confirmText, cancelText) {
    return PopupService.showConfirmation(
        message,
        title,
        confirmText,
        cancelText
    );
}

/**
 * Stops the current flythrough animation and cleans up.
 */
export async function stopFlyThrough() {
    console.log("FlyThroughTool: Stopping and cleaning up");

    const { animationId, viewer, flythroughPath, coreManager, isRecordingActive, flythroughId } = getToolState();

    // Cancel flight animation
    if (animationId && coreManager) {
        try {
            coreManager.cancelFlightAnimation(animationId);
            console.log("FlyThroughTool: Flight animation cancelled successfully");
        } catch (error) {
            console.warn("FlyThroughTool: Error cancelling flight animation:", error);
        }
    }

    // Unregister from playback service
    if (flythroughId) {
        try {
            FlythroughPlaybackService.unregisterFlythrough(flythroughId);
            console.log("FlyThroughTool: Unregistered flythrough from playback service");
        } catch (error) {
            console.warn("FlyThroughTool: Error unregistering flythrough:", error);
        }
    }

    // Stop recording if active
    if (isRecordingActive) {
        PopupService.showToolInstruction(
            'Flythrough manually stopped. Stopping recording...',
            'Stopping Recording',
            false
        );
        try {
            const result = await ScreenRecordingService.stopRecording();
            if (result && result.blob) {
                setToolState({
                    isRecordingActive: false,
                    recordedBlob: result.blob,
                    recordedInfo: result.info
                });

                // Offer download
                PopupService.showDownloadRecordingForm({
                    recordingInfo: result.info,
                    onDownload: async () => {
                        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0];
                        const filename = `flythrough-recording-${timestamp}.webm`;
                        await ScreenRecordingService.downloadRecording(result.blob, filename);
                    },
                    onCancel: () => {
                        console.log("FlyThroughTool: Download cancelled after manual stop");
                    }
                });
            }
        } catch (recordingError) {
            console.error('FlyThroughTool: Error stopping recording on manual stop:', recordingError);
            setToolState({ isRecordingActive: false });
        }
    }

    // Clean up visualization
    if (Cesium.defined(flythroughPath) && viewer) {
        viewer.entities.remove(flythroughPath);
        setToolState({ flythroughPath: null });
    }

    clearDrawing();
    removeEventHandlers();

    // Reset tool state
    setToolState({
        drawingPoints: [],
        activeShape: null,
        animationId: null,
        mousePosition: null,
        config: { ...DEFAULT_CONFIG },
        lastPopupTime: 0,
        coreManager: null,
        isRecordingActive: false,
        recordedBlob: null,
        recordedInfo: null,
        flythroughId: null,
    });

    PopupService.hide();
    console.log("FlyThroughTool: Cleanup completed");
}