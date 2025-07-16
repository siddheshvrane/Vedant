import * as Cesium from 'cesium';
import {
    clearDrawing,
    removeEventHandlers,
    addTemporaryPoint,        // This will now use the heightOffset for temporary yellow points
    updateTemporaryLabel,     // This will now use the heightOffset for temporary cyan label
    formatArea,
    getToolState,
    setToolState,
    throttle,
    // addTemporaryPersistentLabel, // No longer needed if we're not adding a separate persistent label via this helper
} from '../tool-helpers/tools-helpers.js';
import { PopupService } from '../../../../../services/PopupService.js';
import { ToolManagementService } from '../../../../../services/ToolManagementService.js';

import TerrainSamplerWorker from '../workers/terrain-sampler-worker.js?worker';

/**
 * Sets up the Area Measure tool for either 2D projected area or 3D terrain-following area.
 * @param {boolean} isProjectedArea - True for 2D projected area, false for 3D terrain-following area.
 * @param {boolean} clampShapeToGround - True to clamp the rubber-banding shape to the terrain, false for 3D space.
 */
export function setupAreaMeasureTool(isProjectedArea, clampShapeToGround) {
    const { handler, viewer } = getToolState();

    // Ensure mousePosition is reset at the start of a new tool activation
    setToolState({ mousePosition: null });

    const toolName = isProjectedArea ? "2D Area Measure" : "3D Area Measure";
    PopupService.showToolInstruction(
        `Left-click to add points. Right-click or Double-click to finish.`,
        toolName
    );
    console.log("AreaMeasureTool: Initial instruction popup shown.");

    // --- LEFT_CLICK Handler ---
    handler.setInputAction((click) => {
        let cartesian;
        if (clampShapeToGround) {
            const ray = viewer.camera.getPickRay(click.position);
            cartesian = viewer.scene.globe.pick(ray, viewer.scene);
        } else {
            // Pick an actual 3D position if not clamping
            cartesian = viewer.scene.pickPosition(click.position);
            // Fallback to ellipsoid if pickPosition fails (e.g., clicking on sky)
            if (!Cesium.defined(cartesian)) {
                cartesian = viewer.camera.pickEllipsoid(click.position, viewer.scene.globe.ellipsoid);
            }
        }

        if (Cesium.defined(cartesian)) {
            const { drawingPoints } = getToolState();
            drawingPoints.push(cartesian);
            setToolState({ drawingPoints: drawingPoints }); // Update state after push

            // Use addTemporaryPoint which now includes a height offset (defaulting to 0.5 or what you set in tools-helpers)
            addTemporaryPoint(cartesian); // Yellow temporary points, lifted by default offset (e.g., 0.5m or 5m)

            let { activeShape } = getToolState();
            if (!Cesium.defined(activeShape)) {
                // Create the activeShape (rubber-banding polygon and polyline)
                activeShape = viewer.entities.add({
                    polygon: {
                        hierarchy: new Cesium.CallbackProperty(() => {
                            const { drawingPoints: currentDrawingPoints, mousePosition } = getToolState();
                            const tempHierarchyPoints = [...currentDrawingPoints];
                            if (Cesium.defined(mousePosition)) {
                                tempHierarchyPoints.push(mousePosition);
                            }
                            return new Cesium.PolygonHierarchy(tempHierarchyPoints);
                        }, false),
                        material: Cesium.Color.RED.withAlpha(0.2),
                        clampToGround: clampShapeToGround,
                        show: true // Ensure it's visible by default
                    },
                    polyline: {
                        positions: new Cesium.CallbackProperty(() => {
                            const { drawingPoints: currentDrawingPoints, mousePosition } = getToolState();
                            const positions = [...currentDrawingPoints];
                            if (Cesium.defined(mousePosition)) {
                                positions.push(mousePosition);
                            }
                            if (positions.length > 1) {
                                positions.push(positions[0]); // Close the polyline
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
            }

            // Update temporary area label if enough points are present
            if (drawingPoints.length >= 2 && Cesium.defined(getToolState().mousePosition)) {
                updateTemporaryAreaMeasure(isProjectedArea, [...drawingPoints, getToolState().mousePosition]);
            } else {
                updateTemporaryLabel(null, ''); // Clear label if not enough points or mouse not defined
            }

            if (viewer.scene.requestRenderMode) {
                viewer.scene.requestRender();
            }
        } else {
            console.warn("AreaMeasureTool: Could not pick a valid position on LEFT_CLICK.");
            PopupService.showToolInstruction(
                "Could not pick a valid position. Please click on the globe.",
                toolName,
                true
            );
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // --- MOUSE_MOVE Handler ---
    const throttledMouseMoveHandler = throttle((move) => {
        const { drawingPoints, viewer } = getToolState();
        if (drawingPoints.length >= 1) { // Need at least one point clicked to show rubber-banding
            let cartesian;

            // Always try to pick terrain if available, otherwise fall back to ellipsoid
            cartesian = viewer.scene.pickPosition(move.endPosition);
            if (!Cesium.defined(cartesian)) {
                cartesian = viewer.camera.pickEllipsoid(move.endPosition, viewer.scene.globe.ellipsoid);
            }

            if (Cesium.defined(cartesian)) {
                setToolState({ mousePosition: cartesian });
                if (drawingPoints.length >= 2) { // Only update area label if there are at least two clicked points + mouse
                    updateTemporaryAreaMeasure(isProjectedArea, [...drawingPoints, cartesian]);
                } else {
                    updateTemporaryLabel(null, ''); // Clear temporary label if not enough points for an area
                }

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

    // --- Finalize Function (shared by Right-Click and Double-Click) ---
    const finishArea = async () => {
        removeEventHandlers(); // Remove handlers immediately

        const { drawingPoints, viewer } = getToolState();

        PopupService.hide(); // Hide current instruction
        console.log("AreaMeasureTool: Initial instruction popup hidden.");

        if (drawingPoints.length < 3) {
            console.warn("AreaMeasureTool: Finalize triggered before enough points. Clearing drawing.");
            clearDrawing(); // Clear all temporary entities
            ToolManagementService.deactivateCurrentTool();
            PopupService.showToolInstruction(
                `Minimum 3 points are required to measure an area.`,
                `Area Measurement Incomplete`,
                true
            );
            return;
        }

        // Show a "Calculating..." popup while terrain sampling happens in the worker
        PopupService.showToolInstruction(
            'Calculating accurate terrain data...',
            'Processing Area Measurement',
            false
        );
        console.log("AreaMeasureTool: Processing popup shown.");

        try {
            // Finalize measurement - this is where we do the expensive, accurate terrain sampling
            const { sampledPositions, totalArea, centerPoint } = await finalizeAreaMeasure(isProjectedArea, drawingPoints);
            console.log("AreaMeasureTool: finalizeAreaMeasure resolved successfully.");

            const { activeShape } = getToolState();
            if (Cesium.defined(activeShape)) {
                // Remove the temporary activeShape as we're about to add the persistent ones.
                viewer.entities.remove(activeShape);
                setToolState({ activeShape: null }); // Clear activeShape from state
            }

            // Prepare entity definitions for ToolManagementService
            const persistentEntitiesDefinitions = {
                polygon: { // This is a definition, not an entity
                    polygon: {
                        hierarchy: new Cesium.PolygonHierarchy(sampledPositions),
                        material: Cesium.Color.CYAN.withAlpha(0.2),
                        outline: true,
                        outlineColor: Cesium.Color.CYAN,
                        outlineWidth: 2,
                        // Clamp to ground only if it's a 3D terrain measure and not a 2D projected one
                        clampToGround: !isProjectedArea,
                    },
                    polyline: { // Also add a persistent polyline for the outline
                        positions: [...sampledPositions, sampledPositions[0]],
                        width: 3,
                        material: Cesium.Color.CYAN,
                        // Clamp to ground only if it's a 3D terrain measure and not a 2D projected one
                        clampToGround: !isProjectedArea,
                    }
                },
                // Removed persistent points section
                points: [], // Ensure this array is empty as requested
                labels: []  // Array to hold label definitions
            };

            // Add persistent total area label definition
            // Ensure the center point is also lifted, especially if calculated on terrain.
            const labelCartographic = Cesium.Cartographic.fromCartesian(centerPoint);
            const liftedLabelPosition = Cesium.Cartesian3.fromDegrees(
                labelCartographic.longitude * 180 / Math.PI,
                labelCartographic.latitude * 180 / Math.PI,
                labelCartographic.height + 20.0 // LIFT BY 20 METERS for clearer visibility if the issue was height
            );

            const formattedArea = formatArea(totalArea);
            persistentEntitiesDefinitions.labels.push({
                position: liftedLabelPosition, // Use the lifted position
                label: {
                    text: `Total Area: ${formattedArea}`,
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

            ToolManagementService.addMeasurement(
                toolName,
                `Area: ${formattedArea}`,
                persistentEntitiesDefinitions // Pass the definitions to the service
            );

            console.log(`Area Measure Tool: Measurement finalized. Total Area: ${formattedArea}`);

        } catch (error) {
            console.error("AreaMeasureTool: Error during finalization:", error);
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
    };

    handler.setInputAction(finishArea, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
    handler.setInputAction(finishArea, Cesium.ScreenScreenEventType.LEFT_DOUBLE_CLICK);
}

/**
 * Updates the temporary area label during polygon drawing on mouse move.
 * Uses the (potentially approximate) mouse position.
 * @param {boolean} isProjectedArea - True for 2D projected area, false for 3D terrain-following area.
 * @param {Array<Cesium.Cartesian3>} points - All clicked points + current mouse position.
 */
function updateTemporaryAreaMeasure(isProjectedArea, points) {
    const { viewer } = getToolState();

    if (points.length < 3 || !points.every(p => Cesium.defined(p))) {
        updateTemporaryLabel(null, '');
        return;
    }

    let totalArea = 0;
    let centerPoint = Cesium.Cartesian3.ZERO;

    if (isProjectedArea) {
        // For projected area, just compute 2D area directly
        totalArea = Math.abs(Cesium.PolygonPipeline.computeArea2D(points));
        const boundingSphere = Cesium.BoundingSphere.fromPoints(points);
        centerPoint = boundingSphere.center;
    } else {
        // For terrain mode temporary display, calculate projected area on ellipsoid for speed
        // This is an approximation until final calculation with terrain sampling
        totalArea = Math.abs(Cesium.PolygonPipeline.computeArea2D(points, viewer.scene.globe.ellipsoid));

        const centroid = Cesium.BoundingSphere.fromPoints(points).center;
        // Robust centerPoint calculation: Fallback to centroid if scaleToGeodeticSurface fails
        centerPoint = Cesium.defined(viewer.scene.globe.ellipsoid.scaleToGeodeticSurface(centroid))
            ? viewer.scene.globe.ellipsoid.scaleToGeodeticSurface(centroid)
            : centroid;
    }

    // Pass the centerPoint to updateTemporaryLabel, which now handles its own height offset (e.g., 0.5m or 5m)
    updateTemporaryLabel(centerPoint, `Area: ${formatArea(totalArea)}`);
}

/**
 * Finalizes the area measure, calculates total area, and prepares persistent data.
 * This function will now perform accurate terrain sampling for '3D Area Measure' using a Web Worker.
 * @param {boolean} isProjectedArea - True for 2D projected area, false for 3D terrain-following area.
 * @param {Array<Cesium.Cartesian3>} points - All the clicked points for the polygon (from LEFT_CLICK).
 * @returns {Promise<{sampledPositions: Array<Cesium.Cartesian3>, totalArea: number, centerPoint: Cesium.Cartesian3}>} A promise that resolves with the final sampled points, total area, and center.
 */
async function finalizeAreaMeasure(isProjectedArea, points) {
    const { viewer } = getToolState();

    if (points.length < 3 || !points.every(p => Cesium.defined(p))) {
        // Error handling for insufficient points is already done in finishArea()
        return { sampledPositions: [], totalArea: 0, centerPoint: Cesium.Cartesian3.ZERO };
    }

    let finalPoints = [];
    let calculatedArea = 0;
    let calculatedCenterPoint = Cesium.Cartesian3.ZERO;

    // If it's a terrain area, sample the terrain for accurate height for final calculation using a Web Worker.
    if (!isProjectedArea && Cesium.defined(viewer.terrainProvider) && viewer.terrainProvider.ready) {
        const cartographicPoints = points.map(p => viewer.scene.globe.ellipsoid.cartesianToCartographic(p));

        // Attempt to get the terrain provider URL; fallback for Cesium Ion World Terrain
        const terrainProviderUrl = viewer.terrainProvider.url || (viewer.terrainProvider.constructor.name === 'CesiumIonWorldTerrainProvider' ? 'https://assets.ion.cesium.com/' : null);

        if (!Cesium.defined(terrainProviderUrl)) {
            console.warn("AreaMeasureTool: Terrain provider URL is undefined. Falling back to ellipsoid calculation.");
            PopupService.showToolInstruction(
                `Terrain provider not configured or ready. Falling back to ellipsoid calculation.`,
                `Terrain Data Not Available`,
                true
            );
            // Fallback immediately if URL is not defined
            finalPoints.push(...points);
            calculatedArea = Math.abs(Cesium.PolygonPipeline.computeArea2D(finalPoints, viewer.scene.globe.ellipsoid));
            const centroid = Cesium.BoundingSphere.fromPoints(finalPoints).center;
            calculatedCenterPoint = Cesium.defined(viewer.scene.globe.ellipsoid.scaleToGeodeticSurface(centroid))
                ? viewer.scene.globe.ellipsoid.scaleToGeodeticSurface(centroid)
                : centroid;
            return { sampledPositions: finalPoints, totalArea: calculatedArea, centerPoint: calculatedCenterPoint };
        }

        return new Promise((resolve, reject) => {
            const worker = new TerrainSamplerWorker();
            const timeoutDuration = 30000; // 30 seconds timeout
            let timeoutId = null;

            timeoutId = setTimeout(() => {
                worker.terminate();
                console.error("AreaMeasureTool: Web Worker terrain sampling timed out.");
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
                    // !!! IMPORTANT LOGGING !!!
                    console.log("AreaMeasureTool: Sampled points received from worker:", finalPoints.map(p => {
                        const carto = Cesium.Cartographic.fromCartesian(p);
                        return `Lon: ${Cesium.Math.toDegrees(carto.longitude).toFixed(4)}, Lat: ${Cesium.Math.toDegrees(carto.latitude).toFixed(4)}, Height: ${carto.height.toFixed(2)}m`;
                    }));

                    // For 3D terrain area, computeArea2D with ellipsoid for the sampled points
                    calculatedArea = Math.abs(Cesium.PolygonPipeline.computeArea2D(finalPoints, viewer.scene.globe.ellipsoid));
                    const centroid = Cesium.BoundingSphere.fromPoints(finalPoints).center;
                    calculatedCenterPoint = Cesium.defined(viewer.scene.globe.ellipsoid.scaleToGeodeticSurface(centroid))
                        ? viewer.scene.globe.ellipsoid.scaleToGeodeticSurface(centroid)
                        : centroid;

                    resolve({ sampledPositions: finalPoints, totalArea: calculatedArea, centerPoint: calculatedCenterPoint });

                } else if (e.data.type === 'error') {
                    console.error("AreaMeasureTool: Web Worker error during terrain sampling:", e.data.message);
                    PopupService.showToolInstruction(
                        `Error calculating terrain data: ${e.data.message}. Falling back to ellipsoid calculation.`,
                        `Terrain Error`,
                        true
                    );
                    // Fallback to original points if terrain sampling fails
                    finalPoints.push(...points);
                    calculatedArea = Math.abs(Cesium.PolygonPipeline.computeArea2D(finalPoints, viewer.scene.globe.ellipsoid));
                    const centroid = Cesium.BoundingSphere.fromPoints(finalPoints).center;
                    calculatedCenterPoint = Cesium.defined(viewer.scene.globe.ellipsoid.scaleToGeodeticSurface(centroid))
                        ? viewer.scene.globe.ellipsoid.scaleToGeodeticSurface(centroid)
                        : centroid;
                    resolve({ sampledPositions: finalPoints, totalArea: calculatedArea, centerPoint: calculatedCenterPoint });
                }
            };

            worker.onerror = (error) => {
                clearTimeout(timeoutId); // Clear timeout on error
                worker.terminate();
                console.error("AreaMeasureTool: Web Worker unhandled error:", error);
                PopupService.showToolInstruction(
                    `An unexpected error occurred during terrain calculation. Falling back to ellipsoid calculation.`,
                    `Calculation Error`,
                    true
                );
                // Fallback to original points and resolve
                finalPoints.push(...points);
                calculatedArea = Math.abs(Cesium.PolygonPipeline.computeArea2D(finalPoints, viewer.scene.globe.ellipsoid));
                const centroid = Cesium.BoundingSphere.fromPoints(finalPoints).center;
                calculatedCenterPoint = Cesium.defined(viewer.scene.globe.ellipsoid.scaleToGeodeticSurface(centroid))
                    ? viewer.scene.globe.ellipsoid.scaleToGeodeticSurface(centroid)
                    : centroid;
                resolve({ sampledPositions: finalPoints, totalArea: calculatedArea, centerPoint: calculatedCenterPoint });
            };
        });
    } else {
        // For projected area or if no terrain is available/ready, no sampling needed.
        finalPoints.push(...points);

        if (isProjectedArea) {
            calculatedArea = Math.abs(Cesium.PolygonPipeline.computeArea2D(finalPoints));
            const boundingSphere = Cesium.BoundingSphere.fromPoints(finalPoints);
            calculatedCenterPoint = boundingSphere.center;
        } else {
            // This branch acts as a fallback for '3D Area Measure' if terrain provider is not ready.
            // We calculate the area projected onto the ellipsoid.
            calculatedArea = Math.abs(Cesium.PolygonPipeline.computeArea2D(finalPoints, viewer.scene.globe.ellipsoid));
            const centroid = Cesium.BoundingSphere.fromPoints(finalPoints).center;
            calculatedCenterPoint = Cesium.defined(viewer.scene.globe.ellipsoid.scaleToGeodeticSurface(centroid))
                ? viewer.scene.globe.ellipsoid.scaleToGeodeticSurface(centroid)
                : centroid;
        }

        console.log(`AreaMeasureTool: Finalized total area (no terrain sampling): ${formatArea(calculatedArea)}`);
        return { sampledPositions: finalPoints, totalArea: calculatedArea, centerPoint: calculatedCenterPoint };
    }
}