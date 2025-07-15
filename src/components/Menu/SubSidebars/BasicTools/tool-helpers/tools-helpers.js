// tool-helpers/tools-helpers.js
import * as Cesium from 'cesium';
import { recordAction, getHistory, clearHistory } from './history'; // Import history functions

// Re-export history functions directly from this file for a single import point
export { recordAction, getHistory, clearHistory };

/**
 * @typedef {object} ToolState
 * @property {Cesium.Viewer|null} viewer - Cesium Viewer instance.
 * @property {Cesium.ScreenSpaceEventHandler|null} handler - ScreenSpaceEventHandler.
 * @property {Cesium.Cartesian3[]} drawingPoints - Array of Cesium.Cartesian3 (clicked points for current drawing).
 * @property {Cesium.Entity|null} activeShape - The temporary polyline/polygon entity for rubber-banding.
 * @property {Cesium.Entity[]} labels - Array of *temporary* label entities (segment lengths, total length, final area for current drawing).
 * @property {Cesium.Entity[]} points - Array of *temporary* point entities.
 * @property {Cesium.Entity|null} temporaryMeasureLabel - The single, dynamic label shown during mouse move.
 * @property {Cesium.Cartesian3|null} mousePosition - Variable to store the current mouse position for rubber-banding.
 * @property {Cesium.Entity|null} groundPolyline - Specific for Terrain Profile.
 * @property {Cesium.Entity[]} viewshieldPolylines - For Viewshield Analysis segments.
 */

/**
 * Internal state for tools.
 * This state is managed directly within this file.
 * @type {ToolState}
 */
let toolState = {
    viewer: null,
    handler: null,
    drawingPoints: [],
    activeShape: null,
    labels: [],
    points: [],
    temporaryMeasureLabel: null,
    mousePosition: null,
    groundPolyline: null,
    viewshieldPolylines: [],
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
        ((newState.handler !== undefined && newState.handler !== toolState.handler) ||
         (newState.hasOwnProperty('handler') && newState.handler === null))
    ) {
        toolState.handler.destroy();
        console.log("tools-helpers: Old ScreenSpaceEventHandler destroyed during state update.");
    }

    // Apply the new state
    Object.assign(toolState, newState);
}

/**
 * Returns the current internal tool state.
 * @returns {ToolState} The toolState object.
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

/**
 * Helper function for formatting distances.
 * @param {number} meters - Distance in meters.
 * @returns {string} Formatted distance string.
 */
export function formatDistance(meters) {
    if (meters < 1000) {
        return `${meters.toFixed(2)} m`;
    } else {
        return `${(meters / 1000).toFixed(2)} km`;
    }
}

/**
 * Helper function for formatting areas, ALWAYS in km^2.
 * @param {number} sqMeters - Area in square meters.
 * @returns {string} Formatted area string.
 */
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
        console.log("tools-helpers: All event handlers removed.");
    }
}

/**
 * Clears all drawing entities from the viewer and resets related state variables.
 */
export function clearDrawing() {
    const { viewer, points, labels, temporaryMeasureLabel, activeShape, groundPolyline, viewshieldPolylines } = toolState;

    if (viewer) {
        // Remove points (temporary drawing points)
        points.forEach(entity => viewer.entities.remove(entity));
        // Remove temporary labels (segment lengths, total length for current drawing)
        labels.forEach(entity => viewer.entities.remove(entity));
        // Remove temporary measure label (mouse-move feedback)
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
        console.log("tools-helpers: All temporary drawing entities cleared from viewer.");

        // Optional: Request a render if viewer is in requestRenderMode
        if (viewer.scene.requestRenderMode) {
            viewer.scene.requestRender();
        }
    }

    // Reset all drawing-related state variables to their initial empty/null values
    toolState.drawingPoints = [];
    toolState.activeShape = null;
    toolState.labels = []; // Clear temporary labels
    toolState.points = []; // Clear temporary points
    toolState.temporaryMeasureLabel = null; // Set to null *after* removing from viewer
    toolState.mousePosition = null;
    toolState.groundPolyline = null;
    toolState.viewshieldPolylines = [];

    // Hide terrain profile panel if it exists
    const panel = document.getElementById('terrainProfilePanel');
    if (panel) {
        panel.style.display = 'none';
        console.log("tools-helpers: Terrain profile panel hidden.");
    }
}

/**
 * Removes all entities that have been recorded in the tool's temporary state
 * arrays (points, labels, temporaryMeasureLabel, activeShape, groundPolyline, viewshieldPolylines).
 * This function is intended to be called when the viewer changes or is destroyed,
 * to ensure no orphaned entities remain from previous tool usages.
 * It's distinct from `clearDrawing` in that it's for a broader cleanup, not just ending a single drawing session.
 * @param {Cesium.Viewer} viewer The Cesium Viewer instance.
 */
export function removeAllToolEntities(viewer) {
    if (!viewer) {
        console.warn("tools-helpers: Viewer is not available for removeAllToolEntities.");
        return;
    }

    // Explicitly remove any entities still held in toolState arrays
    const entitiesToRemove = [
        ...toolState.points,
        ...toolState.labels,
        ...toolState.viewshieldPolylines
    ];

    if (toolState.temporaryMeasureLabel) {
        entitiesToRemove.push(toolState.temporaryMeasureLabel);
    }
    if (toolState.activeShape) {
        entitiesToRemove.push(toolState.activeShape);
    }
    if (toolState.groundPolyline) {
        entitiesToRemove.push(toolState.groundPolyline);
    }

    entitiesToRemove.forEach(entity => {
        if (viewer.entities.contains(entity)) {
            viewer.entities.remove(entity);
        }
    });

    // Reset state after removal
    toolState.points = [];
    toolState.labels = [];
    toolState.temporaryMeasureLabel = null;
    toolState.activeShape = null;
    toolState.groundPolyline = null;
    toolState.viewshieldPolylines = [];

    console.log("tools-helpers: All temporary tool entities removed for broader cleanup.");

    if (viewer.scene.requestRenderMode) {
        viewer.scene.requestRender();
    }
}


/**
 * Adds a temporary point entity to the viewer for *current drawing feedback*.
 * These points are cleared by `clearDrawing()`.
 * @param {Cesium.Cartesian3} position - The position of the point.
 */
export function addTemporaryPoint(position) {
    const { viewer, points } = toolState;
    if (!viewer) {
        console.warn("tools-helpers: Viewer not available to add temporary point.");
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
    points.push(point); // Add to our temporary tracking array

    if (viewer.scene.requestRenderMode) {
        viewer.scene.requestRender();
    }
}

/**
 * Adds a temporary persistent label entity to the viewer for *current drawing feedback*.
 * These labels are cleared by `clearDrawing()`.
 * @param {Cesium.Cartesian3} position - The position of the label.
 * @param {string} text - The text content of the label.
 */
export function addTemporaryPersistentLabel(position, text) {
    const { viewer, labels } = toolState;
    if (!viewer) {
        console.warn("tools-helpers: Viewer not available to add temporary persistent label.");
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
    labels.push(label); // Add to our temporary tracking array

    if (viewer.scene.requestRenderMode) {
        viewer.scene.requestRender();
    }
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
        console.warn("tools-helpers: Viewer not available to update temporary label.");
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
        console.log("tools-helpers: Temporary measure label created.");
    } else {
        // If it exists, just update its properties (position and text)
        // This is significantly more efficient than removing and re-adding.
        toolState.temporaryMeasureLabel.position = new Cesium.ConstantPositionProperty(position);
        toolState.temporaryMeasureLabel.label.text = text;
    }

    if (viewer.scene.requestRenderMode) {
        viewer.scene.requestRender();
    }
}

/**
 * A general purpose function to create and add a Cesium Entity to the viewer.
 * This entity is NOT automatically managed by `clearDrawing()`. It's intended
 * for persistent measurements that `ToolManagementService` will handle.
 * @param {Cesium.Entity.ConstructorOptions} entityOptions - The options for the Cesium Entity.
 * @returns {Cesium.Entity} The created and added entity.
 */
export function addPersistentEntity(entityOptions) {
    const { viewer } = toolState;
    if (!viewer) {
        console.warn("tools-helpers: Viewer not available to add persistent entity.");
        return null;
    }
    const entity = viewer.entities.add(entityOptions);
    return entity;
}

/**
 * Adds a persistent label entity to the Cesium viewer, typically for final measurements.
 * This function utilizes `addPersistentEntity` and is exported for other tools to use.
 * This label will NOT be cleared by `clearDrawing()`. Management of these entities
 * after they are added is typically handled by a higher-level service (e.g., history management).
 * @param {Cesium.Cartesian3} position - The position of the label.
 * @param {string} text - The text content of the label.
 * @returns {Cesium.Entity} The created label entity.
*/
export function addPersistentLabel(position, text) {
    const labelEntity = addPersistentEntity({
        position: position,
        label: {
            text: text,
            font: '14pt Poppins', // Consistent font with your temporary labels
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -10),
            disableDepthTestDistance: Number.POSITIVE_INFINITY // Always show on top
        },
    });

    if (toolState.viewer && toolState.viewer.scene.requestRenderMode) {
        toolState.viewer.scene.requestRender();
    }
    return labelEntity;
}