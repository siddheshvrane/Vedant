// src/components/Menu/SubSidebars/BasicTools/tools/MarkerModeTool.js - Integrated with Flythrough Tool workflow

import * as Cesium from 'cesium';
import {
    clearDrawing,
    removeEventHandlers,
    addTemporaryPoint,
    getToolState,
    setToolState,
} from '../tool-helpers/tools-helpers.js';
import { PopupService } from '../../../../../services/PopupService.js';
import { ToolManagementService } from '../../../../../services/ToolManagementService.js';
import { MapService } from '../../../../../services/MapService.js';
import { FlythroughPlaybackService } from '../../../../../services/FlythroughPlaybackService.js';
import { ScreenRecordingHelper } from '../tool-helpers/ScreenRecordingHelper.js';

// Default configuration for marker mode
const DEFAULT_MARKER_CONFIG = {
    defaultWaitTime: 3.0,
    showMarkerLabels: true,
    markerSize: 8,
    previewDuration: 2.0,
    enableCameraSmoothing: true,
    showElevationInfo: true
};

// Marker colors for visual distinction
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

/**
 * Sets up the Marker Mode tool for creating flythrough waypoints
 */
export function setupMarkerModeTool(viewer) {
    console.log("MarkerModeTool: Setting up marker-based flythrough tool");

    const coreManager = getCoreManagerFromViewer(viewer);
    if (!coreManager) {
        console.error("MarkerModeTool: Cannot access CesiumCoreManager");
        PopupService.showToolInstruction(
            "Marker Mode requires CesiumCoreManager but it's not available.\n\n" +
            "Please ensure the application is properly initialized.",
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
        handler: viewer ? new Cesium.ScreenSpaceEventHandler(viewer.canvas) : null,
        markerPoints: [],
        markerEntities: [],
        activeMarkerMode: true,
        markerConfig: { ...DEFAULT_MARKER_CONFIG },
        nextMarkerId: 1,
        lastMarkerTime: 0,
        isRecordingMarkers: true,
        isFlythroughActive: false,
        isRecordingActive: false,
        recordedBlob: null,
        recordedInfo: null,
        animationId: null,
        markerId: null
    });

    const { handler } = getToolState();
    const toolName = "Marker Mode";

    if (!handler) {
        console.error("MarkerModeTool: Cannot create event handler");
        return;
    }

    const baseInstructions = `**MARKER MODE INSTRUCTIONS:**\n\n` +
        `**CONTROLS:**\n` +
        `• **LEFT-CLICK** to ADD waypoint markers\n` +
        `• **RIGHT-CLICK** to FINISH and configure flythrough\n\n` +
        `**WHAT GETS RECORDED:**\n` +
        `• Location coordinates & elevation\n` +
        `• Camera position & viewing angle\n` +
        `• Zoom level & orientation\n` +
        `• Marker order for flythrough sequence\n\n` +
        `Each marker captures your current camera view!\n` +
        `Position your camera as desired, then left-click to mark.\n\n` +
        `**TIP:** Create multiple markers for zoom in/out effects`;

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

    if (!Cesium.defined(cartesian) || isNaN(cartesian.x) || isNaN(cartesian.y) || isNaN(cartesian.z)) {
        PopupService.showToolInstruction(
            "Unable to place marker at this location. Please click on the globe surface.",
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
    const distanceToCamera = Cesium.Cartesian3.distance(cameraState.position, cartesian);

    const markerData = {
        id: nextMarkerId,
        position: cartesian.clone(),
        cartographic: cartographic,
        coordinates: { longitude, latitude, elevation: height },
        cameraState: cameraState,
        distanceFromCamera: distanceToCamera,
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
        } : undefined,
        description: createMarkerDescription(markerData)
    });

    const newMarkerEntities = [...markerEntities, markerEntity];

    setToolState({
        markerPoints: newMarkerPoints,
        markerEntities: newMarkerEntities,
        nextMarkerId: nextMarkerId + 1,
        lastMarkerTime: currentTime
    });

    PopupService.showToolInstruction(
        `Marker ${nextMarkerId} added!\n\n` +
        `Total markers: ${newMarkerPoints.length}\n` +
        `Continue left-clicking to add more markers, or right-click when ready to configure flythrough.`,
        `${toolName} - ${newMarkerPoints.length} Markers`,
        false
    );

    if (viewer.scene.requestRenderMode) {
        viewer.scene.requestRender();
    }
}

function createMarkerDescription(markerData) {
    const coords = markerData.coordinates;
    return `<h3>Waypoint ${markerData.id}</h3>` +
           `<p><strong>Location:</strong><br/>` +
           `Lat: ${coords.latitude.toFixed(6)}°<br/>` +
           `Lon: ${coords.longitude.toFixed(6)}°<br/>` +
           `Elevation: ${coords.elevation.toFixed(1)}m</p>` +
           `<p><strong>Camera Distance:</strong> ${markerData.distanceFromCamera.toFixed(1)}m</p>` +
           `<p><strong>Wait Time:</strong> ${markerData.waitTime}s</p>` +
           `<p><strong>Order:</strong> ${markerData.order}</p>`;
}

function finishMarkerRecording(viewer, toolName) {
    const { markerPoints } = getToolState();

    if (!markerPoints || markerPoints.length === 0) {
        PopupService.showToolInstruction(
            "No markers placed yet!\n\n" +
            "Please left-click on the globe to add waypoint markers first.",
            "No Markers Found",
            true
        );
        return;
    }

    if (markerPoints.length === 1) {
        PopupService.showToolInstruction(
            "Only 1 marker found!\n\n" +
            "For a flythrough, you need at least 2 markers.",
            "Need More Markers",
            true
        );
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
            description: `Marker ${marker.id} (${marker.coordinates.latitude.toFixed(4)}°, ${marker.coordinates.longitude.toFixed(4)}°, ${marker.coordinates.elevation.toFixed(1)}m)`
        })),
        totalDuration: markerPoints.reduce((sum, marker) => sum + (marker.waitTime || 0), 0),
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
            PopupService.showToolInstruction(
                "Marker flythrough cancelled.\n\n" +
                "You can:\n" +
                "• Continue adding markers (left-click)\n" +
                "• Right-click again to reconfigure\n" +
                "• Deactivate the tool to exit",
                toolName + " - Cancelled",
                true
            );
            setToolState({ isRecordingMarkers: true });
            setupMarkerModeTool(getToolState().viewer);
        }
    });
}

async function handleMarkerFlythroughSetupAndRecording(configuredData) {
    try {
        console.log("MarkerModeTool: Starting recording setup sequence...");

        const markerId = `marker_flythrough_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        setToolState({ markerId: markerId });

        let recordingActive = false;

        try {
            const recordingSetup = await ScreenRecordingHelper.initializeRecording();
            
            if (recordingSetup.cancelled) {
                console.log('MarkerModeTool: User cancelled flythrough');
                ToolManagementService.deactivateCurrentTool();
                return;
            }

            if (recordingSetup.recordingEnabled) {
                recordingActive = await ScreenRecordingHelper.startRecording('Marker Mode');
                setToolState({ isRecordingActive: recordingActive });
            }
        } catch (recordingError) {
            console.warn('MarkerModeTool: Recording setup failed:', recordingError);
            
            const continueWithoutRecording = await ScreenRecordingHelper.showConfirmationDialog(
                'Recording Setup Failed',
                `${recordingError.message}\n\nWould you like to continue with marker flythrough only (no recording)?`,
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

        console.log('MarkerModeTool: Proceeding with marker flythrough. Recording active:', recordingActive);
        await startMarkerBasedFlythrough(configuredData, recordingActive);

    } catch (error) {
        console.error("MarkerModeTool: Critical error during setup:", error);

        if (getToolState().isRecordingActive) {
            await ScreenRecordingHelper.emergencyStopRecording('Marker Mode');
            setToolState({ isRecordingActive: false });
        }

        PopupService.showToolInstruction(
            `Marker flythrough setup failed: ${error.message}`,
            'Error',
            true
        );
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

    PopupService.showToolInstruction(
        `Previewing Marker ${markerId}\n\n` +
        `Camera view as recorded when marker was placed.`,
        "Preview Mode",
        false
    );
}

async function startMarkerBasedFlythrough(configData, recordingActive) {
    const { markerPoints, coreManager, viewer, markerId } = getToolState();

    try {
        console.log("MarkerModeTool: Starting flythrough with", markerPoints.length, "markers");

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

        // Calculate total duration for registration
        const totalDuration = orderedMarkers.reduce((sum, m) => sum + m.waitTime, 0);

        const recordingStatus = recordingActive ? 'Recording in progress!' : 'No recording';
        PopupService.showToolInstruction(
            `🚀 Starting marker flythrough\n\n` +
            `📍 Waypoints: ${orderedMarkers.length}\n` +
            `⚙️ Smoothing: ${configData.enableSmoothing ? 'ON' : 'OFF'}\n` +
            `⏱️ Total estimated time: ${totalDuration.toFixed(1)}s\n\n` +
            recordingStatus,
            'Flythrough Active',
            false
        );

        setToolState({ isFlythroughActive: true });

        const flythroughStartTime = Date.now();

        // Register with FlythroughPlaybackService for timeline controls
        const registrationData = {
            path: orderedMarkers.map(m => m.position),
            config: configData,
            totalDuration: totalDuration,
            recordingBlob: null, // Will be set after recording completes
            recordingInfo: null,
            markerData: orderedMarkers // Store marker data for future reference
        };
        
        FlythroughPlaybackService.registerFlythrough(markerId, registrationData);
        console.log("MarkerModeTool: Registered with playback service:", markerId);

        const animationId = coreManager.createMarkerFlightAnimation(
            orderedMarkers,
            {
                enableSmoothing: configData.enableSmoothing,
                waitTime: configData.markers[0]?.waitTime || 3.0
            },
            (progress) => {
                const marker = progress.marker;
                const isLastMarker = progress.currentIndex === progress.totalMarkers - 1;
                const recordingText = recordingActive ? "Recording active" : "No recording";

                PopupService.showToolInstruction(
                    `Waypoint ${marker.id} (${progress.currentIndex + 1}/${progress.totalMarkers})\n\n` +
                    `${marker.coordinates.latitude.toFixed(4)}°, ${marker.coordinates.longitude.toFixed(4)}°\n` +
                    `Elevation: ${marker.coordinates.elevation.toFixed(1)}m\n` +
                    `Wait time: ${marker.waitTime}s\n` +
                    `${recordingText}\n\n` +
                    `${isLastMarker ? 'Final waypoint!' : 'Next: Marker ' + orderedMarkers[progress.currentIndex + 1]?.id}`,
                    'Flythrough Progress',
                    false
                );
            },
            async () => {
                const totalFlythroughTime = ((Date.now() - flythroughStartTime) / 1000);
                console.log("MarkerModeTool: Marker flythrough animation completed");
                await handleMarkerFlythroughCompletion(orderedMarkers, totalFlythroughTime, recordingActive);
            }
        );

        setToolState({ animationId: animationId });

    } catch (error) {
        console.error("MarkerModeTool: Error executing marker flythrough:", error);
        throw error;
    }
}

async function handleMarkerFlythroughCompletion(orderedMarkers, totalDuration, wasRecordingActive) {
    const { markerId } = getToolState();
    let recordingResult = null;

    if (wasRecordingActive) {
        try {
            recordingResult = await ScreenRecordingHelper.completeRecording(
                'Marker Mode',
                (result) => {
                    setToolState({
                        isRecordingActive: false,
                        recordedBlob: result.success ? result.blob : null,
                        recordedInfo: result.success ? result.info : null
                    });
                }
            );
        } catch (recordingError) {
            console.error('MarkerModeTool: Error handling recording completion:', recordingError);
            setToolState({ isRecordingActive: false });
        }
    }

    // Use "Marker Mode" as tool name to display in history
    const flythroughValue = `${orderedMarkers.length} markers, ${totalDuration.toFixed(1)}s duration${recordingResult?.success ? ' (Recorded)' : ''}`;

    const entities = {
        markerId: markerId,
        recordingBlob: recordingResult?.success ? recordingResult.blob : null,
        recordingInfo: recordingResult?.success ? recordingResult.info : null,
        totalDuration: totalDuration,
        orderedMarkers: orderedMarkers,
        markerCount: orderedMarkers.length,
        // Store path for playback (same as Flythrough Tool)
        sampledPositions: orderedMarkers.map(m => m.position),
        config: { enableSmoothing: true }
    };

    ToolManagementService.addMeasurement(
        'Marker Mode',
        flythroughValue,
        entities
    );

    console.log("MarkerModeTool: Added marker flythrough to measurement history");

    if (!wasRecordingActive) {
        PopupService.showToolInstruction(
            `Marker flythrough completed!\n\n` +
            `Statistics:\n` +
            `• Waypoints visited: ${orderedMarkers.length}\n` +
            `• Total duration: ${totalDuration.toFixed(1)}s\n` +
            `• Average time per waypoint: ${(orderedMarkers.reduce((sum, m) => sum + m.waitTime, 0) / orderedMarkers.length).toFixed(1)}s\n\n` +
            `Flythrough finished successfully! (No recording was made)`,
            "Flythrough Complete",
            true
        );
        setTimeout(() => {
            ToolManagementService.deactivateCurrentTool();
        }, 3000);
    } else if (!recordingResult?.success) {
        setTimeout(() => {
            ToolManagementService.deactivateCurrentTool();
        }, 2000);
    }
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
    console.log("MarkerModeTool: Cleaning up marker mode tool");

    const { animationId, coreManager, isRecordingActive, markerId } = getToolState();

    if (animationId && coreManager) {
        try {
            coreManager.cancelFlightAnimation(animationId);
        } catch (error) {
            console.warn("MarkerModeTool: Error cancelling flight animation:", error);
        }
    }

    if (markerId) {
        try {
            FlythroughPlaybackService.unregisterFlythrough(markerId);
        } catch (error) {
            console.warn("MarkerModeTool: Error unregistering flythrough:", error);
        }
    }

    if (isRecordingActive) {
        await ScreenRecordingHelper.emergencyStopRecording('Marker Mode');
        setToolState({ isRecordingActive: false });
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
        isRecordingActive: false,
        recordedBlob: null,
        recordedInfo: null,
        animationId: null,
        markerId: null,
        coreManager: null
    });

    PopupService.hide();
    console.log("MarkerModeTool: Cleanup completed");
}