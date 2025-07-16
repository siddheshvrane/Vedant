// LineMeasure.js

import * as Cesium from 'cesium';
import {
    clearDrawing,
    removeEventHandlers,
    addTemporaryPoint,
    addTemporaryPersistentLabel,
    updateTemporaryLabel,
    formatDistance,
    getToolState,
    setToolState,
    throttle,
    // Note: addPersistentEntity is now expected to be managed by ToolManagementService
} from '../tool-helpers/tools-helpers.js';
import { PopupService } from '../../../../../services/PopupService.js';
import { ToolManagementService } from '../../../../../services/ToolManagementService.js';

import TerrainSamplerWorker from '../workers/terrain-sampler-worker.js?worker';

/**
 * Sets up the Line Measure tool for either 2D displacement or 3D terrain-following measurement.
 * @param {boolean} isDisplacement - True for 2D Cartesian distance (straight line in 3D space), false for 3D surface distance (clamped to ground).
 * @param {boolean} clampShapeToGround - True to clamp the rubber-banding shape to the terrain, false for 3D space.
 */
export function setupLineMeasureTool(isDisplacement, clampShapeToGround) {
    const { handler, viewer } = getToolState();

    // Initialize/reset tool-specific state variables.
    // clearDrawing() handles most visual resets.
    setToolState({
        mousePosition: null, // Ensure mousePosition is reset for accurate rubber-banding
        // drawingPoints, activeShape, temporaryMeasureLabel are managed by clearDrawing()
    });

    const toolName = isDisplacement ? "2D Line Measure" : "3D Line Measure";
    PopupService.showToolInstruction(
        `Left-click to add points. Right-click to finish.`,
        toolName
    );
    console.log("LineMeasureTool: Initial instruction popup shown for " + toolName);

    // --- LEFT_CLICK Handler ---
    handler.setInputAction((click) => {
        let cartesian;
        // Attempt to pick position on globe surface, considering terrain if clamped
        if (clampShapeToGround) {
            const ray = viewer.camera.getPickRay(click.position);
            cartesian = viewer.scene.globe.pick(ray, viewer.scene);
        } else {
            // For 2D displacement, try to pick an entity first, then fall back to ellipsoid
            cartesian = viewer.scene.pickPosition(click.position);
            if (!Cesium.defined(cartesian)) {
                cartesian = viewer.camera.pickEllipsoid(click.position, viewer.scene.globe.ellipsoid);
            }
        }

        if (Cesium.defined(cartesian)) {
            const { drawingPoints } = getToolState();
            drawingPoints.push(cartesian);
            setToolState({ drawingPoints: [...drawingPoints] }); // Ensure state update triggers reactivity if used

            addTemporaryPoint(cartesian); // Add a temporary visual point for the clicked position

            if (drawingPoints.length === 1) {
                // Create the activeShape (rubber-banding polyline) on the first click
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
                        show: true // Ensure it's visible by default
                    }
                });
                setToolState({ activeShape: activeShape });
            } else if (drawingPoints.length >= 2) {
                // Update segment label for the new *clicked* segment
                // This adds a temporary persistent label that will be cleared by clearDrawing()
                const lastTwoPoints = [drawingPoints[drawingPoints.length - 2], drawingPoints[drawingPoints.length - 1]];
                updateLineMeasureSegment(isDisplacement, lastTwoPoints);
            }

            // Request a render to ensure immediate visual update
            if (viewer.scene.requestRenderMode) {
                viewer.scene.requestRender();
            }
        } else {
            console.warn("LineMeasureTool: Could not pick a valid position on LEFT_CLICK.");
            PopupService.showToolInstruction(
                "Could not pick a valid position. Please click on the globe.",
                toolName,
                true // Is error
            );
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // --- MOUSE_MOVE Handler ---
    const throttledMouseMoveHandler = throttle((move) => {
        const { drawingPoints, viewer } = getToolState();
        if (drawingPoints.length > 0) { // Need at least one point clicked to show rubber-banding
            let cartesian;

            // Prioritize picking terrain if available and applicable, otherwise ellipsoid
            cartesian = viewer.scene.pickPosition(move.endPosition);
            if (!Cesium.defined(cartesian)) {
                cartesian = viewer.camera.pickEllipsoid(move.endPosition, viewer.scene.globe.ellipsoid);
            }

            if (Cesium.defined(cartesian)) {
                setToolState({ mousePosition: cartesian });
                // Update temporary total distance label
                const tempPointsForLabel = [...drawingPoints];
                tempPointsForLabel.push(cartesian);
                updateTemporaryLineMeasure(isDisplacement, tempPointsForLabel);

                if (viewer.scene.requestRenderMode) {
                    viewer.scene.requestRender();
                }
            } else {
                setToolState({ mousePosition: null }); // Clear mouse position if off globe
                updateTemporaryLabel(null, ''); // Clear temporary label if mouse leaves globe
                if (viewer.scene.requestRenderMode) {
                    viewer.scene.requestRender();
                }
            }
        }
    }, 75); // Throttle to 75ms for smoother performance

    handler.setInputAction(throttledMouseMoveHandler, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    // --- RIGHT_CLICK Handler (Finalize) ---
    handler.setInputAction(async () => {
        removeEventHandlers(); // Remove handlers immediately to prevent further interaction

        const { drawingPoints, activeShape, viewer } = getToolState();

        PopupService.hide(); // Hide current instruction/processing popup
        console.log("LineMeasureTool: Initial instruction popup hidden.");

        if (drawingPoints.length < 2) {
            console.warn("LineMeasureTool: Right-click received before enough points. Clearing drawing.");
            clearDrawing(); // Clear all temporary entities
            ToolManagementService.deactivateCurrentTool();
            PopupService.showToolInstruction(
                `Minimum 2 points are required to measure a line.`,
                `Line Measurement Error`,
                true // Is error
            );
            return;
        }

        // Remove the temporary activeShape (rubber-banding line)
        if (Cesium.defined(activeShape)) {
            viewer.entities.remove(activeShape);
            setToolState({ activeShape: null }); // Clear activeShape from state
        }
        
        // Clear temporary labels and points before showing processing message
        clearDrawing(); 

        PopupService.showToolInstruction(
            'Calculating accurate terrain data...',
            'Processing Line Measurement',
            false // Not an error, just an instruction
        );
        console.log("LineMeasureTool: Processing popup shown.");

        try {
            const { sampledPositions, totalDistance } = await finalizeLineMeasure(isDisplacement, drawingPoints);
            console.log("LineMeasureTool: finalizeLineMeasure resolved successfully.");

            // Prepare entity definitions for ToolManagementService
            // ToolManagementService will be responsible for adding these to the viewer
            const persistentEntitiesDefinitions = {
                polyline: {
                    polyline: {
                        positions: sampledPositions, // Use sampled positions for the final line
                        width: 3,
                        material: Cesium.Color.CYAN, // The desired cyan line
                        clampToGround: clampShapeToGround,
                    },
                },
                points: [], // Array to hold point definitions - explicitly empty as requested
                labels: []  // Array to hold label definitions
            };

            // Add persistent segment labels
            if (sampledPositions.length > 1) {
                for (let i = 0; i < sampledPositions.length - 1; i++) {
                    const p1 = sampledPositions[i];
                    const p2 = sampledPositions[i + 1];
                    const segmentMidpoint = Cesium.Cartesian3.midpoint(p1, p2, new Cesium.Cartesian3());
                    let segmentDistance;

                    // Re-calculate segment distance based on isDisplacement for the final label
                    if (isDisplacement) {
                        segmentDistance = Cesium.Cartesian3.distance(p1, p2);
                    } else {
                        const carto1 = viewer.scene.globe.ellipsoid.cartesianToCartographic(p1);
                        const carto2 = viewer.scene.globe.ellipsoid.cartesianToCartographic(p2);
                        const geodesic = new Cesium.EllipsoidGeodesic(carto1, carto2);
                        segmentDistance = geodesic.surfaceDistance;
                    }

                    persistentEntitiesDefinitions.labels.push({
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
                }
            }

            // Add persistent total distance label at the last point
            const lastPoint = sampledPositions[sampledPositions.length - 1] || drawingPoints[drawingPoints.length - 1];
            if (lastPoint) {
                // Offset the total label slightly above the last point
                const labelOffset = new Cesium.Cartesian3(0, 0, 20.0); // Lift by 20 meters
                const labelPosition = Cesium.Cartesian3.add(lastPoint, labelOffset, new Cesium.Cartesian3());
                persistentEntitiesDefinitions.labels.push({
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
            }

            // Pass the entity definitions to ToolManagementService for creation and management
            ToolManagementService.addMeasurement(
                toolName,
                `Total: ${formatDistance(totalDistance)}`,
                persistentEntitiesDefinitions // Pass the definitions for the service to process
            );

            console.log(`Line Measure Tool: Measurement finalized. Total distance: ${formatDistance(totalDistance)}`);

        } catch (error) {
            console.error("LineMeasureTool: Error during finalization:", error);
            PopupService.showToolInstruction(
                `An error occurred during measurement: ${error.message || 'Unknown error'}.`,
                `Measurement Error`,
                true // Is error
            );
        } finally {
            PopupService.hide(); // Hide any remaining popups
            clearDrawing(); // Ensure all temporary drawing entities are cleared
            ToolManagementService.deactivateCurrentTool(); // Deactivate the tool
        }

        // Request a final render to ensure all persistent entities are visible
        if (viewer.scene.requestRenderMode) {
            viewer.scene.requestRender();
        }

    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
}

/**
 * Calculates and adds a temporary persistent label for a line segment.
 * This label is added as a temporary entity that will be cleared by clearDrawing().
 * @param {boolean} isDisplacement - Whether to calculate 2D Cartesian distance or 3D surface distance.
 * @param {Array<Cesium.Cartesian3>} segmentPoints - An array of two Cartesian3 points [start, end].
 */
function updateLineMeasureSegment(isDisplacement, segmentPoints) {
    const { viewer } = getToolState();
    if (segmentPoints.length < 2 || !Cesium.defined(segmentPoints[0]) || !Cesium.defined(segmentPoints[1])) {
        return;
    }

    let segmentDistance;
    const p1 = segmentPoints[0];
    const p2 = segmentPoints[1];

    if (isDisplacement) {
        segmentDistance = Cesium.Cartesian3.distance(p1, p2);
    } else {
        const carto1 = viewer.scene.globe.ellipsoid.cartesianToCartographic(p1);
        const carto2 = viewer.scene.globe.ellipsoid.cartesianToCartographic(p2);
        const geodesic = new Cesium.EllipsoidGeodesic(carto1, carto2);
        segmentDistance = geodesic.surfaceDistance;
    }
    const midPoint = Cesium.Cartesian3.midpoint(p1, p2, new Cesium.Cartesian3());
    addTemporaryPersistentLabel(midPoint, formatDistance(segmentDistance)); // Uses the imported helper
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

    const lastClickedPosition = allPointsIncludingMouse[allPointsIncludingMouse.length - 2];
    const mousePosition = allPointsIncludingMouse[allPointsIncludingMouse.length - 1]; // This is the mouse position

    let segmentDistance;
    if (isDisplacement) {
        segmentDistance = Cesium.Cartesian3.distance(lastClickedPosition, mousePosition);
    } else {
        const carto1 = viewer.scene.globe.ellipsoid.cartesianToCartographic(lastClickedPosition);
        const carto2 = viewer.scene.globe.ellipsoid.cartesianToCartographic(mousePosition);
        const geodesic = new Cesium.EllipsoidGeodesic(carto1, carto2);
        segmentDistance = geodesic.surfaceDistance;
    }

    const midPoint = Cesium.Cartesian3.midpoint(lastClickedPosition, mousePosition, new Cesium.Cartesian3());
    updateTemporaryLabel(midPoint, formatDistance(segmentDistance));
}

/**
 * Finalizes the line measure, calculates total distance, and prepares persistent data.
 * This function will now perform accurate terrain sampling for '3D Terrain Line' using a Web Worker.
 * @param {boolean} isDisplacement - Whether to calculate 2D Cartesian distance or 3D surface distance.
 * @param {Array<Cesium.Cartesian3>} points - All the clicked points for the line (from LEFT_CLICK).
 * @returns {Promise<{sampledPositions: Array<Cesium.Cartesian3>, totalDistance: number}>} A promise that resolves with the final sampled points and total distance.
 */
async function finalizeLineMeasure(isDisplacement, points) {
    const { viewer } = getToolState();

    if (points.length < 2) {
        return { sampledPositions: [], totalDistance: 0 };
    }

    let finalPoints = [];
    let totalDistance = 0;

    // Perform terrain sampling for 3D line measurements when a terrain provider is active and ready.
    if (!isDisplacement && Cesium.defined(viewer.terrainProvider) && viewer.terrainProvider.ready) {
        const cartographicPoints = points.map(p => viewer.scene.globe.ellipsoid.cartesianToCartographic(p));

        // Attempt to get the terrain provider URL; fallback for Cesium Ion World Terrain
        const terrainProviderUrl = viewer.terrainProvider.url || (viewer.terrainProvider.constructor.name === 'CesiumIonWorldTerrainProvider' ? 'https://assets.ion.cesium.com/' : null);

        if (!terrainProviderUrl) {
            console.warn("LineMeasureTool: Terrain provider URL could not be determined. Falling back to ellipsoid calculation.");
            // Fallback immediately if URL is not defined
            finalPoints.push(...points);
            for (let i = 0; i < finalPoints.length - 1; i++) {
                const p1 = finalPoints[i];
                const p2 = finalPoints[i + 1];
                const carto1 = viewer.scene.globe.ellipsoid.cartesianToCartographic(p1);
                const carto2 = viewer.scene.globe.ellipsoid.cartesianToCartographic(p2); // Fixed typo: cartographicToCartographic -> cartesianToCartographic
                const geodesic = new Cesium.EllipsoidGeodesic(carto1, carto2);
                totalDistance += geodesic.surfaceDistance;
            }
            PopupService.showToolInstruction(
                `Terrain data source URL not found. Falling back to ellipsoid calculation.`,
                `Terrain Warning`,
                true // Is error
            );
            return { sampledPositions: finalPoints, totalDistance: totalDistance };
        }

        return new Promise((resolve, reject) => {
            const worker = new TerrainSamplerWorker();
            const timeoutDuration = 30000; // 30 seconds timeout
            let timeoutId = null;

            timeoutId = setTimeout(() => {
                worker.terminate();
                console.error("LineMeasureTool: Web Worker terrain sampling timed out.");
                reject(new Error("Terrain calculation timed out. Please check your internet connection or terrain service."));
            }, timeoutDuration);

            worker.postMessage({
                type: 'sampleTerrain',
                cartographicPoints: cartographicPoints,
                terrainProviderUrl: terrainProviderUrl // Pass URL to worker
            });

            worker.onmessage = (e) => {
                clearTimeout(timeoutId); // Clear timeout on message receipt
                worker.terminate(); // Terminate the worker

                if (e.data.type === 'sampledResult') {
                    finalPoints = e.data.sampledPoints;
                    // Calculate total distance based on sampled terrain points
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
                    // Fallback to original points and ellipsoid calculation if terrain sampling fails
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
                        `Error calculating terrain data: ${e.data.message}. Falling back to ellipsoid calculation.`,
                        `Terrain Error`,
                        true // Is error
                    );
                    resolve({ sampledPositions: finalPoints, totalDistance: totalDistance });
                }
            };

            worker.onerror = (error) => {
                clearTimeout(timeoutId); // Clear timeout on error
                worker.terminate();
                console.error("LineMeasureTool: Web Worker unhandled error:", error);
                // Fallback to original points and ellipsoid calculation on unhandled worker error
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
                    `An unexpected error occurred during terrain calculation. Falling back to ellipsoid calculation.`,
                    `Calculation Error`,
                    true // Is error
                );
                resolve({ sampledPositions: finalPoints, totalDistance: totalDistance });
            };
        });
    } else {
        // For 2D displacement or if no terrain is available/ready, no sampling needed.
        finalPoints.push(...points);

        for (let i = 0; i < finalPoints.length - 1; i++) {
            const p1 = finalPoints[i];
            const p2 = finalPoints[i + 1];
            let segmentDistance;

            if (isDisplacement) {
                segmentDistance = Cesium.Cartesian3.distance(p1, p2);
            } else {
                // This branch acts as a fallback for '3D Line Measure' if terrain provider is not ready.
                // We calculate the geodesic distance on the ellipsoid.
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