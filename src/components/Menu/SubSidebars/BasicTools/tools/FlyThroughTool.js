// src/components/Menu/SubSidebars/BasicTools/tools/FlyThroughTool.js

import * as Cesium from 'cesium';
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
    cameraHeight: 20,           // meters above ground
    cameraSpeed: 10,            // meters per second
    cameraTilt: 45,             // degrees (0=straight down, 90=horizontal)
    showProgressUpdates: true,  // show progress during animation
    pauseBetweenPoints: 200     // milliseconds pause between flight segments
};

/**
 * Sets up the FlyThrough tool with reduced popup frequency and user configuration.
 * @param {Cesium.Viewer} viewer The Cesium Viewer instance.
 */
export function setupFlyThroughTool(viewer) {
    console.log("FlyThroughTool: Setting up enhanced tool with configuration options");

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
    PopupService.showToolInstruction(
        `Click to add path points (minimum 2). Right-click when ready to configure and start flythrough.`,
        toolName
    );
    console.log("FlyThroughTool: Initial instruction shown.");

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

    // RIGHT_CLICK Handler with configuration dialog
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

                // Start flythrough with the properly mapped configuration
                await startConfiguredFlyThrough(drawingPoints, finalConfig);
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
 * Helper function to get CesiumCoreManager from viewer with comprehensive fallback methods
 */
function getCoreManagerFromViewer(viewer) {
    console.log('FlyThroughTool: Looking for CesiumCoreManager...');

    // Method 1: Check MapService first (most reliable)
    try {
        const coreManagerFromMapService = MapService.getCoreManager();
        if (coreManagerFromMapService) {
            console.log('FlyThroughTool: ✅ Found CesiumCoreManager in MapService');
            return coreManagerFromMapService;
        }
    } catch (error) {
        console.warn('FlyThroughTool: Could not get core manager from MapService:', error);
    }

    // Method 2: Check if attached to viewer
    if (viewer && viewer._coreManager) {
        console.log('FlyThroughTool: ✅ Found CesiumCoreManager attached to viewer');
        return viewer._coreManager;
    }

    // Method 3: Check global reference
    if (window.cesiumCoreManager) {
        console.log('FlyThroughTool: ✅ Found CesiumCoreManager in global window');
        return window.cesiumCoreManager;
    }

    console.warn('FlyThroughTool: CesiumCoreManager not immediately available, checking initialization status...');

    // Log detailed debug information
    console.error('FlyThroughTool: ❌ CesiumCoreManager not found in any expected location');
    console.error('FlyThroughTool: Debug information:');
    console.error(`  • viewer exists: ${!!viewer}`);
    console.error(`  • viewer._coreManager exists: ${!!viewer?._coreManager}`);
    console.error(`  • window.cesiumCoreManager exists: ${!!window.cesiumCoreManager}`);
    console.error(`  • MapService.getCoreManager() exists: ${!!MapService.getCoreManager()}`);

    return null;
}

// Updated startConfiguredFlyThrough function with enhanced recording integration
async function startConfiguredFlyThrough(drawingPoints, config) {
    const { coreManager } = getToolState();

    PopupService.showToolInstruction(
        'Preparing flythrough path and recording options...',
        'Processing FlyThrough',
        false
    );

    try {
        // Step 1: Generate unique flythrough ID
        const flythroughId = `flythrough_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        setToolState({ flythroughId: flythroughId });

        // Step 2: Test Electron API availability
        if (window.electron && window.electron.testElectronAPI) {
            const testResult = window.electron.testElectronAPI();
            console.log('FlyThroughTool: Electron API test result:', testResult);
        } else {
            console.warn('FlyThroughTool: Electron API not available, will use browser fallbacks');
        }

        // Step 3: Initialize audio devices if not already done
        console.log('FlyThroughTool: Initializing audio devices...');
        await ScreenRecordingService.initializeAudioDevices();

        // Step 4: Get available audio devices and prompt user for selection
        const audioDevices = ScreenRecordingService.availableAudioDevices$.getValue();
        console.log('FlyThroughTool: Available audio devices:', audioDevices);

        // Handle audio device selection
        let selectedAudioDeviceId = 'none'; // Default to no audio

        try {
            // Show audio device selection popup and wait for user choice
            const selectedDevice = await new Promise((resolve, reject) => {
                PopupService.show({
                    component: RecordingConfigPopup,
                    title: "Configure Screen Recording",
                    props: {
                        audioDevices: audioDevices,
                        currentConfig: {
                            audioSource: 'none'
                        },
                        onStart: (config) => {
                            console.log('FlyThroughTool: User selected audio config:', config);
                            resolve(config.audioSource);
                        },
                        onCancel: () => {
                            console.log('FlyThroughTool: User cancelled audio selection');
                            reject(new Error("Audio device selection canceled by user"));
                        },
                    },
                    onSelect: (config) => {
                        console.log('FlyThroughTool: Fallback onSelect called:', config);
                        resolve(config?.audioSource || 'none');
                    },
                    onCancel: () => {
                        console.log('FlyThroughTool: Fallback onCancel called');
                        reject(new Error("Audio device selection canceled by user"));
                    },
                });
            });

            selectedAudioDeviceId = selectedDevice || 'none';
            console.log('FlyThroughTool: Selected audio device:', selectedAudioDeviceId);

        } catch (audioSelectionError) {
            console.warn('FlyThroughTool: Audio device selection failed:', audioSelectionError);
            
            // If user cancels or there's an error, ask if they want to continue without recording
            const continueWithoutRecording = await new Promise((resolve) => {
                PopupService.showConfirmation({
                    title: "Continue Without Recording?",
                    message: `Audio device selection was cancelled. Would you like to continue the flythrough without screen recording?`,
                    confirmText: "Continue",
                    cancelText: "Cancel",
                    onConfirm: () => resolve(true),
                    onCancel: () => resolve(false)
                });
            });

            if (!continueWithoutRecording) {
                console.log('FlyThroughTool: User chose to cancel flythrough');
                PopupService.showToolInstruction(
                    'Flythrough cancelled by user.',
                    'Cancelled',
                    true
                );
                ToolManagementService.deactivateCurrentTool();
                return;
            }

            // Continue without recording
            selectedAudioDeviceId = 'none';
            console.log('FlyThroughTool: Continuing without recording');
        }

        // Step 5: Update ScreenRecordingService config with the selected audio device
        ScreenRecordingService.updateConfig({ audioSource: selectedAudioDeviceId });

        // Step 6: Start screen recording with enhanced error handling
        console.log("FlyThroughTool: Starting screen recording...");

        PopupService.showToolInstruction(
            'Starting screen recording... This may take a few seconds.',
            'Initializing Recording',
            false
        );

        let recordingStarted = false;
        try {
            recordingStarted = await ScreenRecordingService.startRecording();
            console.log("FlyThroughTool: Screen recording start result:", recordingStarted);
        } catch (recordingError) {
            console.error("FlyThroughTool: Screen recording failed to start:", recordingError);
            
            // Ask user if they want to continue without recording
            const continueWithoutRecording = await new Promise((resolve) => {
                PopupService.showConfirmation({
                    title: "Recording Failed - Continue?",
                    message: `Screen recording failed to start: ${recordingError.message}\n\nWould you like to continue the flythrough without recording?`,
                    confirmText: "Continue Without Recording",
                    cancelText: "Cancel Flythrough",
                    onConfirm: () => resolve(true),
                    onCancel: () => resolve(false)
                });
            });

            if (!continueWithoutRecording) {
                throw new Error(`Screen recording failed and user chose to cancel: ${recordingError.message}`);
            }

            recordingStarted = false;
            PopupService.showNotification("Continuing flythrough without recording", false);
        }

        if (recordingStarted) {
            console.log("FlyThroughTool: Screen recording started successfully");
            setToolState({ isRecordingActive: true });
        } else {
            console.log("FlyThroughTool: Continuing without screen recording");
            setToolState({ isRecordingActive: false });
        }

        // Step 7: Continue with terrain sampling and flythrough
        console.log("FlyThroughTool: Starting terrain sampling with config:", config);

        // Use CesiumCoreManager for terrain sampling
        const sampledPositions = await coreManager.sampleTerrainHeights(drawingPoints, config.cameraHeight);

        if (sampledPositions.length < 2) {
            PopupService.showToolInstruction(
                'Could not create valid flythrough path. Please try different points.',
                'FlyThrough Error',
                true
            );
            ToolManagementService.deactivateCurrentTool();
            
            // Stop recording if it was started
            if (getToolState().isRecordingActive) {
                try {
                    await ScreenRecordingService.stopRecording();
                    setToolState({ isRecordingActive: false });
                } catch (stopError) {
                    console.warn("FlyThroughTool: Error stopping recording after path failure:", stopError);
                }
            }
            return;
        }

        const { viewer } = getToolState();
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

        // Calculate total duration for the flythrough
        const totalDuration = FlythroughPlaybackService.calculateFlythroughDuration(sampledPositions, config);

        const recordingStatus = getToolState().isRecordingActive ? "Recording in progress!" : "No recording";
        PopupService.showToolInstruction(
            `Starting flythrough: ${config.cameraHeight}m height, ${config.cameraSpeed}m/s speed, ${config.cameraTilt}° tilt. ${recordingStatus}`,
            'FlyThrough Active',
            false
        );

        // Store start time in config for completion message
        config._startTime = Date.now();

        // Create flight animation using CesiumCoreManager
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
                    const recordingText = getToolState().isRecordingActive ? "Recording active" : "No recording";
                    PopupService.showToolInstruction(
                        `Flying: ${progressPercent}% complete (${progress.elapsedTime.toFixed(0)}s elapsed) - Point ${progress.currentIndex + 1}/${progress.totalPoints}. ${recordingText}.`,
                        'FlyThrough Progress',
                        false
                    );
                }
            },
            // Completion callback
            async () => {
    console.log("FlyThroughTool: Flythrough animation completed.");
    const { isRecordingActive, flythroughId: currentFlythroughId } = getToolState();

    let recordingBlob = null;
    let recordingInfo = null;

    if (isRecordingActive) {
        PopupService.showToolInstruction(
            'Flythrough completed. Stopping recording...',
            'Finishing Up',
            false
        );
        try {
            console.log("FlyThroughTool: Stopping recording...");
            const recordingResult = await ScreenRecordingService.stopRecording();

            if (!recordingResult) {
                throw new Error("Recording stop returned null result");
            }

            const { blob, info } = recordingResult;

            if (!blob || blob.size === 0) {
                throw new Error("Recording blob is empty or null");
            }

            recordingBlob = blob;
            recordingInfo = info;
            setToolState({ isRecordingActive: false, recordedBlob: blob, recordedInfo: info });

            console.log("FlyThroughTool: Recording stopped successfully, blob size:", blob.size);

        } catch (recordingError) {
            console.error('FlyThroughTool: Error stopping recording:', recordingError);
            PopupService.showToolInstruction(
                `Flythrough completed, but recording failed: ${recordingError.message}`,
                'Recording Error',
                true
            );
            setToolState({ isRecordingActive: false });
        }
    } else {
        const totalTime = ((Date.now() - config._startTime) / 1000).toFixed(1);
        console.log("FlyThroughTool: Flythrough completed without recording, total time:", totalTime);
    }

    // Add to measurement history with enhanced flythrough data
    const flythroughValue = `${sampledPositions.length} points, ${totalDuration.toFixed(1)}s duration${recordingBlob ? ' (Recorded)' : ''}`;
    
    // Create entities object with serializable data only - FIXED STRUCTURE
    const entities = {
        // CRITICAL: Use the current flythrough ID, but make sure it's properly set
        flythroughId: currentFlythroughId, // This is the key that was missing!
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
        pathLength: entities.sampledPositions.length,
        hasConfig: !!entities.config
    });

    // Add to measurement history - pass entities properly
    const addedMeasurement = ToolManagementService.addMeasurement(
        'Flythrough Tool',
        flythroughValue,
        entities // Pass entities directly, not as cesiumEntities
    );

    console.log("FlyThroughTool: Added flythrough to measurement history");

    // Clean up the temporary flythrough registration since we now use the measurement
    if (currentFlythroughId) {
        FlythroughPlaybackService.unregisterFlythrough(currentFlythroughId);
        console.log("FlyThroughTool: Cleaned up temporary flythrough registration:", currentFlythroughId);
    }

    // Show completion message
    if (recordingBlob && recordingInfo) {
        PopupService.showDownloadRecordingForm({
            recordingInfo: recordingInfo,
            onDownload: async (downloadOptions) => {
                console.log("FlyThroughTool: Download requested with options:", downloadOptions);
                try {
                    const filename = `flythrough-recording-${recordingInfo.timestamp.replace(/[:.]/g, '-').split('.')[0]}.${recordingInfo.format}`;
                    await ScreenRecordingService.downloadRecording(recordingBlob, filename);
                } catch (downloadError) {
                    console.error("FlyThroughTool: Download failed:", downloadError);
                    PopupService.showNotification(`Download failed: ${downloadError.message}`, true);
                }
            },
            onCancel: () => {
                console.log("FlyThroughTool: Download cancelled by user.");
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
        ToolManagementService.deactivateCurrentTool();
    }
}
        );

        // Store animation ID for potential cancellation
        setToolState({ animationId: animationId });

    } catch (error) {
        console.error("FlyThroughTool: Error during flythrough setup or recording start:", error);
        console.error("FlyThroughTool: Error stack:", error.stack);

        // Ensure recording is stopped if an error occurs
        const { isRecordingActive } = getToolState();
        if (isRecordingActive) {
            try {
                await ScreenRecordingService.stopRecording();
                setToolState({ isRecordingActive: false });
                console.log("FlyThroughTool: Recording stopped due to error");
            } catch (stopError) {
                console.error("FlyThroughTool: Error stopping recording after failure:", stopError);
            }
        }

        // Provide user-friendly error message
        let userMessage = `Flythrough failed: ${error.message || 'Unknown error occurred'}`;
        
        if (error.message && error.message.includes('canceled')) {
            userMessage = 'Flythrough setup was cancelled by user.';
        }

        PopupService.showToolInstruction(userMessage, `FlyThrough Error`, true);
        ToolManagementService.deactivateCurrentTool();
    }

    const { viewer } = getToolState();
    if (viewer && viewer.scene.requestRenderMode) {
        viewer.scene.requestRender();
    }
}

/**
 * Stops the current flythrough animation and cleans up.
 */
export async function stopFlyThrough() {
    console.log("FlyThroughTool: Stopping and cleaning up");

    const { animationId, viewer, flythroughPath, coreManager, isRecordingActive, flythroughId } = getToolState();

    // Cancel flight animation using CesiumCoreManager
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
            console.log("FlyThroughTool: Unregistered flythrough from playback service:", flythroughId);
        } catch (error) {
            console.warn("FlyThroughTool: Error unregistering flythrough:", error);
        }
    }

    // Stop recording if active and triggered by manual stop
    if (isRecordingActive) {
        PopupService.showToolInstruction(
            'Flythrough manually stopped. Stopping recording...',
            'Finishing Up',
            false
        );
        try {
            const { blob, info } = await ScreenRecordingService.stopRecording();
            setToolState({ isRecordingActive: false, recordedBlob: blob, recordedInfo: info });

            // Offer download after recording stops due to manual intervention
            PopupService.showDownloadRecordingForm({
                recordingInfo: info,
                onDownload: (downloadOptions) => {
                    console.log("FlyThroughTool: Download requested after manual stop:", downloadOptions);
                    ScreenRecordingService.downloadRecording(blob, info.timestamp);
                },
                onCancel: () => {
                    console.log("FlyThroughTool: Download cancelled by user after manual stop.");
                }
            });

        } catch (recordingError) {
            console.error('FlyThroughTool: Error stopping recording on manual stop:', recordingError);
            PopupService.showToolInstruction(
                `Recording failed to stop or save on manual stop: ${recordingError.message}`,
                'Recording Error',
                true
            );
            setToolState({ isRecordingActive: false });
        }
    }

    if (Cesium.defined(flythroughPath) && viewer) {
        viewer.entities.remove(flythroughPath);
        setToolState({ flythroughPath: null });
    }

    clearDrawing();
    removeEventHandlers();

    // Reset all tool state variables
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