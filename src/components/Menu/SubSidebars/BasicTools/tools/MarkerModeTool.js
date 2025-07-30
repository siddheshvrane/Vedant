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

    // Initialize tool state
    setToolState({
        viewer: viewer,
        handler: viewer ? new Cesium.ScreenSpaceEventHandler(viewer.canvas) : null,
        markerPoints: [],               // Array of marker data objects
        markerEntities: [],             // Visual marker entities
        activeMarkerMode: true,
        markerConfig: { ...DEFAULT_MARKER_CONFIG },
        nextMarkerId: 1,
        lastMarkerTime: 0,
        isRecording: true
    });

    const { handler } = getToolState();
    const toolName = "Marker Mode";

    // Show detailed initial instructions
    PopupService.showToolInstruction(
        `📍 MARKER MODE INSTRUCTIONS:\n\n` +
        `🖱️ CONTROLS:\n` +
        `• Left-click to ADD waypoint markers\n` +
        `• Right-click to FINISH and configure flythrough\n\n` +
        `📋 WHAT GETS RECORDED:\n` +
        `• Location coordinates & elevation\n` +
        `• Camera position & viewing angle\n` +
        `• Zoom level & orientation\n` +
        `• Marker order for flythrough sequence\n\n` +
        `🎯 Each marker captures your current camera view!\n` +
        `Position your camera as desired, then left-click to mark.`,
        "Marker Mode Setup",
        true // Show dismiss button
    );

    // LEFT_CLICK Handler - Add marker point
    handler.setInputAction((click) => {
        const { isRecording } = getToolState();
        
        if (isRecording) {
            addMarkerPoint(viewer, click, toolName);
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // RIGHT_CLICK Handler - Finish recording and show configuration
    handler.setInputAction(() => {
        const { isRecording, markerPoints } = getToolState();
        
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
    const { lastMarkerTime, nextMarkerId, markerPoints, markerEntities, markerConfig } = getToolState();

    // Throttle marker creation to prevent accidental rapid clicking
    if (currentTime - lastMarkerTime < 500) {
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

    // Add to marker points array
    markerPoints.push(markerData);

    // Create visual marker entity
    const markerColor = MARKER_COLORS[(nextMarkerId - 1) % MARKER_COLORS.length];
    const markerEntity = viewer.entities.add({
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
            font: '14pt Arial',
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -30),
            disableDepthTestDistance: Number.POSITIVE_INFINITY
        } : undefined,
        description: createMarkerDescription(markerData)
    });

    markerEntities.push(markerEntity);

    // Update state
    setToolState({
        markerPoints: [...markerPoints],
        markerEntities: [...markerEntities],
        nextMarkerId: nextMarkerId + 1,
        lastMarkerTime: currentTime
    });

    // Show feedback
    PopupService.showToolInstruction(
        `Marker ${nextMarkerId} added! Total: ${markerPoints.length} markers. Right-click when ready to configure flythrough.`,
        toolName,
        false
    );

    console.log(`MarkerModeTool: Added marker ${nextMarkerId} at`, markerData.coordinates);

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
           `<p><strong>Wait Time:</strong> ${markerData.waitTime}s</p>`;
}

/**
 * Finishes marker recording and shows configuration form
 */
function finishMarkerRecording(viewer, toolName) {
    const { markerPoints } = getToolState();

    if (markerPoints.length === 0) {
        PopupService.showToolInstruction(
            "No markers placed yet. Left-click to add waypoint markers first.",
            "No Markers",
            true
        );
        return;
    }

    // Stop recording mode
    setToolState({ isRecording: false });

    // Remove event handlers for marker placement
    removeEventHandlers();

    console.log(`MarkerModeTool: Finished recording ${markerPoints.length} markers`);

    // Show marker configuration form
    showMarkerConfigurationForm(markerPoints, toolName);
}

/**
 * Shows the configuration form for marker-based flythrough
 */
function showMarkerConfigurationForm(markerPoints, toolName) {
    // Create form data structure for the popup
    const formData = {
        markers: markerPoints.map(marker => ({
            id: marker.id,
            order: marker.order,
            waitTime: marker.waitTime,
            coordinates: marker.coordinates,
            description: `Marker ${marker.id} (${marker.coordinates.latitude.toFixed(4)}°, ${marker.coordinates.longitude.toFixed(4)}°, ${marker.coordinates.elevation.toFixed(1)}m)`
        })),
        totalDuration: markerPoints.reduce((sum, marker) => sum + marker.waitTime, 0),
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
                "Marker flythrough cancelled. You can continue adding markers or right-click again to reconfigure.",
                toolName,
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
        `Previewing Marker ${markerId} camera view...`,
        "Preview Mode",
        false
    );
}

/**
 * Starts the marker-based flythrough sequence
 */
async function startMarkerBasedFlythrough(configData) {
    const { markerPoints, viewer } = getToolState();
    
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

    console.log(`MarkerModeTool: Starting flythrough sequence with ${orderedMarkers.length} markers`);

    // Start the flythrough animation
    await animateMarkerFlythrough(orderedMarkers, configData);
}

/**
 * Animates the marker-based flythrough
 */
async function animateMarkerFlythrough(orderedMarkers, configData) {
    const { viewer } = getToolState();
    
    PopupService.showToolInstruction(
        `Starting marker flythrough: ${orderedMarkers.length} waypoints...`,
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
            `Waypoint ${marker.id} (${i + 1}/${orderedMarkers.length}) - Waiting ${marker.waitTime}s`,
            'Flythrough Progress',
            false
        );

        // Fly to marker camera position
        await new Promise((resolve) => {
            viewer.camera.flyTo({
                destination: marker.cameraState.position,
                orientation: {
                    direction: marker.cameraState.direction,
                    up: marker.cameraState.up
                },
                duration: configData.enableSmoothing ? 2.0 : 1.0,
                easingFunction: configData.enableSmoothing ? 
                    Cesium.EasingFunction.CUBIC_IN_OUT : 
                    Cesium.EasingFunction.LINEAR,
                complete: resolve
            });
        });

        // Wait at marker position
        if (!isLastMarker || marker.waitTime > 0) {
            await new Promise(resolve => setTimeout(resolve, marker.waitTime * 1000));
        }
    }

    // Show completion message
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    PopupService.showToolInstruction(
        `Marker flythrough completed! Total time: ${totalTime}s, Waypoints visited: ${orderedMarkers.length}`,
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
        markerEntities.forEach(entity => {
            if (viewer && viewer.entities.contains(entity)) {
                viewer.entities.remove(entity);
            }
        });
        setToolState({ markerEntities: [] });
        console.log("MarkerModeTool: Cleared marker visuals");
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
    
    // Reset tool state
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