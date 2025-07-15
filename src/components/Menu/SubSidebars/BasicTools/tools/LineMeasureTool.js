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
    addPersistentEntity,
    recordAction // Assuming recordAction might be used directly here for history, otherwise it's handled by ToolManagementService
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
    
    setToolState({
        // drawingPoints: [], // Managed by clearDrawing()
        // activeShape: null, // Managed by clearDrawing()
        // temporaryMeasureLabel: null, // Managed by clearDrawing()
        // labels: [], // Managed by clearDrawing()
        // points: [] // Managed by clearDrawing()
    });

    const toolName = isDisplacement ? "Line Measure" : "3D Line Measure";
    PopupService.showToolInstruction(
        `Left-click to add points. Right-click to finish.`,
        toolName
    );
    console.log("LineMeasureTool: Initial instruction popup shown.");


    // --- LEFT_CLICK Handler ---
    handler.setInputAction((click) => {
        let cartesian;
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

            cartesian = viewer.scene.pickPosition(move.endPosition);

            if (!Cesium.defined(cartesian)) {
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

        const { drawingPoints, viewer } = getToolState();

        PopupService.hide();
        console.log("LineMeasureTool: Initial instruction popup hidden.");

        if (drawingPoints.length < 2) {
            console.warn("LineMeasureTool: Right-click received before enough points. Clearing drawing.");
            clearDrawing(); // Clear all temporary entities
            ToolManagementService.deactivateCurrentTool();
            PopupService.showToolInstruction(
                `Minimum 2 points are required to measure a line.`,
                `Line Measurement Error`,
                true
            );
            return;
        }

        PopupService.showToolInstruction(
            'Calculating accurate terrain data...',
            'Processing Line Measurement',
            false
        );
        console.log("LineMeasureTool: Processing popup shown.");

        try {
            const { sampledPositions, totalDistance } = await finalizeLineMeasure(isDisplacement, drawingPoints);
            console.log("LineMeasureTool: finalizeLineMeasure resolved successfully.");

            const persistentEntities = {};

            const persistentPolyline = addPersistentEntity({
                polyline: {
                    positions: sampledPositions,
                    width: 3,
                    material: Cesium.Color.CYAN,
                    clampToGround: clampShapeToGround,
                },
            });
            persistentEntities.polyline = persistentPolyline;

            const persistentPoints = [];
            drawingPoints.forEach(pos => {
                const point = addPersistentEntity({
                    position: pos,
                    point: {
                        pixelSize: 8,
                        color: Cesium.Color.BLUE,
                        outlineColor: Cesium.Color.WHITE,
                        outlineWidth: 2,
                        disableDepthTestDistance: Number.POSITIVE_INFINITY,
                    },
                });
                persistentPoints.push(point);
            });
            persistentEntities.points = persistentPoints;

            const persistentLabels = [];
            // FIX: Removed the `!isDisplacement` condition here to show segment labels for 2D as well
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

            const lastPoint = sampledPositions[sampledPositions.length - 1] || drawingPoints[drawingPoints.length - 1];
            if (lastPoint) {
                const labelOffset = new Cesium.Cartesian3(0, 0, 50);
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
            persistentEntities.labels = persistentLabels;

            ToolManagementService.addMeasurement(
                toolName,
                `Total: ${formatDistance(totalDistance)}`,
                persistentEntities
            );

            console.log(`Line Measure Tool: Measurement finalized. Total distance: ${formatDistance(totalDistance)}`);

        } catch (error) {
            console.error("LineMeasureTool: Error during finalization:", error);
            PopupService.showToolInstruction(
                `An error occurred during measurement: ${error.message || 'Unknown error'}.`,
                `Measurement Error`,
                true
            );
        } finally {
            PopupService.hide();
            clearDrawing(); // Ensures all temporary drawing entities are cleared
            ToolManagementService.deactivateCurrentTool();
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
    addTemporaryPersistentLabel(midPoint, formatDistance(segmentDistance));
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
        return Promise.resolve({ sampledPositions: [], totalDistance: 0 });
    }

    let finalPoints = [];
    let totalDistance = 0;

    if (!isDisplacement && Cesium.defined(viewer.terrainProvider) && viewer.terrainProvider.ready) {
        const cartographicPoints = points.map(p => viewer.scene.globe.ellipsoid.cartesianToCartographic(p));
        const terrainProviderUrl = viewer.terrainProvider.url || (viewer.terrainProvider.constructor.name === 'CesiumIonWorldTerrainProvider' ? 'https://assets.ion.cesium.com/' : null);

        if (!terrainProviderUrl) {
            console.warn("LineMeasureTool: Terrain provider URL could not be determined. Falling back to ellipsoid calculation.");
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
            const timeoutDuration = 30000;
            let timeoutId = null;

            timeoutId = setTimeout(() => {
                worker.terminate();
                console.error("LineMeasureTool: Web Worker terrain sampling timed out.");
                reject(new Error("Terrain calculation timed out. Please check your internet connection or terrain service."));
            }, timeoutDuration);

            worker.postMessage({
                type: 'sampleTerrain',
                cartographicPoints: cartographicPoints,
                terrainProviderUrl: terrainProviderUrl
            });

            worker.onmessage = (e) => {
                clearTimeout(timeoutId);
                worker.terminate();

                if (e.data.type === 'sampledResult') {
                    finalPoints = e.data.sampledPoints;
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
                        true
                    );
                    resolve({ sampledPositions: finalPoints, totalDistance: totalDistance });
                }
            };

            worker.onerror = (error) => {
                clearTimeout(timeoutId);
                worker.terminate();
                console.error("LineMeasureTool: Web Worker unhandled error:", error);
                reject(new Error(`Worker encountered an unhandled error: ${error.message || 'Check console for details.'}`));
            };
        });
    } else {
        finalPoints.push(...points);

        for (let i = 0; i < finalPoints.length - 1; i++) {
            const p1 = finalPoints[i];
            const p2 = finalPoints[i + 1];
            let segmentDistance;

            if (isDisplacement) {
                segmentDistance = Cesium.Cartesian3.distance(p1, p2);
            } else {
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