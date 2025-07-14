import * as Cesium from 'cesium';

// Internal state for tools
let toolState = {
    viewer: null, // Cesium Viewer instance
    handler: null, // ScreenSpaceEventHandler
    drawingPoints: [], // Array of Cesium.Cartesian3 (clicked points for current drawing)
    activeShape: null, // The temporary polyline/polygon entity for rubber-banding
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
 * Importantly, it now handles the destruction of the old handler.
 * @param {object} newState - An object containing properties to update in the toolState.
 */
export function setToolState(newState) {
    // Check if the handler is being updated or set to null
    // If there's an existing handler and:
    //   1. A new handler is explicitly provided in newState AND it's different from the current one.
    //   OR
    //   2. newState explicitly sets `handler` to `null` or `undefined`.
    if (toolState.handler &&
       ( (newState.handler !== undefined && newState.handler !== toolState.handler) ||
         (newState.hasOwnProperty('handler') && newState.handler === null) )
    ) {
        toolState.handler.destroy();
        console.log("tool-helpers: Old ScreenSpaceEventHandler destroyed.");
    }

    // Apply the new state
    Object.assign(toolState, newState);
}

/**
 * Returns the current internal tool state.
 * @returns {object} The toolState object.
 */
export function getToolState() {
    return toolState;
}

/**
 * A utility function to throttle repeated function calls.
 * @param {Function} func - The function to throttle.
 * @param {number} delay - The delay in milliseconds.
 * @returns {Function} A throttled version of the function.
 */
export function throttle(func, delay) {
    let timeout = null;
    let lastArgs = null;
    let lastThis = null;

    return function(...args) {
        lastArgs = args;
        lastThis = this;
        if (!timeout) {
            timeout = setTimeout(() => {
                func.apply(lastThis, lastArgs);
                timeout = null;
                lastArgs = null;
                lastThis = null;
            }, delay);
        }
    };
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

/**
 * Removes all currently set input actions from the handler.
 * Note: This does NOT destroy the handler object itself.
 * The handler object's lifecycle is managed by setToolState and ToolManagementService.
 */
export function removeEventHandlers() {
    const { handler } = toolState;
    if (handler) {
        handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
        handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
        handler.removeInputAction(Cesium.ScreenSpaceEventType.RIGHT_CLICK);
        handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
        console.log("tool-helpers: All event handlers removed.");
    }
}

/**
 * Clears all drawing entities from the viewer and resets related state variables.
 */
export function clearDrawing() {
    const { viewer, points, labels, temporaryMeasureLabel, activeShape, groundPolyline, viewshieldPolylines } = toolState;

    if (viewer) {
        // Remove points
        points.forEach(entity => viewer.entities.remove(entity));
        // Remove persistent labels
        labels.forEach(entity => viewer.entities.remove(entity));
        // Remove temporary measure label
        if (temporaryMeasureLabel) {
            viewer.entities.remove(temporaryMeasureLabel);
        }
        // Remove active shape (e.g., rubber-banding polyline/polygon)
        if (activeShape) {
            viewer.entities.remove(activeShape);
        }
        // Remove terrain profile ground polyline
        if (groundPolyline) {
            viewer.entities.remove(groundPolyline);
        }
        // Remove viewshield analysis polylines
        viewshieldPolylines.forEach(entity => viewer.entities.remove(entity));
        console.log("tool-helpers: All drawing entities cleared from viewer.");

        // Optional: Request a render if viewer is in requestRenderMode
        // if (viewer.scene.requestRenderMode) {
        //      viewer.scene.requestRender();
        // }
    }

    // Reset all drawing-related state variables to their initial empty/null values
    toolState.drawingPoints = [];
    toolState.activeShape = null;
    toolState.labels = [];
    toolState.points = [];
    toolState.temporaryMeasureLabel = null; // Set to null *after* removing from viewer
    toolState.mousePosition = null;
    toolState.groundPolyline = null;
    toolState.viewshieldPolylines = [];

    // Hide terrain profile panel if it exists
    const panel = document.getElementById('terrainProfilePanel');
    if (panel) {
        panel.style.display = 'none';
        console.log("tool-helpers: Terrain profile panel hidden.");
    }
}

/**
 * Adds a temporary point entity to the viewer.
 * @param {Cesium.Cartesian3} position - The position of the point.
 */
export function addTemporaryPoint(position) {
    const { viewer, points } = toolState;
    if (!viewer) {
        console.warn("tool-helpers: Viewer not available to add temporary point.");
        return;
    }
    const point = viewer.entities.add({
        position: position,
        point: {
            pixelSize: 8,
            color: Cesium.Color.YELLOW,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            disableDepthTestDistance: Number.POSITIVE_INFINITY // Always show on top
        },
    });
    points.push(point);

    // Optional: Request a render if viewer is in requestRenderMode
    // if (viewer.scene.requestRenderMode) {
    //      viewer.scene.requestRender();
    // }
}

/**
 * Adds a persistent label entity to the viewer.
 * @param {Cesium.Cartesian3} position - The position of the label.
 * @param {string} text - The text content of the label.
 */
export function addPersistentLabel(position, text) {
    const { viewer, labels } = toolState;
    if (!viewer) {
        console.warn("tool-helpers: Viewer not available to add persistent label.");
        return;
    }
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
            disableDepthTestDistance: Number.POSITIVE_INFINITY // Always show on top
        },
    });
    labels.push(label);

    // Optional: Request a render if viewer is in requestRenderMode
    // if (viewer.scene.requestRenderMode) {
    //      viewer.scene.requestRender();
    // }
}

/**
 * Adds or updates the *single* temporary label shown during mouse movement for measurements.
 * This function is optimized to update an existing entity rather than removing/re-adding.
 * @param {Cesium.Cartesian3} position - The position for the temporary label.
 * @param {string} text - The text content for the temporary label.
 */
export function updateTemporaryLabel(position, text) {
    const { viewer } = toolState;
    if (!viewer) {
        console.warn("tool-helpers: Viewer not available to update temporary label.");
        return;
    }

    if (!toolState.temporaryMeasureLabel) {
        // If the temporary label doesn't exist, create it once
        toolState.temporaryMeasureLabel = viewer.entities.add({
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
                disableDepthTestDistance: Number.POSITIVE_INFINITY // Always show on top
            },
        });
        console.log("tool-helpers: Temporary measure label created.");
    } else {
        // If it exists, just update its properties (position and text)
        // This is significantly more efficient than removing and re-adding.
        toolState.temporaryMeasureLabel.position = new Cesium.ConstantPositionProperty(position);
        toolState.temporaryMeasureLabel.label.text = text;
        // console.log("tool-helpers: Temporary measure label updated."); // Too verbose for mouse move
    }

    // Optional: Request a render if viewer is in requestRenderMode
    // if (viewer.scene.requestRenderMode) {
    //      viewer.scene.requestRender();
    // }
}