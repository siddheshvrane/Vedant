// src/components/Menu/SubSidebars/BasicTools/tools/MarkerModeTool.js - Updated with shared recording helper

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
import { ScreenRecordingHelper } from '../tool-helpers/ScreenRecordingHelper.js';

// Default configuration for marker mode
const DEFAULT_MARKER_CONFIG = {
    defaultWaitTime: 3.0,          // seconds to wait at each marker
    showMarkerLabels: true,        // show numbered labels on markers
    markerSize: 8,                 // size of marker points
    previewDuration: 2.0,          // seconds to preview each camera position
    enableCameraSmoothing: true,   // smooth camera transitions
    showElevationInfo: true        // show elevation info in markers
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
 * @param {Cesium.Viewer} viewer The Cesium Viewer instance.
 */
export function setupMarkerModeTool(viewer) {
    console.log("MarkerModeTool: Setting up marker-based flythrough tool");

    // Get CesiumCoreManager instance from viewer with comprehensive fallback
    const coreManager = getCoreManagerFromViewer(viewer);
    if (!coreManager) {
        console.error("MarkerModeTool: Cannot access CesiumCoreManager");
        PopupService.showToolInstruction(
            "Marker Mode requires CesiumCoreManager but it's not available.\n\n" +
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

    console.log("MarkerModeTool: CesiumCoreManager successfully obtained");

    // Clear any existing handlers first
    removeEventHandlers();

    // Initialize tool state with fresh arrays
    setToolState({
        viewer: viewer,
        coreManager: coreManager,
        handler: viewer ? new Cesium.ScreenSpaceEventHandler(viewer.canvas) : null,
        markerPoints: [],              // Fresh array for marker data objects
        markerEntities: [],            // Fresh array for visual marker entities
        activeMarkerMode: true,
        markerConfig: { ...DEFAULT_MARKER_CONFIG },
        nextMarkerId: 1,
        lastMarkerTime: 0,
        isRecordingMarkers: true,
        isFlythroughActive: false,
        isRecordingActive: false,      // New state for screen recording status
        recordedBlob: null,
        recordedInfo: null,
        animationId: null
    });

    const { handler } = getToolState();
    const toolName = "Marker Mode";

    if (!handler) {
        console.error("MarkerModeTool: Cannot create event handler - viewer not available");
        return;
    }

    // Show detailed initial instructions with recording context
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

    PopupService.showToolInstruction(
        enhancedInstructions,
        "Marker Mode Setup",
        true // Show dismiss button
    );

    // LEFT_CLICK Handler - Add marker point
    handler.setInputAction((click) => {
        console.log("MarkerModeTool: Left click detected");
        const { isRecordingMarkers } = getToolState();

        if (isRecordingMarkers) {
            addMarkerPoint(viewer, click, toolName);
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // RIGHT_CLICK Handler - Finish recording and show configuration
    handler.setInputAction((click) => {
        console.log("MarkerModeTool: Right click detected");
        const { isRecordingMarkers } = getToolState();

        if (isRecordingMarkers) {
            finishMarkerRecording(viewer, toolName);
        }
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
}

/**
 * Gets CesiumCoreManager instance from viewer with comprehensive fallback methods
 */
function getCoreManagerFromViewer(viewer) {
    console.log('MarkerModeTool: Looking for CesiumCoreManager...');

    // Method 1: Check if attached to viewer
    if (viewer && viewer._coreManager) {
        console.log('MarkerModeTool: ✅ Found CesiumCoreManager attached to viewer');
        return viewer._coreManager;
    }

    // Method 2: Check MapService first (most reliable)
    try {
        const coreManagerFromMapService = MapService.getCoreManager();
        if (coreManagerFromMapService) {
            console.log('MarkerModeTool: ✅ Found CesiumCoreManager in MapService');
            return coreManagerFromMapService;
        }
    } catch (error) {
        console.warn('MarkerModeTool: Could not get core manager from MapService:', error);
    }

    // Method 3: Check global reference
    if (window.cesiumCoreManager) {
        console.log('MarkerModeTool: ✅ Found CesiumCoreManager in global window');
        return window.cesiumCoreManager;
    }

    console.error('MarkerModeTool: ❌ CesiumCoreManager not found in any expected location');
    console.error('MarkerModeTool: Debug information:');
    console.error(`  • viewer exists: ${!!viewer}`);
    console.error(`  • viewer._coreManager exists: ${!!viewer?._coreManager}`);
    console.error(`  • window.cesiumCoreManager exists: ${!!window.cesiumCoreManager}`);
    console.error(`  • MapService.getCoreManager() exists: ${!!MapService.getCoreManager()}`);

    return null;
}

/**
 * Adds a new marker point with current camera state using CesiumCoreManager
 */
function addMarkerPoint(viewer, click, toolName) {
    const currentTime = Date.now();
    let { lastMarkerTime, nextMarkerId, markerPoints, markerEntities, markerConfig, coreManager } = getToolState();

    console.log(`MarkerModeTool: Attempting to add marker ${nextMarkerId}`);

    // Throttle marker creation to prevent accidental rapid clicking
    if (currentTime - lastMarkerTime < 300) { // Reduced from 500ms to 300ms
        console.log("MarkerModeTool: Click throttled");
        return;
    }

    // Get click position
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

    // Get current camera state using CesiumCoreManager
    const cameraState = coreManager.getCameraState();

    // Get elevation information
    const cartographic = viewer.scene.globe.ellipsoid.cartesianToCartographic(cartesian);
    const longitude = Cesium.Math.toDegrees(cartographic.longitude);
    const latitude = Cesium.Math.toDegrees(cartographic.latitude);
    const height = cartographic.height || 0;

    // Calculate distance from camera to marker point
    const distanceToCamera = Cesium.Cartesian3.distance(cameraState.position, cartesian);

    // Create marker data object
    const markerData = {
        id: nextMarkerId,
        position: cartesian.clone(),
        cartographic: cartographic,
        coordinates: {
            longitude: longitude,
            latitude: latitude,
            elevation: height
        },
        cameraState: cameraState,
        distanceFromCamera: distanceToCamera,
        waitTime: markerConfig.defaultWaitTime,
        timestamp: currentTime,
        order: nextMarkerId // Initial order same as ID
    };

    // Ensure we have fresh arrays to work with
    if (!Array.isArray(markerPoints)) {
        markerPoints = [];
    }
    if (!Array.isArray(markerEntities)) {
        markerEntities = [];
    }

    // Add to marker points array
    const newMarkerPoints = [...markerPoints, markerData];

    // Create visual marker entity
    const markerColor = MARKER_COLORS[(nextMarkerId - 1) % MARKER_COLORS.length];
    const markerEntity = viewer.entities.add({
        id: `marker_${nextMarkerId}`, // Add unique ID for easier management
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

    // Update state with new arrays
    setToolState({
        markerPoints: newMarkerPoints,
        markerEntities: newMarkerEntities,
        nextMarkerId: nextMarkerId + 1,
        lastMarkerTime: currentTime
    });

    // Show feedback with current count
    PopupService.showToolInstruction(
        `Marker ${nextMarkerId} added!\n\n` +
        `Total markers: ${newMarkerPoints.length}\n` +
        `Continue left-clicking to add more markers, or right-click when ready to configure flythrough.`,
        `${toolName} - ${newMarkerPoints.length} Markers`,
        false
    );

    console.log(`MarkerModeTool: Added marker ${nextMarkerId} at`, markerData.coordinates);
    console.log(`MarkerModeTool: Total markers now: ${newMarkerPoints.length}`);

    if (viewer.scene.requestRenderMode) {
        viewer.scene.requestRender();
    }
}

/**
 * Creates a description for the marker entity
 */
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

/**
 * Finishes marker recording and shows configuration form
 */
function finishMarkerRecording(viewer, toolName) {
    const { markerPoints } = getToolState();

    console.log(`MarkerModeTool: Finishing recording with ${markerPoints ? markerPoints.length : 0} markers`);

    if (!markerPoints || markerPoints.length === 0) {
        PopupService.showToolInstruction(
            "No markers placed yet!\n\n" +
            "Please left-click on the globe to add waypoint markers first.\n\n" +
            "TIP: Position your camera at different zoom levels and angles for varied flythrough effects.",
            "No Markers Found",
            true
        );
        return;
    }

    if (markerPoints.length === 1) {
        PopupService.showToolInstruction(
            "Only 1 marker found!\n\n" +
            "For a flythrough, you need at least 2 markers.\n\n" +
            "Continue left-clicking to add more markers, or right-click again when ready.",
            "Need More Markers",
            true
        );
        return;
    }

    // Stop recording mode for markers
    setToolState({ isRecordingMarkers: false });

    // Remove event handlers for marker placement
    removeEventHandlers();

    console.log(`MarkerModeTool: Successfully finished recording ${markerPoints.length} markers`);

    // Show marker configuration form
    showMarkerConfigurationForm(markerPoints, toolName);
}

/**
 * Shows the configuration form for marker-based flythrough
 */
function showMarkerConfigurationForm(markerPoints, toolName) {
    console.log("MarkerModeTool: Showing configuration form for", markerPoints.length, "markers");

    // Create form data structure for the popup
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

    // Show configuration popup using PopupService
    PopupService.showMarkerSequenceForm({
        markers: formData.markers,
        totalDuration: formData.totalDuration,
        enableSmoothing: formData.enableSmoothing,
        previewDuration: formData.previewDuration,
        onStart: async (configuredData) => {
            console.log("MarkerModeTool: Starting flythrough with configuration:", configuredData);
            await handleMarkerFlythroughSetupAndRecording(configuredData);
        },
        onPreview: (markerId) => {
            console.log("MarkerModeTool: Previewing marker:", markerId);
            previewMarkerPosition(markerId);
        },
        onCancel: () => {
            console.log("MarkerModeTool: Configuration cancelled");
            PopupService.showToolInstruction(
                "Marker flythrough cancelled.\n\n" +
                "You can:\n" +
                "• Continue adding markers (left-click)\n" +
                "• Right-click again to reconfigure\n" +
                "• Deactivate the tool to exit",
                toolName + " - Cancelled",
                true
            );
            // Re-enable recording mode
            setToolState({ isRecordingMarkers: true });
            setupMarkerModeTool(getToolState().viewer); // Re-setup handlers
        }
    });
}

/**
 * Enhanced function using shared recording helper for marker-based flythrough
 */
async function handleMarkerFlythroughSetupAndRecording(configuredData) {
    try {
        console.log("MarkerModeTool: Starting recording setup sequence...");

        let recordingActive = false;

        // Use shared recording helper for setup
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
            
            // Check if it's a user-friendly error that allows continuation
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

        // Execute the marker flythrough (with or without recording)
        console.log('MarkerModeTool: Proceeding with marker flythrough. Recording active:', recordingActive);
        await startMarkerBasedFlythrough(configuredData, recordingActive);

    } catch (error) {
        console.error("MarkerModeTool: Critical error during setup:", error);

        // Emergency cleanup if recording was started
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

/**
 * Previews a specific marker's camera position using CesiumCoreManager
 */
function previewMarkerPosition(markerId) {
    const { markerPoints, coreManager } = getToolState();
    const marker = markerPoints.find(m => m.id === markerId);

    if (!marker) {
        console.warn("MarkerModeTool: Marker not found for preview:", markerId);
        return;
    }

    console.log(`MarkerModeTool: Previewing marker ${markerId} camera position`);

    // Use CesiumCoreManager to set camera view
    coreManager.setCameraView({
        destination: marker.cameraState.position,
        orientation: {
            direction: marker.cameraState.direction,
            up: marker.cameraState.up
        },
        duration: 2.0
    });

    // Show preview feedback
    PopupService.showToolInstruction(
        `Previewing Marker ${markerId}\n\n` +
        `Camera view as recorded when marker was placed.\n` +
        `This is how the flythrough will look at this waypoint.`,
        "Preview Mode",
        false
    );
}

/**
 * Starts the marker-based flythrough sequence using CesiumCoreManager and optionally records it
 */
async function startMarkerBasedFlythrough(configData, recordingActive) {
    const { markerPoints, coreManager, viewer } = getToolState();

    try {
        console.log("MarkerModeTool: Starting flythrough with", markerPoints.length, "markers");

        // Remove event handlers and visual markers
        removeEventHandlers();
        clearMarkerVisuals();

        // Sort markers by configured order
        const orderedMarkers = [...markerPoints].sort((a, b) => {
            const orderA = configData.markers.find(m => m.id === a.id)?.order || a.order;
            const orderB = configData.markers.find(m => m.id === b.id)?.order || b.order;
            return orderA - orderB;
        });

        // Update wait times from configuration
        orderedMarkers.forEach(marker => {
            const configMarker = configData.markers.find(m => m.id === marker.id);
            if (configMarker) {
                marker.waitTime = configMarker.waitTime;
            }
        });

        console.log(`MarkerModeTool: Starting flythrough sequence with ${orderedMarkers.length} ordered markers`);

        const recordingStatus = recordingActive ? 'Recording in progress!' : 'No recording';
        PopupService.showToolInstruction(
            `🚀 Starting marker flythrough\n\n` +
            `📍 Waypoints: ${orderedMarkers.length}\n` +
            `⚙️ Smoothing: ${configData.enableSmoothing ? 'ON' : 'OFF'}\n` +
            `⏱️ Total estimated time: ${orderedMarkers.reduce((sum, m) => sum + m.waitTime, 0).toFixed(1)}s\n\n` +
            recordingStatus,
            'Flythrough Active',
            false
        );

        setToolState({ isFlythroughActive: true });

        const flythroughStartTime = Date.now();

        // Create marker flight animation using CesiumCoreManager
        const animationId = coreManager.createMarkerFlightAnimation(
            orderedMarkers,
            {
                enableSmoothing: configData.enableSmoothing,
                waitTime: configData.markers[0]?.waitTime || 3.0
            },
            // Progress callback
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
            // Completion callback
            async () => {
                const totalFlythroughTime = ((Date.now() - flythroughStartTime) / 1000);
                console.log("MarkerModeTool: Marker flythrough animation completed");
                await handleMarkerFlythroughCompletion(orderedMarkers, totalFlythroughTime, recordingActive);
            }
        );

        // Store animation ID for potential cancellation
        setToolState({ animationId: animationId });

    } catch (error) {
        console.error("MarkerModeTool: Error executing marker flythrough:", error);
        throw error;
    }
}

/**
 * Handle marker flythrough completion and recording processing using shared helper
 */
async function handleMarkerFlythroughCompletion(orderedMarkers, totalDuration, wasRecordingActive) {
    let recordingResult = null;

    // Stop recording if it was active using shared helper
    if (wasRecordingActive) {
        try {
            recordingResult = await ScreenRecordingHelper.completeRecording(
                'Marker Mode',
                (result) => {
                    // Store the recording data
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
    } else {
        console.log("MarkerModeTool: Marker flythrough completed without recording, total time:", totalDuration.toFixed(1));
    }

    // Add to measurement history
    const flythroughValue = `${orderedMarkers.length} markers, ${totalDuration.toFixed(1)}s duration${recordingResult?.success ? ' (Recorded)' : ''}`;

    const entities = {
        markerId: `marker_flythrough_${Date.now()}`,
        recordingBlob: recordingResult?.success ? recordingResult.blob : null,
        recordingInfo: recordingResult?.success ? recordingResult.info : null,
        totalDuration: totalDuration,
        orderedMarkers: orderedMarkers,
        markerCount: orderedMarkers.length
    };

    ToolManagementService.addMeasurement(
        'Marker Mode',
        flythroughValue,
        entities
    );

    console.log("MarkerModeTool: Added marker flythrough to measurement history");

    // Show completion message if no recording was processed
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
        // Show completion if recording failed but flythrough succeeded
        setTimeout(() => {
            ToolManagementService.deactivateCurrentTool();
        }, 2000);
    }
}

/**
 * Clears all marker visual entities
 */
function clearMarkerVisuals() {
    const { viewer, markerEntities } = getToolState();

    if (markerEntities && markerEntities.length > 0) {
        console.log(`MarkerModeTool: Clearing ${markerEntities.length} marker visuals`);
        markerEntities.forEach(entity => {
            if (viewer && viewer.entities.contains(entity)) {
                viewer.entities.remove(entity);
            }
        });
        setToolState({ markerEntities: [] });
        console.log("MarkerModeTool: Cleared all marker visuals");
    }
}

/**
 * Stops the marker mode tool and cleans up resources
 */
export async function stopMarkerModeTool() {
    console.log("MarkerModeTool: Cleaning up marker mode tool");

    const { animationId, coreManager, isRecordingActive, isFlythroughActive } = getToolState();

    // Cancel flight animation using CesiumCoreManager
    if (animationId && coreManager) {
        try {
            coreManager.cancelFlightAnimation(animationId);
            console.log("MarkerModeTool: Flight animation cancelled successfully");
        } catch (error) {
            console.warn("MarkerModeTool: Error cancelling flight animation:", error);
        }
    }

    // Handle recording stop using shared helper
    if (isRecordingActive) {
        await ScreenRecordingHelper.emergencyStopRecording('Marker Mode');
        setToolState({ isRecordingActive: false });
    }

    // Clear visual markers
    clearMarkerVisuals();

    // Clear drawing and remove event handlers
    clearDrawing();
    removeEventHandlers();

    // Reset tool state with fresh empty arrays
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
        coreManager: null
    });

    // Hide any active popups
    PopupService.hide();

    console.log("MarkerModeTool: Cleanup completed");
}