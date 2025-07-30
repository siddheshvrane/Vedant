// src/components/Menu/SubSidebars/BasicTools/tools/MarkerModeTool.js

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

// Default configuration for marker mode
const DEFAULT_MARKER_CONFIG = {
    defaultWaitTime: 3.0,           // seconds to wait at each marker
    showMarkerLabels: true,         // show numbered labels on markers
    markerSize: 8,                  // size of marker points
    previewDuration: 2.0,           // seconds to preview each camera position
    enableCameraSmoothing: true,    // smooth camera transitions
    showElevationInfo: true         // show elevation info in markers
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

    // Clear any existing handlers first
    removeEventHandlers();

    // Initialize tool state with fresh arrays
    setToolState({
        viewer: viewer,
        handler: viewer ? new Cesium.ScreenSpaceEventHandler(viewer.canvas) : null,
        markerPoints: [],               // Fresh array for marker data objects
        markerEntities: [],             // Fresh array for visual marker entities
        activeMarkerMode: true,
        markerConfig: { ...DEFAULT_MARKER_CONFIG },
        nextMarkerId: 1,
        lastMarkerTime: 0,
        isRecording: true
    });

    const { handler } = getToolState();
    const toolName = "Marker Mode";

    if (!handler) {
        console.error("MarkerModeTool: Cannot create event handler - viewer not available");
        return;
    }

    // Show detailed initial instructions
    PopupService.showToolInstruction(
        `MARKER MODE INSTRUCTIONS:\n\n` +
        `CONTROLS:\n` +
        `• LEFT-CLICK to ADD waypoint markers\n` +
        `• RIGHT-CLICK to FINISH and configure flythrough\n\n` +
        `WHAT GETS RECORDED:\n` +
        `• Location coordinates & elevation\n` +
        `• Camera position & viewing angle\n` +
        `• Zoom level & orientation\n` +
        `• Marker order for flythrough sequence\n\n` +
        `Each marker captures your current camera view!\n` +
        `Position your camera as desired, then left-click to mark.\n\n` +
        `TIP: Create multiple markers for zoom in/out effects!`,
        "Marker Mode Setup",
        true // Show dismiss button
    );

    // LEFT_CLICK Handler - Add marker point
    handler.setInputAction((click) => {
        console.log("MarkerModeTool: Left click detected");
        const { isRecording } = getToolState();
        
        if (isRecording) {
            addMarkerPoint(viewer, click, toolName);
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // RIGHT_CLICK Handler - Finish recording and show configuration
    handler.setInputAction((click) => {
        console.log("MarkerModeTool: Right click detected");
        const { isRecording } = getToolState();
        
        if (isRecording) {
            finishMarkerRecording(viewer, toolName);
        }
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
}

/**
 * Adds a new marker point with current camera state
 */
function addMarkerPoint(viewer, click, toolName) {
    const currentTime = Date.now();
    let { lastMarkerTime, nextMarkerId, markerPoints, markerEntities, markerConfig } = getToolState();

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

    // Get current camera state
    const camera = viewer.camera;
    const cameraState = {
        position: camera.position.clone(),
        direction: camera.direction.clone(),
        up: camera.up.clone(),
        right: camera.right.clone(),
        heading: camera.heading,
        pitch: camera.pitch,
        roll: camera.roll
    };

    // Get elevation information
    const cartographic = viewer.scene.globe.ellipsoid.cartesianToCartographic(cartesian);
    const longitude = Cesium.Math.toDegrees(cartographic.longitude);
    const latitude = Cesium.Math.toDegrees(cartographic.latitude);
    const height = cartographic.height || 0;

    // Calculate distance from camera to marker point
    const distanceToCamera = Cesium.Cartesian3.distance(camera.position, cartesian);

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

    // Stop recording mode
    setToolState({ isRecording: false });

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
        onStart: (configuredData) => {
            console.log("MarkerModeTool: Starting flythrough with configuration:", configuredData);
            startMarkerBasedFlythrough(configuredData);
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
            setToolState({ isRecording: true });
            setupMarkerModeTool(viewer); // Re-setup handlers
        }
    });
}

/**
 * Previews a specific marker's camera position
 */
function previewMarkerPosition(markerId) {
    const { markerPoints, viewer } = getToolState();
    const marker = markerPoints.find(m => m.id === markerId);
    
    if (!marker) {
        console.warn("MarkerModeTool: Marker not found for preview:", markerId);
        return;
    }

    console.log(`MarkerModeTool: Previewing marker ${markerId} camera position`);

    // Fly to the marker's camera state
    viewer.camera.flyTo({
        destination: marker.cameraState.position,
        orientation: {
            direction: marker.cameraState.direction,
            up: marker.cameraState.up
        },
        duration: 2.0,
        easingFunction: Cesium.EasingFunction.CUBIC_OUT
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
 * Starts the marker-based flythrough sequence
 */
async function startMarkerBasedFlythrough(configData) {
    const { markerPoints, viewer } = getToolState();
    
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

    // Start the flythrough animation
    await animateMarkerFlythrough(orderedMarkers, configData);
}

/**
 * Animates the marker-based flythrough
 */
async function animateMarkerFlythrough(orderedMarkers, configData) {
    const { viewer } = getToolState();
    
    PopupService.showToolInstruction(
        `🚀 Starting marker flythrough\n\n` +
        `📍 Waypoints: ${orderedMarkers.length}\n` +
        `⚙️ Smoothing: ${configData.enableSmoothing ? 'ON' : 'OFF'}\n` +
        `⏱️ Total estimated time: ${orderedMarkers.reduce((sum, m) => sum + m.waitTime, 0).toFixed(1)}s`,
        'Flythrough Active',
        false
    );

    const startTime = Date.now();

    for (let i = 0; i < orderedMarkers.length; i++) {
        const marker = orderedMarkers[i];
        const isLastMarker = i === orderedMarkers.length - 1;

        console.log(`MarkerModeTool: Flying to marker ${marker.id} (${i + 1}/${orderedMarkers.length})`);

        // Show progress
        PopupService.showToolInstruction(
            `Waypoint ${marker.id} (${i + 1}/${orderedMarkers.length})\n\n` +
            `${marker.coordinates.latitude.toFixed(4)}°, ${marker.coordinates.longitude.toFixed(4)}°\n` +
            `Elevation: ${marker.coordinates.elevation.toFixed(1)}m\n` +
            `Wait time: ${marker.waitTime}s\n\n` +
            `${isLastMarker ? 'Final waypoint!' : 'Next: Marker ' + orderedMarkers[i + 1]?.id}`,
            'Flythrough Progress',
            false
        );

        // Fly to marker camera position with zoom effects
        await new Promise((resolve) => {
            viewer.camera.flyTo({
                destination: marker.cameraState.position,
                orientation: {
                    direction: marker.cameraState.direction,
                    up: marker.cameraState.up
                },
                duration: configData.enableSmoothing ? 2.5 : 1.5, // Slightly longer for better zoom effects
                easingFunction: configData.enableSmoothing ? 
                    Cesium.EasingFunction.CUBIC_IN_OUT : 
                    Cesium.EasingFunction.LINEAR,
                complete: resolve
            });
        });

        // Wait at marker position (this allows time to appreciate the zoom level)
        if (!isLastMarker || marker.waitTime > 0) {
            await new Promise(resolve => setTimeout(resolve, marker.waitTime * 1000));
        }
    }

    // Show completion message
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    PopupService.showToolInstruction(
        `Marker flythrough completed!\n\n` +
        `Statistics:\n` +
        `• Total time: ${totalTime}s\n` +
        `• Waypoints visited: ${orderedMarkers.length}\n` +
        `• Average time per waypoint: ${(totalTime / orderedMarkers.length).toFixed(1)}s\n\n` +
        `Flythrough finished successfully!`,
        "Flythrough Complete",
        true
    );

    // Deactivate tool
    ToolManagementService.deactivateCurrentTool();
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
export function stopMarkerModeTool() {
    console.log("MarkerModeTool: Cleaning up marker mode tool");
    
    const { viewer } = getToolState();
    
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
        isRecording: false
    });
    
    // Hide any active popups
    PopupService.hide();
    
    console.log("MarkerModeTool: Cleanup completed");
}