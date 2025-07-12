// src/utils/tools-helper.js
import * as Cesium from 'cesium';

// Internal state for tools
let toolState = {
    viewer: null, // Cesium Viewer instance
    handler: null, // ScreenSpaceEventHandler
    drawingPoints: [], // Array of Cesium.Cartesian3 (clicked points for current drawing)
    activeShape: null, // The temporary polyline/polygon entity
    labels: [], // Array of *persistent* label entities (segment lengths, total length, final area)
    points: [], // Array of point entities
    temporaryMeasureLabel: null, // The single, dynamic label shown during mouse move
    mousePosition: null, // Variable to store the current mouse position for rubber-banding
    groundPolyline: null, // Specific for Terrain Profile
    viewshieldPolylines: [], // For Viewshield Analysis segments
};

/**
 * Sets (or updates) the internal tool state.
 * This is used by ToolManagementService to initialize the viewer and handler.
 * @param {object} newState - An object containing properties to update in the toolState.
 */
export function setToolState(newState) {
    // If a new handler is provided, destroy the old one first
    if (newState.handler && toolState.handler && toolState.handler !== newState.handler) {
        toolState.handler.destroy();
    }
    Object.assign(toolState, newState);
}

/**
 * Returns the current internal tool state.
 * @returns {object} The toolState object.
 */
export function getToolState() {
    return toolState;
}

// Helper function for formatting distances
export function formatDistance(meters) {
    if (meters < 1000) {
        return `${meters.toFixed(2)} m`;
    } else {
        return `${(meters / 1000).toFixed(2)} km`;
    }
}

// Helper function for formatting areas, ALWAYS in km^2
export function formatArea(sqMeters) {
    return `${(sqMeters / 1000000).toFixed(6)} km²`;
}

export function removeEventHandlers() {
    const { handler } = toolState;
    if (handler) {
        handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
        handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
        handler.removeInputAction(Cesium.ScreenSpaceEventType.RIGHT_CLICK);
        handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    }
}

export function clearDrawing() {
    const { viewer, points, labels, temporaryMeasureLabel, activeShape, groundPolyline, viewshieldPolylines } = toolState;

    if (viewer) {
        points.forEach(entity => viewer.entities.remove(entity));
        labels.forEach(entity => viewer.entities.remove(entity));
        if (temporaryMeasureLabel) {
            viewer.entities.remove(temporaryMeasureLabel);
        }
        if (activeShape) {
            viewer.entities.remove(activeShape);
        }
        if (groundPolyline) {
            viewer.entities.remove(groundPolyline);
        }
        viewshieldPolylines.forEach(entity => viewer.entities.remove(entity));
    }

    // Reset all drawing-related state variables
    toolState.drawingPoints = [];
    toolState.activeShape = null;
    toolState.labels = [];
    toolState.points = [];
    toolState.temporaryMeasureLabel = null;
    toolState.mousePosition = null;
    toolState.groundPolyline = null;
    toolState.viewshieldPolylines = [];

    // Hide terrain profile panel if it exists
    const panel = document.getElementById('terrainProfilePanel');
    if (panel) {
        panel.style.display = 'none';
    }
}

export function addTemporaryPoint(position) {
    const { viewer, points } = toolState;
    if (!viewer) return;
    const point = viewer.entities.add({
        position: position,
        point: {
            pixelSize: 8,
            color: Cesium.Color.YELLOW,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            disableDepthTestDistance: Number.POSITIVE_INFINITY
        },
    });
    points.push(point);
}

export function addPersistentLabel(position, text) {
    const { viewer, labels } = toolState;
    if (!viewer) return;
    const label = viewer.entities.add({
        position: position,
        label: {
            text: text,
            font: '14pt Poppins',
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -10),
            disableDepthTestDistance: Number.POSITIVE_INFINITY
        },
    });
    labels.push(label);
}

// Helper to add or update the *single* temporary label
export function updateTemporaryLabel(position, text) {
    const { viewer } = toolState;
    let { temporaryMeasureLabel } = toolState; // Get current temporaryMeasureLabel from state

    if (!viewer) return;

    if (temporaryMeasureLabel) {
        viewer.entities.remove(temporaryMeasureLabel);
    }

    temporaryMeasureLabel = viewer.entities.add({
        position: position,
        label: {
            text: text,
            font: '14pt Poppins',
            fillColor: Cesium.Color.CYAN, // Different color for temporary label
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -10),
            disableDepthTestDistance: Number.POSITIVE_INFINITY
        },
    });
    toolState.temporaryMeasureLabel = temporaryMeasureLabel; // Update state with the new entity
}