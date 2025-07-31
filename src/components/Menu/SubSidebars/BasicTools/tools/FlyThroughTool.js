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

// Default configuration values
const DEFAULT_CONFIG = {
    cameraHeight: 20,           // meters above ground
    cameraSpeed: 10,           // meters per second
    cameraTilt: 45,            // degrees (0=straight down, 90=horizontal)
    showProgressUpdates: true, // show progress during animation
    pauseBetweenPoints: 200    // milliseconds pause between flight segments
};

/**
 * Sets up the FlyThrough tool with reduced popup frequency and user configuration.
 * @param {Cesium.Viewer} viewer The Cesium Viewer instance.
 */
export function setupFlyThroughTool(viewer) {
    console.log("FlyThroughTool: Setting up enhanced tool with configuration options");

    // Get CesiumCoreManager instance from viewer
    const coreManager = getCoreManagerFromViewer(viewer);
    if (!coreManager) {
        console.error("FlyThroughTool: Cannot access CesiumCoreManager");
        return;
    }

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
        lastPopupTime: 0
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
                // Only show error popup if it's been more than 3 seconds since last popup
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
                drawingPoints.length === 1 ||   // First point
                drawingPoints.length === 2 ||   // Second point (minimum for flythrough)
                drawingPoints.length % 5 === 0 || // Every 5th point
                (currentTime - lastPopupTime > 10000) // Every 10 seconds
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
            // Throttled error message
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
        PopupService.hide(); // Hide any current instruction popup

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
 * Helper function to get CesiumCoreManager from viewer
 */
function getCoreManagerFromViewer(viewer) {
    return window.cesiumCoreManager || null;
}

/**
 * Starts the flythrough with user-specified configuration using CesiumCoreManager
 */
async function startConfiguredFlyThrough(drawingPoints, config) {
    const { coreManager } = getToolState();
    
    PopupService.showToolInstruction(
        'Preparing flythrough path...',
        'Processing FlyThrough',
        false
    );

    try {
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

        if (config.showProgressUpdates) {
            PopupService.showToolInstruction(
                `Starting flythrough: ${config.cameraHeight}m height, ${config.cameraSpeed}m/s speed, ${config.cameraTilt}° tilt (0°=down, 90°=horizontal)`,
                'FlyThrough Active',
                false
            );
        }

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
                        `Flying: ${progressPercent}% complete (${progress.elapsedTime.toFixed(0)}s elapsed) - Point ${progress.currentIndex + 1}/${progress.totalPoints}`,
                        'FlyThrough Progress',
                        false
                    );
                }
            },
            // Completion callback
            () => {
                const totalTime = ((Date.now() - config._startTime) / 1000).toFixed(1);
                PopupService.showToolInstruction(
                    `Flythrough completed! Total time: ${totalTime}s`,
                    "Success",
                    true
                );
                ToolManagementService.deactivateCurrentTool();
            }
        );

        // Store animation ID for potential cancellation
        setToolState({ animationId: animationId });

    } catch (error) {
        console.error("FlyThroughTool: Error during flythrough:", error);
        PopupService.showToolInstruction(
            `Flythrough failed: ${error.message || 'Unknown error'}`,
            `FlyThrough Error`,
            true
        );
        ToolManagementService.deactivateCurrentTool();
    }

    const { viewer } = getToolState();
    if (viewer.scene.requestRenderMode) {
        viewer.scene.requestRender();
    }
}

/**
 * Stops the current flythrough animation and cleans up.
 */
export function stopFlyThrough() {
    console.log("FlyThroughTool: Stopping and cleaning up");

    const { animationId, viewer, flythroughPath, coreManager } = getToolState();

    // Cancel flight animation using CesiumCoreManager
    if (animationId && coreManager) {
        coreManager.cancelFlightAnimation(animationId);
    }

    if (Cesium.defined(flythroughPath)) {
        viewer.entities.remove(flythroughPath);
        setToolState({ flythroughPath: null });
    }

    clearDrawing();
    removeEventHandlers();

    setToolState({
        drawingPoints: [],
        activeShape: null,
        animationId: null,
        mousePosition: null,
        config: { ...DEFAULT_CONFIG },
        lastPopupTime: 0,
        coreManager: null
    });

    PopupService.hide();
    console.log("FlyThroughTool: Cleanup completed");
}