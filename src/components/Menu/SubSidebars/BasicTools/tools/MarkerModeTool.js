// MarkerModeTool.js - Integrated with ScreenRecordingHelper

import * as Cesium from 'cesium';
import {
    clearDrawing,
    removeEventHandlers,
    getToolState,
    setToolState,
} from '../tool-helpers/tools-helpers.js';
import { PopupService } from '../../../../../services/PopupService.js';
import { ToolManagementService } from '../../../../../services/ToolManagementService.js';
import { MapService } from '../../../../../services/MapService.js';
import { FlythroughPlaybackService } from '../../../../../services/FlythroughPlaybackService.js';
import { ScreenRecordingHelper } from '../tool-helpers/ScreenRecordingHelper.js';

const DEFAULT_MARKER_CONFIG = {
    defaultWaitTime: 3.0,
    showMarkerLabels: true,
    markerSize: 8,
    previewDuration: 2.0,
    enableCameraSmoothing: true,
    showElevationInfo: true
};

const MARKER_COLORS = [
    Cesium.Color.YELLOW,
    Cesium.Color.CYAN,
    Cesium.Color.LIME,
    Cesium.Color.ORANGE,
    Cesium.Color.MAGENTA,
    Cesium.Color.WHITE,
    Cesium.Color.RED,
    Cesium.Color.BLUE
];

export function setupMarkerModeTool(viewer) {
    console.log("MarkerModeTool: Setting up marker-based flythrough");

    const coreManager = getCoreManagerFromViewer(viewer);
    if (!coreManager) {
        console.error("MarkerModeTool: CesiumCoreManager not available");
        PopupService.showToolInstruction(
            "Marker Mode requires CesiumCoreManager but it's not available.",
            "Tool Error",
            true
        );
        ToolManagementService.deactivateCurrentTool();
        return;
    }

    removeEventHandlers();

    setToolState({
        viewer: viewer,
        coreManager: coreManager,
        handler: new Cesium.ScreenSpaceEventHandler(viewer.canvas),
        markerPoints: [],
        markerEntities: [],
        activeMarkerMode: true,
        markerConfig: { ...DEFAULT_MARKER_CONFIG },
        nextMarkerId: 1,
        lastMarkerTime: 0,
        isRecordingMarkers: true,
        isFlythroughActive: false,
        recordingHelper: null,
        animationId: null,
        markerId: null
    });

    const { handler } = getToolState();
    const toolName = "Marker Mode";

    const baseInstructions = `**MARKER MODE INSTRUCTIONS:**\n\n` +
        `**CONTROLS:**\n` +
        `• **LEFT-CLICK** to ADD waypoint markers\n` +
        `• **RIGHT-CLICK** to FINISH and configure flythrough\n\n` +
        `**WHAT GETS RECORDED:**\n` +
        `• Location coordinates & elevation\n` +
        `• Camera position & viewing angle\n` +
        `• Zoom level & orientation\n\n` +
        `Each marker captures your current camera view!`;

    const enhancedInstructions = ScreenRecordingHelper.addRecordingContextToInstructions(baseInstructions, toolName);

    PopupService.showToolInstruction(enhancedInstructions, "Marker Mode Setup", true);

    handler.setInputAction((click) => {
        const { isRecordingMarkers } = getToolState();
        if (isRecordingMarkers) {
            addMarkerPoint(viewer, click, toolName);
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    handler.setInputAction(() => {
        const { isRecordingMarkers } = getToolState();
        if (isRecordingMarkers) {
            finishMarkerRecording(viewer, toolName);
        }
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
}

function getCoreManagerFromViewer(viewer) {
    try {
        const coreManagerFromMapService = MapService.getCoreManager();
        if (coreManagerFromMapService) return coreManagerFromMapService;
    } catch (error) {
        console.warn('MarkerModeTool: Could not get core manager from MapService:', error);
    }

    if (viewer && viewer._coreManager) return viewer._coreManager;
    if (window.cesiumCoreManager) return window.cesiumCoreManager;

    return null;
}

function addMarkerPoint(viewer, click, toolName) {
    const currentTime = Date.now();
    let { lastMarkerTime, nextMarkerId, markerPoints, markerEntities, markerConfig, coreManager } = getToolState();

    if (currentTime - lastMarkerTime < 300) return;

    let cartesian = viewer.scene.pickPosition(click.position);
    if (!Cesium.defined(cartesian)) {
        cartesian = viewer.camera.pickEllipsoid(click.position, viewer.scene.globe.ellipsoid);
    }

    if (!Cesium.defined(cartesian) || isNaN(cartesian.x)) {
        PopupService.showToolInstruction(
            "Unable to place marker. Click on globe surface.",
            "Marker Error",
            true
        );
        return;
    }

    const cameraState = coreManager.getCameraState();
    const cartographic = viewer.scene.globe.ellipsoid.cartesianToCartographic(cartesian);
    const longitude = Cesium.Math.toDegrees(cartographic.longitude);
    const latitude = Cesium.Math.toDegrees(cartographic.latitude);
    const height = cartographic.height || 0;

    const markerData = {
        id: nextMarkerId,
        position: cartesian.clone(),
        cartographic: cartographic,
        coordinates: { longitude, latitude, elevation: height },
        cameraState: cameraState,
        distanceFromCamera: Cesium.Cartesian3.distance(cameraState.position, cartesian),
        waitTime: markerConfig.defaultWaitTime,
        timestamp: currentTime,
        order: nextMarkerId
    };

    if (!Array.isArray(markerPoints)) markerPoints = [];
    if (!Array.isArray(markerEntities)) markerEntities = [];

    const newMarkerPoints = [...markerPoints, markerData];
    const markerColor = MARKER_COLORS[(nextMarkerId - 1) % MARKER_COLORS.length];
    
    const markerEntity = viewer.entities.add({
        id: `marker_${nextMarkerId}`,
        position: cartesian,
        point: {
            pixelSize: markerConfig.markerSize * 2,
            color: markerColor,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY
        },
        label: markerConfig.showMarkerLabels ? {
            text: `${nextMarkerId}`,
            font: '16pt Arial',
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -35),
            disableDepthTestDistance: Number.POSITIVE_INFINITY
        } : undefined
    });

    const newMarkerEntities = [...markerEntities, markerEntity];

    setToolState({
        markerPoints: newMarkerPoints,
        markerEntities: newMarkerEntities,
        nextMarkerId: nextMarkerId + 1,
        lastMarkerTime: currentTime
    });

    PopupService.showToolInstruction(
        `Marker ${nextMarkerId} added!\n\nTotal: ${newMarkerPoints.length}\nRight-click when ready.`,
        `${toolName} - ${newMarkerPoints.length} Markers`,
        false
    );

    if (viewer.scene.requestRenderMode) {
        viewer.scene.requestRender();
    }
}

function finishMarkerRecording(viewer, toolName) {
    const { markerPoints } = getToolState();

    if (!markerPoints || markerPoints.length === 0) {
        PopupService.showToolInstruction("No markers placed yet!", "Error", true);
        return;
    }

    if (markerPoints.length === 1) {
        PopupService.showToolInstruction("Need at least 2 markers!", "Error", true);
        return;
    }

    setToolState({ isRecordingMarkers: false });
    removeEventHandlers();

    showMarkerConfigurationForm(markerPoints, toolName);
}

function showMarkerConfigurationForm(markerPoints, toolName) {
    const formData = {
        markers: markerPoints.map(marker => ({
            id: marker.id,
            order: marker.order,
            waitTime: marker.waitTime,
            coordinates: marker.coordinates,
            description: `Marker ${marker.id} (${marker.coordinates.latitude.toFixed(4)}°, ${marker.coordinates.longitude.toFixed(4)}°)`
        })),
        totalDuration: markerPoints.reduce((sum, m) => sum + m.waitTime, 0),
        enableSmoothing: DEFAULT_MARKER_CONFIG.enableCameraSmoothing,
        previewDuration: DEFAULT_MARKER_CONFIG.previewDuration
    };

    PopupService.showMarkerSequenceForm({
        markers: formData.markers,
        totalDuration: formData.totalDuration,
        enableSmoothing: formData.enableSmoothing,
        previewDuration: formData.previewDuration,
        onStart: async (configuredData) => {
            await handleMarkerFlythroughSetupAndRecording(configuredData);
        },
        onPreview: (markerId) => {
            previewMarkerPosition(markerId);
        },
        onCancel: () => {
            PopupService.showToolInstruction("Cancelled. Continue adding markers or right-click again.", toolName, true);
            setToolState({ isRecordingMarkers: true });
            setupMarkerModeTool(getToolState().viewer);
        }
    });
}

async function handleMarkerFlythroughSetupAndRecording(configuredData) {
    try {
        const markerId = `marker_flythrough_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        setToolState({ markerId: markerId });

        let recordingHelper = null;

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
            console.warn('MarkerModeTool: Recording setup failed:', recordingError);
            
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

        await startMarkerBasedFlythrough(configuredData, recordingHelper);

    } catch (error) {
        console.error("MarkerModeTool: Critical error:", error);

        const { recordingHelper } = getToolState();
        if (recordingHelper) {
            recordingHelper.cleanup();
        }

        PopupService.showToolInstruction(`Marker flythrough failed: ${error.message}`, 'Error', true);
        ToolManagementService.deactivateCurrentTool();
    }
}

function previewMarkerPosition(markerId) {
    const { markerPoints, coreManager } = getToolState();
    const marker = markerPoints.find(m => m.id === markerId);

    if (!marker) return;

    coreManager.setCameraView({
        destination: marker.cameraState.position,
        orientation: {
            direction: marker.cameraState.direction,
            up: marker.cameraState.up
        },
        duration: 2.0
    });

    PopupService.showToolInstruction(`Previewing Marker ${markerId}`, "Preview", false);
}

async function startMarkerBasedFlythrough(configData, recordingHelper) {
    const { markerPoints, coreManager, markerId } = getToolState();

    try {
        removeEventHandlers();
        clearMarkerVisuals();

        const orderedMarkers = [...markerPoints].sort((a, b) => {
            const orderA = configData.markers.find(m => m.id === a.id)?.order || a.order;
            const orderB = configData.markers.find(m => m.id === b.id)?.order || b.order;
            return orderA - orderB;
        });

        orderedMarkers.forEach(marker => {
            const configMarker = configData.markers.find(m => m.id === marker.id);
            if (configMarker) {
                marker.waitTime = configMarker.waitTime;
            }
        });

        const totalDuration = orderedMarkers.reduce((sum, m) => sum + m.waitTime, 0);

        const recordingStatus = recordingHelper ? 'Recording in progress!' : 'No recording';
        PopupService.showToolInstruction(
            `🚀 Marker flythrough\n\nWaypoints: ${orderedMarkers.length}\nTime: ${totalDuration.toFixed(1)}s\n\n${recordingStatus}`,
            'Flythrough Active',
            false
        );

        setToolState({ isFlythroughActive: true });

        const flythroughStartTime = Date.now();

        const registrationData = {
            path: orderedMarkers.map(m => m.position),
            config: configData,
            totalDuration: totalDuration,
            recordingBlob: null,
            recordingInfo: null,
            markerData: orderedMarkers
        };
        
        FlythroughPlaybackService.registerFlythrough(markerId, registrationData);

        const animationId = coreManager.createMarkerFlightAnimation(
            orderedMarkers,
            {
                enableSmoothing: configData.enableSmoothing,
                waitTime: configData.markers[0]?.waitTime || 3.0
            },
            (progress) => {
                const marker = progress.marker;
                const recordingText = recordingHelper ? "Recording active" : "No recording";

                PopupService.showToolInstruction(
                    `Waypoint ${marker.id} (${progress.currentIndex + 1}/${progress.totalMarkers})\n\n` +
                    `${marker.coordinates.latitude.toFixed(4)}°, ${marker.coordinates.longitude.toFixed(4)}°\n` +
                    `${recordingText}`,
                    'Flythrough Progress',
                    false
                );
            },
            async () => {
                const totalFlythroughTime = ((Date.now() - flythroughStartTime) / 1000);
                await handleMarkerFlythroughCompletion(orderedMarkers, totalFlythroughTime, recordingHelper);
            }
        );

        setToolState({ animationId: animationId });

    } catch (error) {
        console.error("MarkerModeTool: Error executing flythrough:", error);
        throw error;
    }
}

async function handleMarkerFlythroughCompletion(orderedMarkers, totalDuration, recordingHelper) {
    const { markerId } = getToolState();
    let recordingBlob = null;
    let recordingInfo = null;

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

                const shouldDownload = await PopupService.showConfirmation(
                    `Recording complete!\n\nSize: ${result.info.sizeFormatted}\nDuration: ${result.info.durationFormatted}\n\nDownload now?`,
                    'Recording Complete',
                    'Download Recording',
                    'Skip Download'
                );

                if (shouldDownload) {
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0];
                    const filename = `marker-mode-${timestamp}.webm`;
                    await ScreenRecordingHelper.downloadRecording(recordingBlob, filename);
                }
            }
        } catch (recordingError) {
            console.error('MarkerModeTool: Error processing recording:', recordingError);
        } finally {
            recordingHelper.cleanup();
        }
    }

    const flythroughValue = `${orderedMarkers.length} markers, ${totalDuration.toFixed(1)}s${recordingBlob ? ' (Recorded)' : ''}`;

    const entities = {
        markerId: markerId,
        recordingBlob: recordingBlob,
        recordingInfo: recordingInfo,
        totalDuration: totalDuration,
        orderedMarkers: orderedMarkers,
        markerCount: orderedMarkers.length,
        sampledPositions: orderedMarkers.map(m => m.position),
        config: { enableSmoothing: true }
    };

    ToolManagementService.addMeasurement('Marker Mode', flythroughValue, entities);

    if (!recordingHelper) {
        PopupService.showToolInstruction(
            `Marker flythrough complete!\n\nWaypoints: ${orderedMarkers.length}\nDuration: ${totalDuration.toFixed(1)}s`,
            "Success",
            true
        );
    }

    setTimeout(() => {
        ToolManagementService.deactivateCurrentTool();
    }, 2000);
}

function clearMarkerVisuals() {
    const { viewer, markerEntities } = getToolState();

    if (markerEntities && markerEntities.length > 0) {
        markerEntities.forEach(entity => {
            if (viewer && viewer.entities.contains(entity)) {
                viewer.entities.remove(entity);
            }
        });
        setToolState({ markerEntities: [] });
    }
}

export async function stopMarkerModeTool() {
    const { animationId, coreManager, recordingHelper, markerId } = getToolState();

    if (animationId && coreManager) {
        try {
            coreManager.cancelFlightAnimation(animationId);
        } catch (error) {
            console.warn("MarkerModeTool: Error cancelling animation:", error);
        }
    }

    if (markerId) {
        try {
            FlythroughPlaybackService.unregisterFlythrough(markerId);
        } catch (error) {
            console.warn("MarkerModeTool: Error unregistering:", error);
        }
    }

    if (recordingHelper) {
        recordingHelper.cleanup();
    }

    clearMarkerVisuals();
    clearDrawing();
    removeEventHandlers();

    setToolState({
        markerPoints: [],
        markerEntities: [],
        activeMarkerMode: false,
        markerConfig: { ...DEFAULT_MARKER_CONFIG },
        nextMarkerId: 1,
        lastMarkerTime: 0,
        isRecordingMarkers: false,
        isFlythroughActive: false,
        recordingHelper: null,
        animationId: null,
        markerId: null,
        coreManager: null
    });

    PopupService.hide();
}