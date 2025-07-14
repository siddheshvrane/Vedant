import * as Cesium from 'cesium';
import {
    clearDrawing,
    removeEventHandlers,
    addTemporaryPoint,
    addPersistentLabel,
    updateTemporaryLabel,
    formatDistance,
    getToolState,
    setToolState,
    throttle
} from '../tool-helpers/tools-helpers.js';
import { PopupService } from '../../../../../services/PopupService.js';

// Import the Web Worker. The '?worker' suffix is a bundler-specific feature (e.g., Vite, Webpack 5)
// that tells the bundler to process this file as a Web Worker.
// Adjust the path based on your project structure.
import TerrainSamplerWorker from '../workers/terrain-sampler-worker.js?worker';

/**
 * Sets up the Line Measure tool for either 2D displacement or 3D terrain-following measurement.
 * @param {boolean} isDisplacement - True for 2D Cartesian distance (straight line in 3D space), false for 3D surface distance (clamped to ground).
 * @param {boolean} clampShapeToGround - True to clamp the rubber-banding shape to the terrain, false for 3D space.
 */
export function setupLineMeasureTool(isDisplacement, clampShapeToGround) {
    clearDrawing();
    removeEventHandlers();

    const { handler, viewer } = getToolState();
    setToolState({
        drawingPoints: [],
        activeShape: null,
        temporaryMeasureLabel: null,
        mousePosition: null
    });

    const toolName = isDisplacement ? "2D Line Measure" : "3D Line Measure";
    PopupService.showToolInstruction(
        `Left-click to add points. Right-click to finish.`,
        toolName
    );

    // --- LEFT_CLICK Handler ---
    handler.setInputAction((click) => {
        let cartesian;
        // For clicked points, always try to get the most accurate position.
        // For clampToGround, this means globe.pick, otherwise pickPosition.
        if (clampShapeToGround) {
            const ray = viewer.camera.getPickRay(click.position);
            cartesian = viewer.scene.globe.pick(ray, viewer.scene);
        } else {
            // For displacement, prefer picking on actual 3D content or terrain if available.
            cartesian = viewer.scene.pickPosition(click.position);
            if (!Cesium.defined(cartesian)) {
                // Fallback to ellipsoid if no 3D content or terrain is picked.
                cartesian = viewer.camera.pickEllipsoid(click.position, viewer.scene.globe.ellipsoid);
            }
        }

        if (Cesium.defined(cartesian)) {
            const { drawingPoints, viewer } = getToolState();
            drawingPoints.push(cartesian);
            setToolState({ drawingPoints: drawingPoints });

            addTemporaryPoint(cartesian);

            if (drawingPoints.length === 1) {
                // Create the activeShape (rubber-banding polyline)
                const activeShape = viewer.entities.add({
                    polyline: {
                        positions: new Cesium.CallbackProperty(() => {
                            const { drawingPoints, mousePosition } = getToolState();
                            const positions = [...drawingPoints];
                            if (Cesium.defined(mousePosition)) {
                                positions.push(mousePosition);
                            }
                            return positions;
                        }, false),
                        width: 3,
                        material: Cesium.Color.RED,
                        // clampToGround property for the activeShape:
                        // Only clamp the rubber-banding line if clampShapeToGround is true
                        clampToGround: clampShapeToGround
                    }
                });
                setToolState({ activeShape: activeShape });
            } else {
                // Update segment label for the new *clicked* segment
                const lastTwoPoints = [drawingPoints[drawingPoints.length - 2], drawingPoints[drawingPoints.length - 1]];
                updateLineMeasureSegment(isDisplacement, lastTwoPoints);
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

            // Use pickPosition for more accurate mouse following
            // This attempts to pick on 3D content first, then terrain.
            cartesian = viewer.scene.pickPosition(move.endPosition);

            if (!Cesium.defined(cartesian)) {
                // Fallback to ellipsoid if no 3D object/terrain is picked at all
                cartesian = viewer.camera.pickEllipsoid(move.endPosition, viewer.scene.globe.ellipsoid);
            }

            if (Cesium.defined(cartesian)) {
                setToolState({ mousePosition: cartesian });
                const tempPointsForLabel = [...drawingPoints];
                tempPointsForLabel.push(cartesian);
                // Update temporary label based on this (now more accurate) mouse position
                updateTemporaryLineMeasure(isDisplacement, tempPointsForLabel);

                if (viewer.scene.requestRenderMode) {
                    viewer.scene.requestRender();
                }
            } else {
                setToolState({ mousePosition: null });
                updateTemporaryLabel(null, '');
                if (viewer.scene.requestRenderMode) {
                    viewer.scene.requestRender();
                }
            }
        }
    }, 75); // Adjusted throttle to 75ms

    handler.setInputAction(throttledMouseMoveHandler, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    // --- RIGHT_CLICK Handler (Finalize) ---
    handler.setInputAction(async () => {
        removeEventHandlers();

        const { drawingPoints, temporaryMeasureLabel, activeShape, viewer } = getToolState();

        PopupService.hide(); // Hide current instruction

        if (drawingPoints.length < 2) {
            console.warn("LineMeasureTool: Right-click received before enough points. Clearing drawing.");
            clearDrawing();
            return;
        }

        setToolState({ mousePosition: null });
        if (Cesium.defined(temporaryMeasureLabel)) {
            viewer.entities.remove(temporaryMeasureLabel);
            setToolState({ temporaryMeasureLabel: null });
        }

        // Show a "Calculating..." popup while terrain sampling happens in the worker
        PopupService.show('toolInstruction', {
            message: 'Calculating accurate terrain data...',
            title: 'Processing Line Measurement',
            showDismissButton: false
        });

        // Finalize measurement - this is where we do the expensive, accurate terrain sampling
        const finalSampledPoints = await finalizeLineMeasure(isDisplacement, drawingPoints);

        // Hide the "Calculating..." popup
        PopupService.hide();

        if (Cesium.defined(activeShape) && Cesium.defined(activeShape.polyline)) {
            // Update the activeShape to static, accurate positions from the worker
            activeShape.polyline.positions = finalSampledPoints;
            activeShape.polyline.clampToGround = clampShapeToGround; // Ensure final shape respects clamping
        }

        console.log(`Line Measure Tool: Measurement finalized.`);

        if (viewer.scene.requestRenderMode) {
            viewer.scene.requestRender();
        }

    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
}

/**
 * Calculates and adds a persistent label for a line segment.
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
        // For terrain mode, calculate geodesic distance on the ellipsoid surface
        // Note: This is NOT true terrain-following distance, but projected on the ellipsoid.
        // True terrain-following requires sampling, which we do in finalize.
        const carto1 = viewer.scene.globe.ellipsoid.cartesianToCartographic(lastPosition);
        const carto2 = viewer.scene.globe.ellipsoid.cartesianToCartographic(currentPosition);
        const geodesic = new Cesium.EllipsoidGeodesic(carto1, carto2);
        segmentDistance = geodesic.surfaceDistance;
    }
    const midPoint = Cesium.Cartesian3.midpoint(lastPosition, currentPosition, new Cesium.Cartesian3());
    addPersistentLabel(midPoint, formatDistance(segmentDistance));
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
        // For terrain mode temporary display, use geodesic distance on ellipsoid for speed
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
 * @returns {Promise<Array<Cesium.Cartesian3>>} A promise that resolves with the final sampled points.
 */
async function finalizeLineMeasure(isDisplacement, points) {
    const { viewer } = getToolState();

    if (points.length < 2) {
        clearDrawing();
        PopupService.show('toolInstruction', {
            message: `Minimum 2 points are required to measure a line.`,
            title: `Line Measurement Error`,
            showDismissButton: true
        });
        console.warn("LineMeasureTool: finalizeLineMeasure called with insufficient points. Clearing drawing and showing error.");
        return [];
    }

    const { labels } = getToolState();
    labels.forEach(label => viewer.entities.remove(label));
    setToolState({ labels: [] });

    let finalPoints = [];

    // If it's a terrain line, sample the terrain for accurate height using a Web Worker.
    if (!isDisplacement && Cesium.defined(viewer.terrainProvider) && viewer.terrainProvider.ready) {
        const cartographicPoints = points.map(p => viewer.scene.globe.ellipsoid.cartesianToCartographic(p));

        // Get the URL of the terrain provider for the worker
        const terrainProviderUrl = viewer.terrainProvider.url; // Assuming your terrainProvider has a .url property

        return new Promise((resolve, reject) => {
            const worker = new TerrainSamplerWorker();

            worker.postMessage({
                type: 'sampleTerrain',
                cartographicPoints: cartographicPoints,
                terrainProviderUrl: terrainProviderUrl // Pass URL to worker
            });

            worker.onmessage = (e) => {
                if (e.data.type === 'sampledResult') {
                    finalPoints = e.data.sampledPoints;
                    // Calculate and add labels after receiving sampled points
                    let totalDistance = 0;
                    for (let i = 0; i < finalPoints.length - 1; i++) {
                        const lastPosition = finalPoints[i];
                        const currentPosition = finalPoints[i + 1];
                        let segmentDistance;

                        // For terrain, calculate geodesic distance using the sampled points
                        const carto1 = viewer.scene.globe.ellipsoid.cartesianToCartographic(lastPosition);
                        const carto2 = viewer.scene.globe.ellipsoid.cartesianToCartographic(currentPosition);
                        const geodesic = new Cesium.EllipsoidGeodesic(carto1, carto2);
                        segmentDistance = geodesic.surfaceDistance;

                        totalDistance += segmentDistance;

                        const midPoint = Cesium.Cartesian3.midpoint(lastPosition, currentPosition, new Cesium.Cartesian3());
                        addPersistentLabel(midPoint, formatDistance(segmentDistance));
                    }

                    const lastPoint = finalPoints[finalPoints.length - 1];
                    const labelOffset = new Cesium.Cartesian3(0, 0, 50);
                    const labelPosition = Cesium.Cartesian3.add(lastPoint, labelOffset, new Cesium.Cartesian3());
                    addPersistentLabel(labelPosition, `Total: ${formatDistance(totalDistance)}`);

                    console.log(`LineMeasureTool: Finalized total distance: ${formatDistance(totalDistance)}`);
                    worker.terminate(); // Terminate the worker
                    resolve(finalPoints);

                } else if (e.data.type === 'error') {
                    console.error("LineMeasureTool: Web Worker error during terrain sampling:", e.data.message);
                    PopupService.show('toolInstruction', {
                        message: `Error calculating terrain data: ${e.data.message}. Falling back to ellipsoid calculation.`,
                        title: `Terrain Error`,
                        showDismissButton: true
                    });
                    // Fallback to original points if terrain sampling fails
                    finalPoints.push(...points);
                    // Proceed with calculations using original points
                    let totalDistance = 0;
                    for (let i = 0; i < finalPoints.length - 1; i++) {
                        const lastPosition = finalPoints[i];
                        const currentPosition = finalPoints[i + 1];
                        let segmentDistance;
                        if (isDisplacement) {
                             segmentDistance = Cesium.Cartesian3.distance(lastPosition, currentPosition);
                        } else {
                             const carto1 = viewer.scene.globe.ellipsoid.cartesianToCartographic(lastPosition);
                             const carto2 = viewer.scene.globe.ellipsoid.cartesianToCartographic(currentPosition);
                             const geodesic = new Cesium.EllipsoidGeodesic(carto1, carto2);
                             segmentDistance = geodesic.surfaceDistance;
                        }
                        totalDistance += segmentDistance;
                        const midPoint = Cesium.Cartesian3.midpoint(lastPosition, currentPosition, new Cesium.Cartesian3());
                        addPersistentLabel(midPoint, formatDistance(segmentDistance));
                    }
                    const lastPoint = finalPoints[finalPoints.length - 1];
                    const labelOffset = new Cesium.Cartesian3(0, 0, 50);
                    const labelPosition = Cesium.Cartesian3.add(lastPoint, labelOffset, new Cesium.Cartesian3());
                    addPersistentLabel(labelPosition, `Total: ${formatDistance(totalDistance)}`);

                    worker.terminate();
                    resolve(finalPoints);
                }
            };

            worker.onerror = (error) => {
                console.error("LineMeasureTool: Web Worker unhandled error:", error);
                PopupService.show('toolInstruction', {
                    message: `An unexpected error occurred during terrain calculation. Falling back to ellipsoid calculation.`,
                    title: `Calculation Error`,
                    showDismissButton: true
                });
                // Fallback to original points and resolve
                finalPoints.push(...points);
                // Proceed with calculations using original points
                let totalDistance = 0;
                for (let i = 0; i < finalPoints.length - 1; i++) {
                    const lastPosition = finalPoints[i];
                    const currentPosition = finalPoints[i + 1];
                    let segmentDistance;
                    if (isDisplacement) {
                         segmentDistance = Cesium.Cartesian3.distance(lastPosition, currentPosition);
                    } else {
                         const carto1 = viewer.scene.globe.ellipsoid.cartesianToCartographic(lastPosition);
                         const carto2 = viewer.scene.globe.ellipsoid.cartesianToCartographic(currentPosition);
                         const geodesic = new Cesium.EllipsoidGeodesic(carto1, carto2);
                         segmentDistance = geodesic.surfaceDistance;
                    }
                    totalDistance += segmentDistance;
                    const midPoint = Cesium.Cartesian3.midpoint(lastPosition, currentPosition, new Cesium.Cartesian3());
                    addPersistentLabel(midPoint, formatDistance(segmentDistance));
                }
                const lastPoint = finalPoints[finalPoints.length - 1];
                const labelOffset = new Cesium.Cartesian3(0, 0, 50);
                const labelPosition = Cesium.Cartesian3.add(lastPoint, labelOffset, new Cesium.Cartesian3());
                addPersistentLabel(labelPosition, `Total: ${formatDistance(totalDistance)}`);

                worker.terminate();
                resolve(finalPoints);
            };
        });
    } else {
        // For displacement or if no terrain is available/ready, no sampling needed.
        finalPoints.push(...points);

        let totalDistance = 0;
        for (let i = 0; i < finalPoints.length - 1; i++) {
            const lastPosition = finalPoints[i];
            const currentPosition = finalPoints[i + 1];
            let segmentDistance;

            if (isDisplacement) {
                segmentDistance = Cesium.Cartesian3.distance(lastPosition, currentPosition);
            } else {
                // This branch should ideally not be hit if !isDisplacement and terrain is ready.
                // But as a fallback, if terrainProvider is not ready, we use ellipsoid geodesic.
                const carto1 = viewer.scene.globe.ellipsoid.cartesianToCartographic(lastPosition);
                const carto2 = viewer.scene.globe.ellipsoid.cartesianToCartographic(currentPosition);
                const geodesic = new Cesium.EllipsoidGeodesic(carto1, carto2);
                segmentDistance = geodesic.surfaceDistance;
            }
            totalDistance += segmentDistance;

            const midPoint = Cesium.Cartesian3.midpoint(lastPosition, currentPosition, new Cesium.Cartesian3());
            addPersistentLabel(midPoint, formatDistance(segmentDistance));
        }

        const lastPoint = finalPoints[finalPoints.length - 1];
        const labelOffset = new Cesium.Cartesian3(0, 0, 50);
        const labelPosition = Cesium.Cartesian3.add(lastPoint, labelOffset, new Cesium.Cartesian3());
        addPersistentLabel(labelPosition, `Total: ${formatDistance(totalDistance)}`);

        console.log(`LineMeasureTool: Finalized total distance (no terrain sampling): ${formatDistance(totalDistance)}`);
        return finalPoints;
    }
}