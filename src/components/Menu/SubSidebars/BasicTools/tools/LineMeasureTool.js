import * as Cesium from 'cesium';
import {
    clearDrawing,
    removeEventHandlers,
    addTemporaryPoint,
    addTemporaryPersistentLabel, // Use the renamed function for temporary labels
    updateTemporaryLabel,
    formatDistance,
    getToolState,
    setToolState,
    throttle,
    addPersistentEntity, // NEW: Import addPersistentEntity
} from '../tool-helpers/tools-helpers.js'; // <--- CORRECTED PATH! Adjust if 'utils' is not in your path.
import { PopupService } from '../../../../../services/PopupService.js';
import { ToolManagementService } from '../../../../../services/ToolManagementService.js'; // Import ToolManagementService

// Import the Web Worker. The '?worker' suffix is a bundler-specific feature (e.g., Vite, Webpack 5)
// that tells the bundler to process this file as a Web Worker.
import TerrainSamplerWorker from '../workers/terrain-sampler-worker.js?worker';

/**
 * Sets up the Line Measure tool for either 2D displacement or 3D terrain-following measurement.
 * @param {boolean} isDisplacement - True for 2D Cartesian distance (straight line in 3D space), false for 3D surface distance (clamped to ground).
 * @param {boolean} clampShapeToGround - True to clamp the rubber-banding shape to the terrain, false for 3D space.
 */
export function setupLineMeasureTool(isDisplacement, clampShapeToGround) {
    clearDrawing(); // Clear any previous temporary drawing entities
    removeEventHandlers(); // Remove any previous event handlers

    const { handler, viewer } = getToolState();
    setToolState({
        drawingPoints: [],
        activeShape: null,
        temporaryMeasureLabel: null,
        mousePosition: null,
        labels: [], // Ensure temporary labels are reset
        points: [] // Ensure temporary points are reset
    });

    const toolName = isDisplacement ? "Line Measure" : "3D Line Measure"; // Use the actual tool names
    PopupService.showToolInstruction(
        `Left-click to add points. Right-click to finish.`,
        toolName
    );
    console.log("LineMeasureTool: Initial instruction popup shown.");


    // --- LEFT_CLICK Handler ---
    handler.setInputAction((click) => {
        let cartesian;
        // For clicked points, always try to get the most accurate position.
        if (clampShapeToGround) {
            const ray = viewer.camera.getPickRay(click.position);
            cartesian = viewer.scene.globe.pick(ray, viewer.scene);
        } else {
            cartesian = viewer.scene.pickPosition(click.position);
            if (!Cesium.defined(cartesian)) {
                cartesian = viewer.camera.pickEllipsoid(click.position, viewer.scene.globe.ellipsoid);
            }
        }

        if (Cesium.defined(cartesian)) {
            const { drawingPoints } = getToolState();
            drawingPoints.push(cartesian);
            setToolState({ drawingPoints: drawingPoints });

            addTemporaryPoint(cartesian); // Add a temporary visual point

            if (drawingPoints.length === 1) {
                // Create the activeShape (rubber-banding polyline)
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
                        width: 3,
                        material: Cesium.Color.RED,
                        clampToGround: clampShapeToGround,
                    }
                });
                setToolState({ activeShape: activeShape });
            } else {
                // Update segment label for the new *clicked* segment
                const lastTwoPoints = [drawingPoints[drawingPoints.length - 2], drawingPoints[drawingPoints.length - 1]];
                updateLineMeasureSegment(isDisplacement, lastTwoPoints); // This adds a TEMPORARY persistent label
            }

            if (viewer.scene.requestRenderMode) {
                viewer.scene.requestRender();
            }
        } else {
            console.warn("LineMeasureTool: Could not pick a valid position on LEFT_CLICK.");
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // --- MOUSE_MOVE Handler ---
    const throttledMouseMoveHandler = throttle((move) => {
        const { drawingPoints, viewer } = getToolState();
        if (drawingPoints.length > 0) {
            let cartesian;

            // Prefer pickPosition for mouse move in 3D to stay on geometry/terrain
            cartesian = viewer.scene.pickPosition(move.endPosition);

            if (!Cesium.defined(cartesian)) {
                // Fallback to ellipsoid if pickPosition fails (e.g., picking against sky)
                cartesian = viewer.camera.pickEllipsoid(move.endPosition, viewer.scene.globe.ellipsoid);
            }

            if (Cesium.defined(cartesian)) {
                setToolState({ mousePosition: cartesian });
                const tempPointsForLabel = [...drawingPoints];
                tempPointsForLabel.push(cartesian);
                updateTemporaryLineMeasure(isDisplacement, tempPointsForLabel);

                if (viewer.scene.requestRenderMode) {
                    viewer.scene.requestRender();
                }
            } else {
                setToolState({ mousePosition: null });
                updateTemporaryLabel(null, ''); // Clear temporary label if mouse leaves globe
                if (viewer.scene.requestRenderMode) {
                    viewer.scene.requestRender();
                }
            }
        }
    }, 75);

    handler.setInputAction(throttledMouseMoveHandler, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    // --- RIGHT_CLICK Handler (Finalize) ---
    handler.setInputAction(async () => {
        removeEventHandlers();

        const { drawingPoints, temporaryMeasureLabel, activeShape, points: temporaryPoints, labels: temporaryLabels, viewer } = getToolState();

        PopupService.hide(); // Hide current instruction before showing processing
        console.log("LineMeasureTool: Initial instruction popup hidden.");

        if (drawingPoints.length < 2) {
            console.warn("LineMeasureTool: Right-click received before enough points. Clearing drawing.");
            clearDrawing(); // Clear all temporary entities
            ToolManagementService.deactivateCurrentTool(); // Deactivate the tool
            PopupService.showToolInstruction(
                `Minimum 2 points are required to measure a line.`,
                `Line Measurement Error`,
                true // Show dismiss button
            );
            return;
        }

        setToolState({ mousePosition: null });
        if (Cesium.defined(temporaryMeasureLabel)) {
            viewer.entities.remove(temporaryMeasureLabel);
            setToolState({ temporaryMeasureLabel: null });
        }

        // Remove temporary points and labels that were part of the drawing feedback
        temporaryPoints.forEach(entity => viewer.entities.remove(entity));
        temporaryLabels.forEach(entity => viewer.entities.remove(entity));
        setToolState({ points: [], labels: [] });

        // Show a "Calculating..." popup while terrain sampling happens in the worker
        PopupService.showToolInstruction(
            'Calculating accurate terrain data...',
            'Processing Line Measurement',
            false // No dismiss button for a processing popup
        );
        console.log("LineMeasureTool: Processing popup shown.");

        try {
            const { sampledPositions, totalDistance } = await finalizeLineMeasure(isDisplacement, drawingPoints);
            console.log("LineMeasureTool: finalizeLineMeasure resolved successfully.");

            // Create the final persistent entities
            const persistentEntities = {};

            // 1. Create the persistent polyline
            const persistentPolyline = addPersistentEntity({
                polyline: {
                    positions: sampledPositions, // Use sampled positions
                    width: 3,
                    material: Cesium.Color.CYAN, // Final color
                    clampToGround: clampShapeToGround, // Ensure final shape respects clamping
                },
            });
            persistentEntities.polyline = persistentPolyline;

            // 2. Create persistent points at the original clicked locations (optional, but good for history)
            const persistentPoints = [];
            drawingPoints.forEach(pos => { // Use original drawingPoints for points
                const point = addPersistentEntity({
                    position: pos,
                    point: {
                        pixelSize: 8,
                        color: Cesium.Color.BLUE, // Final color for points
                        outlineColor: Cesium.Color.WHITE,
                        outlineWidth: 2,
                        disableDepthTestDistance: Number.POSITIVE_INFINITY,
                    },
                });
                persistentPoints.push(point);
            });
            persistentEntities.points = persistentPoints; // Store as an array

            // 3. Create persistent labels for segments and total distance
            const persistentLabels = [];
            if (!isDisplacement && sampledPositions.length > 1) { // Only add segment labels for terrain mode
                for (let i = 0; i < sampledPositions.length - 1; i++) {
                    const p1 = sampledPositions[i];
                    const p2 = sampledPositions[i + 1];
                    const segmentMidpoint = Cesium.Cartesian3.midpoint(p1, p2, new Cesium.Cartesian3());
                    const carto1 = viewer.scene.globe.ellipsoid.cartesianToCartographic(p1);
                    const carto2 = viewer.scene.globe.ellipsoid.cartesianToCartographic(p2);
                    const geodesic = new Cesium.EllipsoidGeodesic(carto1, carto2);
                    const segmentDistance = geodesic.surfaceDistance;

                    const label = addPersistentEntity({
                        position: segmentMidpoint,
                        label: {
                            text: formatDistance(segmentDistance),
                            font: '14pt Poppins',
                            fillColor: Cesium.Color.WHITE,
                            outlineColor: Cesium.Color.BLACK,
                            outlineWidth: 2,
                            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                            pixelOffset: new Cesium.Cartesian2(0, -10),
                            disableDepthTestDistance: Number.POSITIVE_INFINITY,
                        },
                    });
                    persistentLabels.push(label);
                }
            }

            // Add total distance label
            const lastPoint = sampledPositions[sampledPositions.length - 1] || drawingPoints[drawingPoints.length - 1]; // Fallback if sampling somehow returns empty
            if (lastPoint) {
                // Adjust label position slightly above the last point
                const labelOffset = new Cesium.Cartesian3(0, 0, 50); // 50 meters above
                const labelPosition = Cesium.Cartesian3.add(lastPoint, labelOffset, new Cesium.Cartesian3());
                const totalLabel = addPersistentEntity({
                    position: labelPosition,
                    label: {
                        text: `Total: ${formatDistance(totalDistance)}`,
                        font: '14pt Poppins',
                        fillColor: Cesium.Color.WHITE,
                        outlineColor: Cesium.Color.BLACK,
                        outlineWidth: 2,
                        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                        pixelOffset: new Cesium.Cartesian2(0, -10),
                        disableDepthTestDistance: Number.POSITIVE_INFINITY,
                    },
                });
                persistentLabels.push(totalLabel);
            }
            persistentEntities.labels = persistentLabels; // Store as an array

            // Now, pass all persistent entities to ToolManagementService
            ToolManagementService.addMeasurement(
                toolName, // "Line Measure" or "3D Line Measure"
                `Total: ${formatDistance(totalDistance)}`, // Value to display in history
                persistentEntities // The collection of created entities
            );

            // Clear the activeShape from the viewer as it's replaced by persistentPolyline
            if (Cesium.defined(activeShape)) {
                viewer.entities.remove(activeShape);
                setToolState({ activeShape: null });
            }

            console.log(`Line Measure Tool: Measurement finalized. Total distance: ${formatDistance(totalDistance)}`);

        } catch (error) {
            console.error("LineMeasureTool: Error during finalization:", error);
            // Show a generic error message with a dismiss button if finalizeLineMeasure rejects
            PopupService.showToolInstruction(
                `An error occurred during measurement: ${error.message || 'Unknown error'}.`,
                `Measurement Error`,
                true // Show dismiss button
            );
            clearDrawing(); // Clean up any lingering temporary entities on error
        } finally {
            // ALWAYS hide the processing popup, regardless of success or error
            PopupService.hide();
            ToolManagementService.deactivateCurrentTool(); // Deactivate the tool
        }

        if (viewer.scene.requestRenderMode) {
            viewer.scene.requestRender();
        }

    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
}

/**
 * Calculates and adds a temporary persistent label for a line segment.
 * If clampToGround is true and not isDisplacement, this will use geodesic surface distance.
 * @param {boolean} isDisplacement - Whether to calculate 2D Cartesian distance or 3D surface distance.
 * @param {Array<Cesium.Cartesian3>} segmentPoints - An array of two Cartesian3 points [start, end].
 */
function updateLineMeasureSegment(isDisplacement, segmentPoints) {
    const { viewer } = getToolState();
    if (segmentPoints.length < 2 || !Cesium.defined(segmentPoints[0]) || !Cesium.defined(segmentPoints[1])) {
        return;
    }

    let segmentDistance;
    const lastPosition = segmentPoints[0];
    const currentPosition = segmentPoints[1];

    if (isDisplacement) {
        segmentDistance = Cesium.Cartesian3.distance(lastPosition, currentPosition);
    } else {
        const carto1 = viewer.scene.globe.ellipsoid.cartesianToCartographic(lastPosition);
        const carto2 = viewer.scene.globe.ellipsoid.cartesianToCartographic(currentPosition);
        const geodesic = new Cesium.EllipsoidGeodesic(carto1, carto2);
        segmentDistance = geodesic.surfaceDistance;
    }
    const midPoint = Cesium.Cartesian3.midpoint(lastPosition, currentPosition, new Cesium.Cartesian3());
    addTemporaryPersistentLabel(midPoint, formatDistance(segmentDistance)); // Use the temporary label function
}

/**
 * Updates the temporary label shown during line drawing on mouse move.
 * Uses the (potentially approximate) mouse position.
 * @param {boolean} isDisplacement - Whether to calculate 2D Cartesian distance or 3D surface distance.
 * @param {Array<Cesium.Cartesian3>} allPointsIncludingMouse - All clicked points + current mouse position.
 */
function updateTemporaryLineMeasure(isDisplacement, allPointsIncludingMouse) {
    const { viewer } = getToolState();
    if (allPointsIncludingMouse.length < 2 || !Cesium.defined(allPointsIncludingMouse[allPointsIncludingMouse.length - 2]) || !Cesium.defined(allPointsIncludingMouse[allPointsIncludingMouse.length - 1])) {
        updateTemporaryLabel(null, '');
        return;
    }

    const lastPosition = allPointsIncludingMouse[allPointsIncludingMouse.length - 2];
    const currentPosition = allPointsIncludingMouse[allPointsIncludingMouse.length - 1]; // This is the mouse position

    let segmentDistance;
    if (isDisplacement) {
        segmentDistance = Cesium.Cartesian3.distance(lastPosition, currentPosition);
    } else {
        const carto1 = viewer.scene.globe.ellipsoid.cartesianToCartographic(lastPosition);
        const carto2 = viewer.scene.globe.ellipsoid.cartesianToCartographic(currentPosition);
        const geodesic = new Cesium.EllipsoidGeodesic(carto1, carto2);
        segmentDistance = geodesic.surfaceDistance;
    }

    const midPoint = Cesium.Cartesian3.midpoint(lastPosition, currentPosition, new Cesium.Cartesian3());
    updateTemporaryLabel(midPoint, formatDistance(segmentDistance));
}

/**
 * Finalizes the line measure, calculates total distance, and adds persistent labels.
 * This function will now perform accurate terrain sampling for '3D Terrain Line' using a Web Worker.
 * @param {boolean} isDisplacement - Whether to calculate 2D Cartesian distance or 3D surface distance.
 * @param {Array<Cesium.Cartesian3>} points - All the clicked points for the line (from LEFT_CLICK).
 * @returns {Promise<{sampledPositions: Array<Cesium.Cartesian3>, totalDistance: number}>} A promise that resolves with the final sampled points and total distance.
 */
async function finalizeLineMeasure(isDisplacement, points) {
    const { viewer } = getToolState();

    if (points.length < 2) {
        // This case is largely handled by the RIGHT_CLICK handler before calling this function,
        // but included for robustness if this function is called directly.
        // It returns a resolved promise with zero distance to not block the caller.
        return Promise.resolve({ sampledPositions: [], totalDistance: 0 });
    }

    let finalPoints = [];
    let totalDistance = 0;

    // If it's a terrain line, sample the terrain for accurate height using a Web Worker.
    if (!isDisplacement && Cesium.defined(viewer.terrainProvider) && viewer.terrainProvider.ready) {
        const cartographicPoints = points.map(p => viewer.scene.globe.ellipsoid.cartesianToCartographic(p));
        // Ensure terrainProviderUrl is correctly retrieved or passed
        const terrainProviderUrl = viewer.terrainProvider.url || (viewer.terrainProvider.constructor.name === 'CesiumIonWorldTerrainProvider' ? 'https://assets.ion.cesium.com/' : null); // Fallback for Ion World Terrain if .url is not directly available

        if (!terrainProviderUrl) {
            console.warn("LineMeasureTool: Terrain provider URL could not be determined. Falling back to ellipsoid calculation.");
            // Fallback immediately if URL is not available for worker
            finalPoints.push(...points);
            for (let i = 0; i < finalPoints.length - 1; i++) {
                const p1 = finalPoints[i];
                const p2 = finalPoints[i + 1];
                const carto1 = viewer.scene.globe.ellipsoid.cartesianToCartographic(p1);
                const carto2 = viewer.scene.globe.ellipsoid.cartesianToCartographic(p2);
                const geodesic = new Cesium.EllipsoidGeodesic(carto1, carto2);
                totalDistance += geodesic.surfaceDistance;
            }
            PopupService.showToolInstruction(
                `Terrain data source URL not found. Falling back to ellipsoid calculation.`,
                `Terrain Warning`,
                true
            );
            return { sampledPositions: finalPoints, totalDistance: totalDistance };
        }


        return new Promise((resolve, reject) => {
            const worker = new TerrainSamplerWorker();
            const timeoutDuration = 30000; // 30 seconds timeout for worker response
            let timeoutId = null;

            // Set a timeout for the worker response
            timeoutId = setTimeout(() => {
                worker.terminate();
                console.error("LineMeasureTool: Web Worker terrain sampling timed out.");
                reject(new Error("Terrain calculation timed out. Please check your internet connection or terrain service.")); // Reject the promise
            }, timeoutDuration);

            worker.postMessage({
                type: 'sampleTerrain',
                cartographicPoints: cartographicPoints,
                terrainProviderUrl: terrainProviderUrl // Pass URL to worker
            });

            worker.onmessage = (e) => {
                clearTimeout(timeoutId); // Clear the timeout if message is received
                worker.terminate();

                if (e.data.type === 'sampledResult') {
                    finalPoints = e.data.sampledPoints;
                    // Calculate total distance using sampled points
                    for (let i = 0; i < finalPoints.length - 1; i++) {
                        const p1 = finalPoints[i];
                        const p2 = finalPoints[i + 1];
                        const carto1 = viewer.scene.globe.ellipsoid.cartesianToCartographic(p1);
                        const carto2 = viewer.scene.globe.ellipsoid.cartesianToCartographic(p2);
                        const geodesic = new Cesium.EllipsoidGeodesic(carto1, carto2);
                        totalDistance += geodesic.surfaceDistance;
                    }
                    resolve({ sampledPositions: finalPoints, totalDistance: totalDistance });

                } else if (e.data.type === 'error') {
                    console.error("LineMeasureTool: Web Worker error during terrain sampling:", e.data.message);
                    // Fallback to original points if terrain sampling fails and resolve
                    finalPoints.push(...points);
                    // Proceed with calculations using original points (ellipsoid)
                    for (let i = 0; i < finalPoints.length - 1; i++) {
                        const p1 = finalPoints[i];
                        const p2 = finalPoints[i + 1];
                        const carto1 = viewer.scene.globe.ellipsoid.cartesianToCartographic(p1);
                        const carto2 = viewer.scene.globe.ellipsoid.cartesianToCartographic(p2);
                        const geodesic = new Cesium.EllipsoidGeodesic(carto1, carto2);
                        totalDistance += geodesic.surfaceDistance;
                    }
                    PopupService.showToolInstruction(
                        `Error calculating terrain data: ${e.data.message}. Falling back to ellipsoid calculation.`,
                        `Terrain Error`,
                        true // Show dismiss button for this specific error
                    );
                    resolve({ sampledPositions: finalPoints, totalDistance: totalDistance });
                }
            };

            worker.onerror = (error) => {
                clearTimeout(timeoutId); // Clear the timeout on any worker error
                worker.terminate();
                console.error("LineMeasureTool: Web Worker unhandled error:", error);
                // Reject the promise if there's an unhandled worker error
                reject(new Error(`Worker encountered an unhandled error: ${error.message || 'Check console for details.'}`));
            };
        });
    } else {
        // For displacement or if no terrain is available/ready, no sampling needed.
        finalPoints.push(...points);

        for (let i = 0; i < finalPoints.length - 1; i++) {
            const p1 = finalPoints[i];
            const p2 = finalPoints[i + 1];
            let segmentDistance;

            if (isDisplacement) {
                segmentDistance = Cesium.Cartesian3.distance(p1, p2);
            } else {
                // This branch is hit if !isDisplacement AND terrainProvider is not ready/defined.
                // It means we're doing a "3D Line Measure" but without actual terrain sampling.
                const carto1 = viewer.scene.globe.ellipsoid.cartesianToCartographic(p1);
                const carto2 = viewer.scene.globe.ellipsoid.cartesianToCartographic(p2);
                const geodesic = new Cesium.EllipsoidGeodesic(carto1, carto2);
                segmentDistance = geodesic.surfaceDistance;
            }
            totalDistance += segmentDistance;
        }
        console.log(`LineMeasureTool: Finalized total distance (no terrain sampling): ${formatDistance(totalDistance)}`);
        return { sampledPositions: finalPoints, totalDistance: totalDistance };
    }
}