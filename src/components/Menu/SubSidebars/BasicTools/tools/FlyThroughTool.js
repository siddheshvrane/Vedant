// FlyThroughTool.js - Simplified with ScreenRecordingHelper integration

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

const DEFAULT_CONFIG = {
    cameraHeight: 20,
    cameraSpeed: 10,
    cameraTilt: 45,
    showProgressUpdates: true,
    pauseBetweenPoints: 200
};

export function setupFlyThroughTool(viewer) {
    console.log("FlyThroughTool: Setting up tool");

    const coreManager = getCoreManagerFromViewer(viewer);
    if (!coreManager) {
        console.error("FlyThroughTool: CesiumCoreManager not available");
        PopupService.showToolInstruction(
            "FlyThrough tool requires CesiumCoreManager but it's not available.",
            "Tool Error",
            true
        );
        ToolManagementService.deactivateCurrentTool();
        return;
    }

    setToolState({
        viewer: viewer,
        coreManager: coreManager,
        handler: new Cesium.ScreenSpaceEventHandler(viewer.canvas),
        drawingPoints: [],
        activeShape: null,
        flythroughPath: null,
        animationId: null,
        mousePosition: null,
        config: { ...DEFAULT_CONFIG },
        lastPopupTime: 0,
        recordingHelper: null,
        flythroughId: null,
    });

    const { handler } = getToolState();
    const toolName = "FlyThrough Tool";

    const baseInstructions = `Click to add path points (minimum 2). Right-click when ready to configure flythrough`;
    const instructionMessage = ScreenRecordingHelper.addRecordingContextToInstructions(baseInstructions, toolName);

    PopupService.showToolInstruction(instructionMessage, toolName);

    // LEFT_CLICK - Add path points
    handler.setInputAction((click) => {
        const currentTime = Date.now();
        const { lastPopupTime } = getToolState();

        let cartesian = viewer.scene.pickPosition(click.position);
        if (!Cesium.defined(cartesian)) {
            cartesian = viewer.camera.pickEllipsoid(click.position, viewer.scene.globe.ellipsoid);
        }

        if (Cesium.defined(cartesian)) {
            if (isNaN(cartesian.x) || isNaN(cartesian.y) || isNaN(cartesian.z)) {
                console.error("FlyThroughTool: Invalid position");
                if (currentTime - lastPopupTime > 3000) {
                    PopupService.showToolInstruction("Invalid position. Click on the globe.", toolName, true);
                    setToolState({ lastPopupTime: currentTime });
                }
                return;
            }

            const { drawingPoints } = getToolState();
            drawingPoints.push(cartesian);
            setToolState({ drawingPoints: [...drawingPoints] });

            addTemporaryPoint(cartesian);

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
                        ? "Minimum points reached. Add more or right-click to configure."
                        : `${drawingPoints.length} points added. Right-click to start.`;

                PopupService.showToolInstruction(message, toolName);
                setToolState({ lastPopupTime: currentTime });
            }

            if (viewer.scene.requestRenderMode) {
                viewer.scene.requestRender();
            }
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // MOUSE_MOVE - Update preview line
    const throttledMouseMoveHandler = throttle((move) => {
        const { drawingPoints } = getToolState();
        if (drawingPoints.length > 0) {
            let cartesian = viewer.scene.pickPosition(move.endPosition);
            if (!Cesium.defined(cartesian)) {
                cartesian = viewer.camera.pickEllipsoid(move.endPosition, viewer.scene.globe.ellipsoid);
            }

            if (Cesium.defined(cartesian) && !isNaN(cartesian.x)) {
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

    // RIGHT_CLICK - Configure and start
    handler.setInputAction(async () => {
        const { drawingPoints, activeShape, config } = getToolState();
        PopupService.hide();

        if (drawingPoints.length < 2) {
            PopupService.showToolInstruction(
                `Need at least 2 points. Currently have ${drawingPoints.length}.`,
                'FlyThrough Error',
                true
            );
            return;
        }

        // Show configuration dialog
        PopupService.showFlyThroughForm({
            height: config.cameraHeight,
            tilt: config.cameraTilt,
            speed: config.cameraSpeed,
            duration: null,
            loop: false,
            onStart: async (formConfig) => {
                const finalConfig = {
                    cameraHeight: formConfig.height,
                    cameraSpeed: formConfig.speed,
                    cameraTilt: formConfig.tilt,
                    duration: formConfig.duration,
                    loop: formConfig.loop,
                    showProgressUpdates: config.showProgressUpdates,
                    pauseBetweenPoints: config.pauseBetweenPoints
                };

                removeEventHandlers();

                if (Cesium.defined(activeShape)) {
                    viewer.entities.remove(activeShape);
                    setToolState({ activeShape: null });
                }
                clearDrawing();

                await handleFlythroughWithRecording(drawingPoints, finalConfig);
            },
            onCancel: () => {
                PopupService.showToolInstruction(
                    "Setup cancelled. Continue adding points or right-click again.",
                    toolName
                );
            }
        });

    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
}

function getCoreManagerFromViewer(viewer) {
    try {
        const coreManagerFromMapService = MapService.getCoreManager();
        if (coreManagerFromMapService) return coreManagerFromMapService;
    } catch (error) {
        console.warn('FlyThroughTool: Could not get core manager from MapService:', error);
    }

    if (viewer && viewer._coreManager) return viewer._coreManager;
    if (window.cesiumCoreManager) return window.cesiumCoreManager;

    return null;
}

async function handleFlythroughWithRecording(drawingPoints, config) {
    try {
        const flythroughId = `flythrough_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        setToolState({ flythroughId: flythroughId });

        let recordingHelper = null;

        // Initialize recording
        try {
            const recordingSetup = await ScreenRecordingHelper.initializeRecording();
            
            if (recordingSetup.cancelled) {
                ToolManagementService.deactivateCurrentTool();
                return;
            }

            if (recordingSetup.recordingEnabled) {
                recordingHelper = recordingSetup.helper;
                await recordingHelper.startRecording(recordingSetup.config);
                setToolState({ recordingHelper: recordingHelper });
                
                PopupService.showToolInstruction(
                    '🔴 Recording started! Flythrough beginning...',
                    'Recording Active',
                    false
                );
            }
        } catch (recordingError) {
            console.warn('FlyThroughTool: Recording setup failed:', recordingError);
            
            const continueWithoutRecording = await PopupService.showConfirmation(
                `${recordingError.message}\n\nContinue without recording?`,
                'Recording Setup Failed',
                'Continue Without Recording',
                'Cancel Flythrough'
            );

            if (!continueWithoutRecording) {
                ToolManagementService.deactivateCurrentTool();
                return;
            }
        }

        // Execute flythrough
        await executeFlythrough(drawingPoints, config, recordingHelper);

    } catch (error) {
        console.error("FlyThroughTool: Critical error:", error);

        const { recordingHelper } = getToolState();
        if (recordingHelper) {
            recordingHelper.cleanup();
        }

        PopupService.showToolInstruction(`Flythrough failed: ${error.message}`, 'Error', true);
        ToolManagementService.deactivateCurrentTool();
    }
}

async function executeFlythrough(drawingPoints, config, recordingHelper) {
    const { coreManager, viewer, flythroughId } = getToolState();

    try {
        const sampledPositions = await coreManager.sampleTerrainHeights(drawingPoints, config.cameraHeight);

        if (sampledPositions.length < 2) {
            throw new Error('Could not create valid flythrough path');
        }

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

        const totalDuration = FlythroughPlaybackService.calculateFlythroughDuration(sampledPositions, config);

        const recordingStatus = recordingHelper ? "Recording in progress!" : "No recording";
        PopupService.showToolInstruction(
            `Flythrough started: ${config.cameraHeight}m height, ${config.cameraSpeed}m/s speed. ${recordingStatus}`,
            'FlyThrough Active',
            false
        );

        config._startTime = Date.now();

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
            (progress) => {
                if (config.showProgressUpdates && (progress.currentIndex % 3 === 0 || progress.currentIndex < 5)) {
                    const progressPercent = Math.round(progress.progress * 100);
                    const recordingText = recordingHelper ? "Recording active" : "No recording";
                    PopupService.showToolInstruction(
                        `Flying: ${progressPercent}% (${progress.elapsedTime.toFixed(0)}s) - Point ${progress.currentIndex + 1}/${progress.totalPoints}. ${recordingText}`,
                        'FlyThrough Progress',
                        false
                    );
                }
            },
            async () => {
                await handleFlythroughCompletion(sampledPositions, config, totalDuration, recordingHelper);
            }
        );

        setToolState({ animationId: animationId });

    } catch (error) {
        console.error("FlyThroughTool: Error executing flythrough:", error);
        throw error;
    }
}

async function handleFlythroughCompletion(sampledPositions, config, totalDuration, recordingHelper) {
    const { flythroughId } = getToolState();

    let recordingBlob = null;
    let recordingInfo = null;

    // Stop recording if active
    if (recordingHelper) {
        try {
            PopupService.showToolInstruction(
                'Flythrough completed. Processing recording...',
                'Processing',
                false
            );

            const result = await recordingHelper.stopRecording();
            
            if (result && result.blob) {
                recordingBlob = result.blob;
                recordingInfo = result.info;

                // Show download dialog
                const shouldDownload = await PopupService.showConfirmation(
                    `Recording complete!\n\nSize: ${result.info.sizeFormatted}\nDuration: ${result.info.durationFormatted}\n\nDownload now?`,
                    'Recording Complete',
                    'Download Recording',
                    'Skip Download'
                );

                if (shouldDownload) {
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0];
                    const filename = `flythrough-recording-${timestamp}.webm`;
                    await ScreenRecordingHelper.downloadRecording(recordingBlob, filename);
                }
            }
        } catch (recordingError) {
            console.error('FlyThroughTool: Error processing recording:', recordingError);
        } finally {
            recordingHelper.cleanup();
        }
    }

    // Add to measurement history
    const flythroughValue = `${sampledPositions.length} points, ${totalDuration.toFixed(1)}s${recordingBlob ? ' (Recorded)' : ''}`;

    const entities = {
        flythroughId: flythroughId,
        recordingBlob: recordingBlob,
        recordingInfo: recordingInfo,
        totalDuration: totalDuration,
        sampledPositions: sampledPositions,
        config: config
    };

    ToolManagementService.addMeasurement('Flythrough Tool', flythroughValue, entities);

    // Show completion
    if (!recordingBlob) {
        const totalTime = ((Date.now() - config._startTime) / 1000).toFixed(1);
        PopupService.showToolInstruction(
            `Flythrough completed! Total time: ${totalTime}s`,
            "Success",
            false
        );
    }

    setTimeout(() => {
        ToolManagementService.deactivateCurrentTool();
    }, 2000);
}

export async function stopFlyThrough() {
    console.log("FlyThroughTool: Stopping");

    const { animationId, viewer, flythroughPath, coreManager, recordingHelper, flythroughId } = getToolState();

    if (animationId && coreManager) {
        try {
            coreManager.cancelFlightAnimation(animationId);
        } catch (error) {
            console.warn("FlyThroughTool: Error cancelling animation:", error);
        }
    }

    if (flythroughId) {
        try {
            FlythroughPlaybackService.unregisterFlythrough(flythroughId);
        } catch (error) {
            console.warn("FlyThroughTool: Error unregistering:", error);
        }
    }

    if (recordingHelper) {
        recordingHelper.cleanup();
    }

    if (Cesium.defined(flythroughPath) && viewer) {
        viewer.entities.remove(flythroughPath);
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
        recordingHelper: null,
        flythroughId: null,
    });

    PopupService.hide();
}