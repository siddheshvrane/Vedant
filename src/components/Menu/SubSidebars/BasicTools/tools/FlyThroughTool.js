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

/**
 * Starts the flythrough with user-specified configuration using CesiumCoreManager
 */
async function startConfiguredFlyThrough(drawingPoints, config) {
    const { coreManager } = getToolState();
    
    PopupService.showToolInstruction(
        'Preparing flythrough path and recording options...',
        'Processing FlyThrough',
        false
    );

    try {
        // Step 1: Test Electron API availability
        if (window.electron && window.electron.testElectronAPI) {
            const testResult = window.electron.testElectronAPI();
            console.log('FlyThroughTool: Electron API test result:', testResult);
        } else {
            console.warn('FlyThroughTool: Electron API not available, will use browser fallbacks');
        }

        // Step 2: Initialize audio devices if not already done
        console.log('FlyThroughTool: Initializing audio devices...');
        await ScreenRecordingService.initializeAudioDevices();
        
        // Step 3: Prompt user for audio device selection
        const audioDevices = ScreenRecordingService.availableAudioDevices$.getValue();
        console.log('FlyThroughTool: Available audio devices:', audioDevices);
        
        let selectedAudioDeviceId = 'none'; // Default to no audio

        await new Promise((resolve, reject) => {
            PopupService.showSelectAudioDeviceForm({
                audioDevices: audioDevices,
                onSelect: (deviceId) => {
                    console.log("FlyThroughTool: Audio device selected:", deviceId);
                    selectedAudioDeviceId = deviceId;
                    resolve();
                },
                onCancel: () => {
                    console.log("FlyThroughTool: Audio device selection cancelled");
                    reject(new Error("Audio device selection cancelled. Flythrough will not start."));
                }
            });
        });

        // Update ScreenRecordingService config with the selected audio device
        ScreenRecordingService.updateConfig({ audioSource: selectedAudioDeviceId });

        // Step 4: Start screen recording with better error handling
        console.log("FlyThroughTool: Starting screen recording...");
        
        PopupService.showToolInstruction(
            'Starting screen recording... This may take a few seconds.',
            'Initializing Recording',
            false
        );

        const recordingStarted = await ScreenRecordingService.startRecording();
        
        if (!recordingStarted) {
            throw new Error("Screen recording failed to start. Check console for detailed errors.");
        }
        
        console.log("FlyThroughTool: Screen recording started successfully");
        setToolState({ isRecordingActive: true });

        // Step 5: Continue with terrain sampling and flythrough
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
            // Stop recording if path is invalid
            if (getToolState().isRecordingActive) {
                await ScreenRecordingService.stopRecording();
                setToolState({ isRecordingActive: false });
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

        PopupService.showToolInstruction(
            `Starting flythrough: ${config.cameraHeight}m height, ${config.cameraSpeed}m/s speed, ${config.cameraTilt}° tilt. Recording in progress!`,
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
                    PopupService.showToolInstruction(
                        `Flying: ${progressPercent}% complete (${progress.elapsedTime.toFixed(0)}s elapsed) - Point ${progress.currentIndex + 1}/${progress.totalPoints}. Recording active.`,
                        'FlyThrough Progress',
                        false
                    );
                }
            },
            // Completion callback
            async () => {
                console.log("FlyThroughTool: Flythrough animation completed.");
                const { isRecordingActive } = getToolState();

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

                        setToolState({ isRecordingActive: false, recordedBlob: blob, recordedInfo: info });
                        
                        console.log("FlyThroughTool: Recording stopped successfully, blob size:", blob.size);
                        
                        // Offer download after recording stops
                        PopupService.showDownloadRecordingForm({
                            recordingInfo: info,
                            onDownload: async (downloadOptions) => {
                                console.log("FlyThroughTool: Download requested with options:", downloadOptions);
                                try {
                                    const filename = `flythrough-recording-${info.timestamp.replace(/[:.]/g, '-').split('.')[0]}.${info.format}`;
                                    await ScreenRecordingService.downloadRecording(blob, filename);
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

                    } catch (recordingError) {
                        console.error('FlyThroughTool: Error stopping recording:', recordingError);
                        PopupService.showToolInstruction(
                            `Flythrough completed, but recording failed: ${recordingError.message}`,
                            'Recording Error',
                            true
                        );
                        setToolState({ isRecordingActive: false });
                        ToolManagementService.deactivateCurrentTool();
                    }
                } else {
                    const totalTime = ((Date.now() - config._startTime) / 1000).toFixed(1);
                    PopupService.showToolInstruction(
                        `Flythrough completed! Total time: ${totalTime}s`,
                        "Success",
                        true
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
        
        PopupService.showToolInstruction(
            `Flythrough failed: ${error.message || 'Unknown error occurred. Check console for details.'}`,
            `FlyThrough Error`,
            true
        );
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

    const { animationId, viewer, flythroughPath, coreManager, isRecordingActive } = getToolState();

    // Cancel flight animation using CesiumCoreManager
    if (animationId && coreManager) {
        try {
            coreManager.cancelFlightAnimation(animationId);
            console.log("FlyThroughTool: Flight animation cancelled successfully");
        } catch (error) {
            console.warn("FlyThroughTool: Error cancelling flight animation:", error);
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
    });

    PopupService.hide();
    console.log("FlyThroughTool: Cleanup completed");
}