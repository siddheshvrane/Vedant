// ViewshieldAnalysisTool.js
import * as Cesium from "cesium";
import { ToolManagementService } from "../../../../../services/ToolManagementService.js";
import {
    getToolState,
    setToolState,
    clearDrawing,
    removeEventHandlers,
    addTemporaryPoint,
} from "../tool-helpers/tools-helpers.js";
import { PopupService } from "../../../../../services/PopupService.js";

/**
 * Setup tool: This function is now responsible for initiating the viewshed
 * analysis flow by first displaying the parameter configuration popup.
 * Map interaction for observer placement will only be enabled AFTER the user
 * confirms parameters in the popup.
 */
export function setupViewshieldAnalysisTool(viewer, options) {
    console.log("[ViewshieldTool]: setupViewshieldAnalysisTool called with viewer and options:", viewer, options);

    // Clear any previous drawings or handlers from a prior tool activation
    clearDrawing();
    removeEventHandlers(); // Ensure handler is clean before new setup
    setToolState({ drawingPoints: [], mousePosition: null }); // Reset tool state

    // Initial values for the viewshed parameters. These will populate the form.
    const initialViewshedOptions = {
        observerHeight: options.observerHeight || 1.75, // Default to 1.75m if not provided
        viewDistance: options.viewDistance || 5000,     // Default to 5000m if not provided
        rayCount: options.rayCount || 64,               // Default to 64 rays if not provided
    };

    // Show the viewshed parameters form as a popup
    PopupService.showViewshedForm({
        viewshedOptions: initialViewshedOptions,
        onStart: (params) => {
            // This callback is executed when the user clicks "Start Analysis" in the popup
            console.log("[ViewshieldTool]: Viewshed parameters confirmed:", params);
            // Now that parameters are set, enable map interaction for observer placement
            enableObserverPlacement(viewer, params);
        },
        onCancel: () => {
            // This callback is executed if the user clicks "Cancel" in the popup
            console.log("[ViewshieldTool]: Viewshed analysis setup canceled by user.");
            // Deactivate the tool if setup is canceled
            ToolManagementService.deactivateCurrentTool();
            PopupService.hide(); // Ensure popup is hidden
            clearDrawing(); // Clean up any temporary points if they were added somehow
        }
    });
}

/**
 * Enables map click listener to place the observer point for viewshed analysis.
 * This function is called AFTER the user confirms viewshed parameters in the popup.
 */
function enableObserverPlacement(viewer, viewshedParameters) {
    console.log("[ViewshieldTool]: Enabling observer placement on map with parameters:", viewshedParameters);

    // Display instruction to the user
    PopupService.showToolInstruction(
        "Click on terrain to place the observer point. The analysis will use the confirmed parameters.",
        "Viewshed Tool"
    );

    // Retrieve or create the ScreenSpaceEventHandler.
    let { handler } = getToolState();
    if (!handler) {
        handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
        setToolState({ handler: handler });
        console.log("[ViewshieldTool]: Created new ScreenSpaceEventHandler for observer placement.");
    } else {
        // Clear any existing actions on the handler to prevent conflicts
        handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
        handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
        handler.removeInputAction(Cesium.ScreenSpaceEventType.RIGHT_CLICK);
        console.log("[ViewshieldTool]: Reusing existing ScreenSpaceEventHandler and clearing previous actions for observer placement.");
    }

    // Set up the LEFT_CLICK action to place the observer
    handler.setInputAction(async (event) => {
        console.log("[ViewshieldTool]: Click event received for observer placement.");
        const position = viewer.scene.pickPosition(event.position);

        if (!Cesium.defined(position)) {
            console.warn("[ViewshieldTool]: Invalid terrain click - position undefined. Ensure click is on loaded terrain.");
            PopupService.showToolInstruction(
                "Invalid click: No terrain found at this location. Please click on loaded terrain.",
                "Viewshed Tool Error",
                true
            );
            return;
        }

        console.log("[ViewshieldTool]: Clicked position (Cartesian3):", position);

        const observerCarto = Cesium.Cartographic.fromCartesian(position);
        const observerLon = Cesium.Math.toDegrees(observerCarto.longitude);
        const observerLat = Cesium.Math.toDegrees(observerCarto.latitude);
        // Use observerHeight from viewshedParameters
        const observerHeightAbs = observerCarto.height + viewshedParameters.observerHeight;

        console.log(`[ViewshieldTool]: Observer calculated at Lon: ${observerLon.toFixed(4)}, Lat: ${observerLat.toFixed(4)}, Abs Height: ${observerHeightAbs.toFixed(2)}m (Terrain Height: ${observerCarto.height.toFixed(2)}m, Observer Offset: ${viewshedParameters.observerHeight}m)`);

        // Remove event handlers to prevent further clicks for this tool instance
        removeEventHandlers();
        PopupService.hide(); // Hide the instruction popup

        // Convert the absolute observer position back to Cartesian3 for the permanent entity
        const observerPos = Cesium.Cartesian3.fromDegrees(
            observerLon,
            observerLat,
            observerHeightAbs
        );
        // Add a temporary point entity to visualize the observer's location while rays are drawn
        addTemporaryPoint(observerPos);

        console.log("[ViewshieldTool]: Observer point added. Starting viewshed calculation.");

        PopupService.showToolInstruction(
            'Calculating viewshed...',
            'Processing Viewshed Analysis'
        );

        // Call createLineOfSightVisualization to get the polygon definition
        // This function will also draw the temporary red/green rays directly
        const viewshedPolygonDefinition = await createLineOfSightVisualization(
            viewer,
            observerLon,
            observerLat,
            observerHeightAbs,
            viewshedParameters.rayCount,
            viewshedParameters.viewDistance
        );
        console.log("[ViewshieldTool]: Line of sight visualization calculation completed.");

        // Clear temporary drawings (the observer point and the red/green rays)
        clearDrawing();
        PopupService.hide(); // Hide processing popup

        if (viewshedPolygonDefinition) {
            // Prepare the definitions for persistent entities
            const persistentEntitiesDefinitions = {
                polygon: viewshedPolygonDefinition, // This is already just the polygon definition
                points: [{ // Add the observer point as a persistent entity
                    position: observerPos,
                    point: {
                        pixelSize: 8,
                        color: Cesium.Color.BLUE,
                        outlineColor: Cesium.Color.WHITE,
                        outlineWidth: 2,
                        disableDepthTestDistance: Number.POSITIVE_INFINITY // Always visible
                    },
                }],
                labels: [{ // Add a label for the observer point
                    position: observerPos,
                    label: {
                        text: `Observer\n${viewshedParameters.observerHeight.toFixed(1)}m H, ${viewshedParameters.viewDistance}m R`, // This label on the map will still show some details for clarity
                        font: '14pt Poppins',
                        fillColor: Cesium.Color.WHITE,
                        outlineColor: Cesium.Color.BLACK,
                        outlineWidth: 2,
                        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                        pixelOffset: new Cesium.Cartesian2(0, -15),
                        disableDepthTestDistance: Number.POSITIVE_INFINITY,
                    }
                }]
            };

            // Now, add the measurement to the ToolManagementService
            // The summary is now just the generic "Viewshed Analysis" title
            ToolManagementService.addMeasurement(
                "Viewshed Analysis", // Tool Name
                "Viewshed Analysis", // Simplified Summary for the history entry
                persistentEntitiesDefinitions // The definitions for the service to add
            );

            console.log("[ViewshieldTool]: Viewshed measurement added to history with simplified title.");
            PopupService.showToolInstruction(
                "Viewshed analysis completed and added to history.",
                "Analysis Complete",
                false, // Not an error
                5000 // Show for 5 seconds
            );

        } else {
            console.warn("[ViewshieldTool]: No viewshed polygon generated, not adding to history.");
            PopupService.showToolInstruction(
                "Viewshed analysis could not generate a visible area. Not added to history.",
                "Analysis Incomplete",
                true, // Is error
                7000 // Show for 7 seconds
            );
        }

        // Deactivate the current tool after the analysis is complete
        ToolManagementService.deactivateCurrentTool();
        console.log("[ViewshieldTool]: Tool deactivated.");

        // Request a final render to ensure all newly added persistent entities are visible
        if (viewer.scene.requestRenderMode) {
            viewer.scene.requestRender();
            console.log("[ViewshieldTool]: Final render requested.");
        }

    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
}


/**
 * Create radial viewshed rays with visibility.
 * This function generates rays from the observer point and determines visibility,
 * then returns a polygon definition representing the visible area.
 * It also draws temporary red/green lines.
 * @returns {object|null} A Cesium polygon entity definition or null if not enough points.
 */
async function createLineOfSightVisualization(
    viewer,
    lon,
    lat,
    height,
    rayCount,
    maxDistance
) {
    console.log(`[createLineOfSightVisualization]: Starting for ${rayCount} rays, maxDistance: ${maxDistance}m.`);
    const polygonPoints = []; // Array to store the visible endpoints of the rays

    // Loop to cast rays in a full circle around the observer
    for (let i = 0; i < rayCount; i++) {
        const angle = (i * 360) / rayCount; // Calculate the angle for the current ray
        const heading = Cesium.Math.toRadians(angle); // Convert angle to radians for Cesium functions

        // Create a single visibility ray and get its visible endpoint (if any)
        const endpoint = await createVisibilityRay(
            viewer,
            lon,
            lat,
            height,
            heading,
            maxDistance
        );

        // If a visible endpoint was found, add it to the polygon points
        if (endpoint) {
            polygonPoints.push(endpoint);
            // console.log(`[createLineOfSightVisualization]: Ray ${i} endpoint found. Total valid polygon points: ${polygonPoints.length}`);
        } else {
            // console.log(`[createLineOfSightVisualization]: Ray ${i} did not find a visible endpoint.`);
        }

        // Yield control periodically to prevent UI freezes during heavy computation
        if (i % 10 === 0) {
            await new Promise((r) => setTimeout(r, 5));
        }
    }

    console.log(`[createLineOfSightVisualization]: Finished casting rays. Found ${polygonPoints.length} points for polygon.`);

    // If enough points are collected, return the polygon definition
    if (polygonPoints.length >= 3) {
        // Sort points to ensure a convex polygon (approximation for viewshed)
        // This is a common heuristic for radial point sets, though a more robust
        // algorithm might be needed for complex visibility regions.
        const center = Cesium.Cartesian3.fromDegrees(lon, lat, height);
        polygonPoints.sort((a, b) => {
            const angleA = Math.atan2(a.y - center.y, a.x - center.x);
            const angleB = Math.atan2(b.y - center.y, b.x - center.x);
            return angleA - angleB;
        });

        // Return the polygon definition, don't add directly to viewer here
        return {
            hierarchy: new Cesium.PolygonHierarchy(polygonPoints),
            material: Cesium.Color.LIME.withAlpha(0.8),
            perPositionHeight: true, // Important for the polygon to follow terrain height
        };
    } else {
        return null; // Return null if not enough points to form a polygon
    }
    // No direct viewer.scene.requestRender() here; ToolManagementService will handle after adding.
}

/**
 * Cast one ray with visibility sampling and colored segments.
 * This function iterates along a single ray, sampling terrain height and determining
 * visibility for each segment. It draws red/green polylines as *temporary* entities.
 */
async function createVisibilityRay(
    viewer,
    lon,
    lat,
    observerHeight,
    heading,
    maxDistance
) {
    const step = 100; // Distance step for sampling along the ray
    const steps = Math.floor(maxDistance / step); // Number of steps
    const observer = Cesium.Cartesian3.fromDegrees(lon, lat, observerHeight); // Observer's Cartesian position

    let lastPos = observer; // Tracks the start point of the current polyline segment
    let lastGood = null;    // Stores the last visible point along the ray

    let maxElevationAngle = -Infinity; // Tracks the maximum elevation angle encountered so far

    // console.log(`[createVisibilityRay]: Starting ray for heading ${Cesium.Math.toDegrees(heading).toFixed(2)} degrees.`);

    // Iterate through each step along the ray
    for (let i = 1; i <= steps; i++) {
        const dist = i * step; // Current distance from the observer
        // Calculate the geographic position at the current distance and heading
        const pos = calculatePositionAtDistance(lon, lat, heading, dist);
        // Get the terrain height at this geographic position
        const terrainHeight = await getTerrainHeight(
            viewer,
            pos.longitude,
            pos.latitude
        );

        // Convert the geographic position with terrain height to Cartesian
        const actual = Cesium.Cartesian3.fromDegrees(
            pos.longitude,
            pos.latitude,
            terrainHeight
        );

        // Compute elevation angle from observer to this point
        const elevationAngle = Math.atan2(terrainHeight - observerHeight, dist);

        // Determine visibility: if the current point's elevation angle is greater
        // than the maximum encountered so far, it's visible.
        const isVisible = elevationAngle > maxElevationAngle;

        if (isVisible) {
            maxElevationAngle = elevationAngle; // Update max elevation angle
            lastGood = actual; // This point is visible, so it's a potential endpoint for the polygon
        }

        // Set the color of the polyline segment based on visibility
        const color = isVisible ? Cesium.Color.GREEN : Cesium.Color.RED;

        // Add a polyline segment to the viewer as a TEMPORARY entity
        // These will be cleared by clearDrawing() later
        viewer.entities.add({
            polyline: {
                positions: [lastPos, actual], // Segment from last point to current point
                width: 3,
                material: color,
                clampToGround: false,
            },
        });

        lastPos = actual; // Update lastPos for the next segment
    }
    // console.log(`[createVisibilityRay]: Ray finished. lastGood: ${lastGood ? 'Found' : 'None'}`);
    return lastGood; // Return the last visible point for the polygon
}

/**
 * Compute destination coordinates given heading & distance from a starting point.
 * Uses spherical trigonometry.
 */
function calculatePositionAtDistance(lon, lat, heading, distance) {
    const R = 6371000; // Earth's radius in meters
    const radLon = Cesium.Math.toRadians(lon); // Convert longitude to radians
    const radLat = Cesium.Math.toRadians(lat); // Convert latitude to radians
    const angularDistance = distance / R; // Angular distance on the sphere

    // Calculate new latitude using spherical trigonometry
    const newLat = Math.asin(
        Math.sin(radLat) * Math.cos(angularDistance) +
        Math.cos(radLat) * Math.sin(angularDistance) * Math.cos(heading)
    );

    // Calculate new longitude using spherical trigonometry
    const newLon =
        radLon +
        Math.atan2(
            Math.sin(heading) * Math.sin(angularDistance) * Math.cos(radLat),
            Math.cos(angularDistance) - Math.sin(radLat) * Math.sin(newLat)
        );

    // Return the new position in degrees
    return {
        latitude: Cesium.Math.toDegrees(newLat),
        longitude: Cesium.Math.toDegrees(newLon),
    };
}

/**
 * Sample terrain height using Cesium API with fallback.
 * Prioritizes `sampleTerrainMostDetailed` if a terrain provider is available,
 * otherwise falls back to `globe.getHeight`.
 */
async function getTerrainHeight(viewer, lon, lat) {
    try {
        const positions = [Cesium.Cartographic.fromDegrees(lon, lat)];

        // Check if terrainProvider exists and has availability before sampling
        if (viewer.terrainProvider && viewer.terrainProvider.availability) {
            const updated = await Cesium.sampleTerrainMostDetailed(
                viewer.terrainProvider,
                positions
            );
            // console.log(`[getTerrainHeight]: Sampled terrain at (${lon.toFixed(4)}, ${lat.toFixed(4)}) height: ${updated[0].height.toFixed(2)}m`);
            return updated[0].height || 0; // Return sampled height or 0 if undefined
        }

        // Fallback if no terrain provider or availability is false
        const height = viewer.scene.globe.getHeight(positions[0]);
        // console.log(`[getTerrainHeight]: Globe height at (${lon.toFixed(4)}, ${lat.toFixed(4)}) height: ${height ? height.toFixed(2) : 0}m (Fallback)`);
        return height || 0; // Return globe height or 0 if undefined
    } catch (err) {
        console.warn("[getTerrainHeight]: Terrain sampling failed, using 0:", err);
        return 0; // Return 0 on error
    }
}

/**
 * Clears all temporary drawings and event handlers associated with the Viewshed tool.
 */
export function clearViewshield() {
    clearDrawing(); // Clears temporary entities added by addTemporaryPoint and polyline segments
    removeEventHandlers(); // Removes the ScreenSpaceEventHandler's actions
    PopupService.hide(); // Hides any active tool instruction popups
    console.log("[ViewshieldTool]: clearViewshield called. Temporary entities and handlers cleared.");
}