// src/components/Menu/SubSidebars/BasicTools/tools/FlyThroughTool.js - Updated with shared recording helper

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
import { FlythroughPlaybackService } from '../../../../../services/FlythroughPlaybackService.js';
import { ScreenRecordingHelper } from '../tool-helpers/ScreenRecordingHelper.js';

// Default configuration values
const DEFAULT_CONFIG = {
    cameraHeight: 20,         // meters above ground
    cameraSpeed: 10,          // meters per second
    cameraTilt: 45,           // degrees (0=straight down, 90=horizontal)
    showProgressUpdates: true, // show progress during animation
    pauseBetweenPoints: 200     // milliseconds pause between flight segments
};

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

    const toolName = "FlyThrough Tool";

    // Get enhanced instructions with recording context
    const baseInstructions = `Click to add path points (minimum 2). Right-click when ready to configure and start flythrough`;
    const instructionMessage = ScreenRecordingHelper.addRecordingContextToInstructions(baseInstructions, toolName);

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

                // Use the shared recording helper
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
 * Enhanced function using shared recording helper
 */
async function handleFlythroughSetupAndRecording(drawingPoints, config) {
    try {
        console.log("FlyThroughTool: Starting recording setup sequence...");

        const flythroughId = `flythrough_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        setToolState({ flythroughId: flythroughId });

        let recordingActive = false;

        // Use shared recording helper for setup
        try {
            const recordingSetup = await ScreenRecordingHelper.initializeRecording();
            
            if (recordingSetup.cancelled) {
                console.log('FlyThroughTool: User cancelled flythrough');
                ToolManagementService.deactivateCurrentTool();
                return;
            }

            if (recordingSetup.recordingEnabled) {
                recordingActive = await ScreenRecordingHelper.startRecording('FlyThrough Tool');
                setToolState({ isRecordingActive: recordingActive });
            }
        } catch (recordingError) {
            console.warn('FlyThroughTool: Recording setup failed:', recordingError);
            
            // Check if it's a user-friendly error that allows continuation
            const continueWithoutRecording = await ScreenRecordingHelper.showConfirmationDialog(
                'Recording Setup Failed',
                `${recordingError.message}\n\nWould you like to continue with flythrough only (no recording)?`,
                'Continue Without Recording',
                'Cancel Flythrough'
            );

            if (!continueWithoutRecording) {
                ToolManagementService.deactivateCurrentTool();
                return;
            }
            recordingActive = false;
            setToolState({ isRecordingActive: false });
        }

        // Execute the flythrough (with or without recording)
        console.log('FlyThroughTool: Proceeding with flythrough. Recording active:', recordingActive);
        await executeFlythrough(drawingPoints, config, recordingActive);

    } catch (error) {
        console.error("FlyThroughTool: Critical error during setup:", error);

        // Emergency cleanup if recording was started
        if (getToolState().isRecordingActive) {
            await ScreenRecordingHelper.emergencyStopRecording('FlyThrough Tool');
            setToolState({ isRecordingActive: false });
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
 * Handle flythrough completion and recording processing using shared helper
 */
async function handleFlythroughCompletion(sampledPositions, config, totalDuration, wasRecordingActive) {
    const { flythroughId } = getToolState();

    let recordingResult = null;

    // Stop recording if it was active using shared helper
    if (wasRecordingActive) {
        try {
            recordingResult = await ScreenRecordingHelper.completeRecording(
                'FlyThrough Tool',
                (result) => {
                    // Store the recording data for measurement history
                    setToolState({
                        isRecordingActive: false,
                        recordedBlob: result.success ? result.blob : null,
                        recordedInfo: result.success ? result.info : null
                    });
                }
            );
        } catch (recordingError) {
            console.error('FlyThroughTool: Error handling recording completion:', recordingError);
            setToolState({ isRecordingActive: false });
        }
    } else {
        const totalTime = ((Date.now() - config._startTime) / 1000).toFixed(1);
        console.log("FlyThroughTool: Flythrough completed without recording, total time:", totalTime);
    }

    // Add to measurement history
    const flythroughValue = `${sampledPositions.length} points, ${totalDuration.toFixed(1)}s duration${recordingResult?.success ? ' (Recorded)' : ''}`;

    const entities = {
        flythroughId: flythroughId,
        recordingBlob: recordingResult?.success ? recordingResult.blob : null,
        recordingInfo: recordingResult?.success ? recordingResult.info : null,
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

    // Show completion message if no recording was processed (recording completion shows its own dialog)
    if (!wasRecordingActive) {
        const totalTime = ((Date.now() - config._startTime) / 1000).toFixed(1);
        PopupService.showToolInstruction(
            `Flythrough completed! Total time: ${totalTime}s (No recording was made)`,
            "Success",
            false
        );
        setTimeout(() => {
            ToolManagementService.deactivateCurrentTool();
        }, 3000);
    } else if (!recordingResult?.success) {
        // Show completion if recording failed but flythrough succeeded
        setTimeout(() => {
            ToolManagementService.deactivateCurrentTool();
        }, 2000);
    }
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

    // Handle recording stop using shared helper
    if (isRecordingActive) {
        await ScreenRecordingHelper.emergencyStopRecording('FlyThrough Tool');
        setToolState({ isRecordingActive: false });
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