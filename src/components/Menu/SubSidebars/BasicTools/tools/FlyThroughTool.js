// src/components/Menu/SubSidebars/BasicTools/tools/FlyThroughTool.js - Updated with enhanced recording support and sidebar management

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
    console.log("FlyThroughTool: Setting up enhanced tool with recording support and sidebar management");

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
        recordingPromise: null,
        recordedBlob: null,
        recordedInfo: null,
        flythroughId: null,
        minimumRecordingDuration: 3000, // 3 seconds minimum
    });

    const { handler } = getToolState();

    const toolName = "FlyThrough Tool";

    // Get enhanced instructions with recording context
    const baseInstructions = `Click to add path points (minimum 2). Right-click when ready to configure and start flythrough`;
    const instructionMessage = ScreenRecordingHelper.addRecordingContextToInstructions(baseInstructions, toolName);

    PopupService.showToolInstruction(instructionMessage, toolName);
    console.log("FlyThroughTool: Initial instruction shown with recording and sidebar context");

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

                // Use the enhanced recording helper with minimum duration support
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
 * Enhanced function using shared recording helper with minimum duration support
 */
async function handleFlythroughSetupAndRecording(drawingPoints, config) {
    try {
        console.log("FlyThroughTool: Starting enhanced recording setup sequence...");

        const flythroughId = `flythrough_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        setToolState({ flythroughId: flythroughId });

        let recordingActive = false;
        let recordingPromise = null;

        // Use shared recording helper for setup
        try {
            const recordingSetup = await ScreenRecordingHelper.initializeRecording();
            
            if (recordingSetup.cancelled) {
                console.log('FlyThroughTool: User cancelled flythrough');
                ToolManagementService.deactivateCurrentTool();
                return;
            }

            if (recordingSetup.recordingEnabled) {
                console.log('FlyThroughTool: Starting recording with minimum duration support...');
                
                // Start recording with minimum duration to ensure data capture
                const { minimumRecordingDuration } = getToolState();
                recordingActive = await ScreenRecordingHelper.startRecording('FlyThrough Tool', minimumRecordingDuration);
                
                // Store recording state
                setToolState({ 
                    isRecordingActive: recordingActive,
                    recordingPromise: recordingPromise
                });

                console.log('FlyThroughTool: Recording started with sidebar management');
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
            setToolState({ isRecordingActive: false, recordingPromise: null });
        }

        // Execute the flythrough (with or without recording)
        console.log('FlyThroughTool: Proceeding with flythrough. Recording active:', recordingActive);
        await executeFlythrough(drawingPoints, config, recordingActive);

    } catch (error) {
        console.error("FlyThroughTool: Critical error during setup:", error);

        // Emergency cleanup if recording was started
        const toolState = getToolState();
        if (toolState.isRecordingActive) {
            console.log('FlyThroughTool: Emergency recording cleanup...');
            await ScreenRecordingHelper.emergencyStopRecording('FlyThrough Tool');
            setToolState({ isRecordingActive: false, recordingPromise: null });
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
 * Execute the actual flythrough with enhanced error handling
 */
async function executeFlythrough(drawingPoints, config, recordingActive) {
    const { coreManager, viewer, flythroughId } = getToolState();

    try {
        console.log("FlyThroughTool: Executing flythrough with terrain sampling");

        // Ensure we have a valid terrain provider before sampling
        if (!coreManager || !coreManager.sampleTerrainHeights) {
            console.error("FlyThroughTool: CesiumCoreManager or sampleTerrainHeights method not available");
            
            // If recording is active, ensure minimum duration before failing
            if (recordingActive) {
                console.log("FlyThroughTool: Core manager unavailable, but continuing recording for minimum duration...");
                PopupService.showToolInstruction(
                    'Terrain sampling unavailable, but continuing recording for minimum duration...',
                    'FlyThrough Tool - Recording Continue',
                    false
                );
                
                // Wait for minimum duration before stopping
                await new Promise(resolve => setTimeout(resolve, getToolState().minimumRecordingDuration));
            }
            
            throw new Error("Terrain sampling service is not available. Please ensure the map is fully loaded.");
        }

        // Sample terrain heights with enhanced error handling
        let sampledPositions;
        try {
            console.log("FlyThroughTool: Attempting terrain sampling with core manager...");
            sampledPositions = await coreManager.sampleTerrainHeights(drawingPoints, config.cameraHeight);
            console.log("FlyThroughTool: Terrain sampling successful, got", sampledPositions?.length, "positions");
        } catch (terrainError) {
            console.error("FlyThroughTool: Terrain sampling failed:", terrainError);
            
            // If recording is active, ensure minimum duration before failing
            if (recordingActive) {
                console.log("FlyThroughTool: Terrain sampling failed, but continuing recording for minimum duration...");
                PopupService.showToolInstruction(
                    `Terrain sampling failed (${terrainError.message}), but continuing recording for minimum duration...`,
                    'FlyThrough Tool - Recording Continue',
                    false
                );
                
                // Wait for minimum duration before stopping
                await new Promise(resolve => setTimeout(resolve, getToolState().minimumRecordingDuration));
                
                // Try to create a basic flythrough path without terrain sampling
                console.log("FlyThroughTool: Attempting flythrough without terrain sampling...");
                try {
                    sampledPositions = drawingPoints.map((point, index) => {
                        const cartographic = Cesium.Cartographic.fromCartesian(point);
                        cartographic.height = config.cameraHeight + (index * 2); // Slight height variation
                        return Cesium.Cartesian3.fromRadians(
                            cartographic.longitude, 
                            cartographic.latitude, 
                            cartographic.height
                        );
                    });
                    
                    if (sampledPositions.length >= 2) {
                        console.log("FlyThroughTool: Created basic flythrough path without terrain sampling");
                        PopupService.showToolInstruction(
                            'Using basic flight path without terrain data. Recording continues...',
                            'FlyThrough Tool - Basic Flight',
                            false
                        );
                    } else {
                        throw new Error("Could not create basic flight path");
                    }
                } catch (basicPathError) {
                    console.error("FlyThroughTool: Basic path creation also failed:", basicPathError);
                    throw new Error(`Cannot create flythrough: ${terrainError.message}. Basic fallback also failed.`);
                }
            } else {
                // No recording active, just throw the error
                throw terrainError;
            }
        }

        if (!sampledPositions || sampledPositions.length < 2) {
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
        const recordingStatus = recordingActive ? "Recording in progress! Sidebar temporarily hidden." : "No recording";
        PopupService.showToolInstruction(
            `Starting flythrough: ${config.cameraHeight}m height, ${config.cameraSpeed}m/s speed, ${config.cameraTilt}° tilt. ${recordingStatus}`,
            'FlyThrough Active',
            false
        );

        config._startTime = Date.now();

        // Ensure minimum recording duration even if flythrough is shorter
        const flythroughDurationMs = totalDuration * 1000;
        const minimumDurationMs = getToolState().minimumRecordingDuration;
        const shouldExtendForRecording = recordingActive && flythroughDurationMs < minimumDurationMs;

        if (shouldExtendForRecording) {
            console.log(`FlyThroughTool: Flythrough duration (${flythroughDurationMs}ms) shorter than minimum recording duration (${minimumDurationMs}ms), will extend`);
        }

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
                    const recordingText = recordingActive ? "Recording active - sidebar hidden" : "No recording";
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
                
                // If recording active and need to extend duration, wait before completing
                if (shouldExtendForRecording) {
                    const additionalWaitMs = minimumDurationMs - flythroughDurationMs;
                    console.log(`FlyThroughTool: Extending recording duration by ${additionalWaitMs}ms`);
                    
                    PopupService.showToolInstruction(
                        `Flythrough complete. Continuing recording for optimal file size...`,
                        'FlyThrough Tool - Finalizing Recording',
                        false
                    );
                    
                    await new Promise(resolve => setTimeout(resolve, additionalWaitMs));
                }
                
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
 * Handle flythrough completion and recording processing using enhanced shared helper
 */
async function handleFlythroughCompletion(sampledPositions, config, totalDuration, wasRecordingActive) {
    const { flythroughId } = getToolState();

    let recordingResult = null;

    // Stop recording if it was active using enhanced shared helper
    if (wasRecordingActive) {
        try {
            console.log('FlyThroughTool: Completing recording with enhanced helper...');
            
            recordingResult = await ScreenRecordingHelper.completeRecording(
                'FlyThrough Tool',
                (result) => {
                    // Store the recording data for measurement history
                    setToolState({
                        isRecordingActive: false,
                        recordingPromise: null,
                        recordedBlob: result.success ? result.blob : null,
                        recordedInfo: result.success ? result.info : null
                    });
                }
            );
            
            console.log('FlyThroughTool: Recording completion handled, result:', {
                success: recordingResult?.success,
                hasBlob: !!recordingResult?.blob,
                isEmpty: recordingResult?.isEmpty
            });
            
        } catch (recordingError) {
            console.error('FlyThroughTool: Error handling recording completion:', recordingError);
            setToolState({ isRecordingActive: false, recordingPromise: null });
            
            // Still continue with flythrough completion even if recording failed
            PopupService.showNotification('Recording processing encountered issues, but flythrough completed successfully.', true);
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
            `Flythrough completed! Total time: ${totalTime}s. Measurement added to Basic Tools sidebar.`,
            "Success",
            false
        );
        setTimeout(() => {
            ToolManagementService.deactivateCurrentTool();
        }, 3000);
    } else {
        // Recording was active - the ScreenRecordingHelper.completeRecording handles the dialog
        // Just ensure tool is deactivated after a reasonable delay
        setTimeout(() => {
            if (!getToolState().isRecordingActive) {
                ToolManagementService.deactivateCurrentTool();
            }
        }, 2000);
    }
}

/**
 * Stops the current flythrough animation and cleans up with enhanced recording support
 */
export async function stopFlyThrough() {
    console.log("FlyThroughTool: Stopping and cleaning up");

    const { animationId, viewer, flythroughPath, coreManager, isRecordingActive, flythroughId, recordingPromise } = getToolState();

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

    // Handle recording stop using enhanced shared helper
    if (isRecordingActive) {
        console.log('FlyThroughTool: Handling emergency recording stop...');
        await ScreenRecordingHelper.emergencyStopRecording('FlyThrough Tool');
        setToolState({ isRecordingActive: false, recordingPromise: null });
    }

    // Wait for any pending recording promise
    if (recordingPromise) {
        try {
            console.log('FlyThroughTool: Waiting for pending recording promise...');
            await recordingPromise;
        } catch (promiseError) {
            console.warn('FlyThroughTool: Recording promise rejected:', promiseError);
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
        recordingPromise: null,
        recordedBlob: null,
        recordedInfo: null,
        flythroughId: null,
        minimumRecordingDuration: 3000,
    });

    PopupService.hide();
    console.log("FlyThroughTool: Cleanup completed with enhanced recording support");
}