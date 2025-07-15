import * as Cesium from 'cesium';
import {
    clearDrawing,
    removeEventHandlers,
    addTemporaryPoint,
    updateTemporaryLabel,
    formatArea,
    getToolState,
    setToolState,
    throttle,
    addPersistentEntity // Make sure this is imported if used directly
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
    // These are now handled by ToolManagementService upon tool activation,
    // which calls clearDrawing() and removeEventHandlers().
    // clearDrawing();
    // removeEventHandlers();

    const { handler, viewer } = getToolState();
    
    // Initial state setup for drawing-related properties is primarily handled by clearDrawing()
    // which is called during tool activation (e.g., by ToolManagementService).
    // Keeping a minimal setToolState here if there's any specific override needed for this tool.
    setToolState({
        // drawingPoints: [], // Managed by clearDrawing()
        // activeShape: null, // Managed by clearDrawing()
        // temporaryMeasureLabel: null, // Managed by clearDrawing()
        mousePosition: null // Ensure mousePosition is reset
    });

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
            cartesian = viewer.scene.pickPosition(click.position);
            if (!Cesium.defined(cartesian)) {
                cartesian = viewer.camera.pickEllipsoid(click.position, viewer.scene.globe.ellipsoid);
            }
        }

        if (Cesium.defined(cartesian)) {
            const { drawingPoints } = getToolState();
            drawingPoints.push(cartesian);
            setToolState({ drawingPoints: drawingPoints }); // Update state after push

            addTemporaryPoint(cartesian); // Add a temporary visual point

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
                        clampToGround: clampShapeToGround
                    }
                });
                setToolState({ activeShape: activeShape });
            }

            // Update temporary area label if enough points are present
            if (drawingPoints.length >= 2 && Cesium.defined(getToolState().mousePosition)) { // Needs at least 2 points to form a polygon with mouse
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

        const { drawingPoints, viewer } = getToolState(); // activeShape is used later in try block

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

        // The following state resets are now handled by clearDrawing() which is called in finally.
        // setToolState({ mousePosition: null });
        // if (Cesium.defined(temporaryMeasureLabel)) {
        //     viewer.entities.remove(temporaryMeasureLabel);
        //     setToolState({ temporaryMeasureLabel: null });
        // }

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

            const { activeShape } = getToolState(); // Get activeShape after finalize for cleanup

            // Add persistent entities
            const persistentEntities = {};

            if (Cesium.defined(activeShape)) {
                // If there was an activeShape, remove it before adding persistent ones.
                // It's removed here so it doesn't flash before the new entities appear.
                viewer.entities.remove(activeShape);
                setToolState({ activeShape: null }); // Clear activeShape from state
            }
            
            // Add persistent polygon
            const persistentPolygon = addPersistentEntity({
                polygon: {
                    hierarchy: new Cesium.PolygonHierarchy(sampledPositions),
                    material: Cesium.Color.CYAN.withAlpha(0.2),
                    outline: true,
                    outlineColor: Cesium.Color.CYAN,
                    outlineWidth: 2,
                    clampToGround: clampShapeToGround,
                },
                polyline: { // Also add a persistent polyline for the outline
                    positions: [...sampledPositions, sampledPositions[0]],
                    width: 3,
                    material: Cesium.Color.CYAN,
                    clampToGround: clampShapeToGround,
                }
            });
            persistentEntities.polygon = persistentPolygon;

            // Add persistent points
            const persistentPoints = [];
            drawingPoints.forEach(pos => { // Use original drawing points for persistent points
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

            // Add persistent total area label
            const labelOffset = new Cesium.Cartesian3(0, 0, 50);
            const labelPosition = Cesium.Cartesian3.add(centerPoint, labelOffset, new Cesium.Cartesian3());
            const formattedArea = formatArea(totalArea);
            const persistentAreaLabel = addPersistentEntity({
                position: labelPosition,
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
            persistentEntities.labels = [persistentAreaLabel]; // Store labels in an array

            ToolManagementService.addMeasurement(
                toolName,
                `Area: ${formattedArea}`,
                persistentEntities
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
            clearDrawing(); // Ensures all temporary drawing entities are cleared (including activeShape)
            ToolManagementService.deactivateCurrentTool();
        }

        if (viewer.scene.requestRenderMode) {
            viewer.scene.requestRender();
        }
    };

    handler.setInputAction(finishArea, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
    handler.setInputAction(finishArea, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
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
        totalArea = Cesium.PolygonPipeline.computeArea2D(points);
        const boundingSphere = Cesium.BoundingSphere.fromPoints(points);
        centerPoint = boundingSphere.center;
    } else {
        // For terrain mode temporary display, calculate projected area on ellipsoid for speed
        totalArea = Cesium.PolygonPipeline.computeArea2D(points, viewer.scene.globe.ellipsoid);

        const centroid = Cesium.BoundingSphere.fromPoints(points).center;
        // Robust centerPoint calculation: Fallback to centroid if scaleToGeodeticSurface fails
        centerPoint = Cesium.defined(viewer.scene.globe.ellipsoid.scaleToGeodeticSurface(centroid))
            ? viewer.scene.globe.ellipsoid.scaleToGeodeticSurface(centroid)
            : centroid;
    }

    const labelOffset = new Cesium.Cartesian3(0, 0, 50);
    const labelPosition = Cesium.Cartesian3.add(centerPoint, labelOffset, new Cesium.Cartesian3());
    updateTemporaryLabel(labelPosition, `Area: ${formatArea(totalArea)}`);
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
            calculatedArea = Cesium.PolygonPipeline.computeArea2D(finalPoints, viewer.scene.globe.ellipsoid);
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

                    // For 3D terrain area, computeArea2D with ellipsoid for the sampled points
                    calculatedArea = Cesium.PolygonPipeline.computeArea2D(finalPoints, viewer.scene.globe.ellipsoid);
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
                    calculatedArea = Cesium.PolygonPipeline.computeArea2D(finalPoints, viewer.scene.globe.ellipsoid);
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
                calculatedArea = Cesium.PolygonPipeline.computeArea2D(finalPoints, viewer.scene.globe.ellipsoid);
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
            calculatedArea = Cesium.PolygonPipeline.computeArea2D(finalPoints);
            const boundingSphere = Cesium.BoundingSphere.fromPoints(finalPoints);
            calculatedCenterPoint = boundingSphere.center;
        } else {
            // This branch should ideally not be hit if !isProjectedArea and terrain is ready.
            // But as a fallback, if terrainProvider is not ready, we use ellipsoid projected area.
            calculatedArea = Cesium.PolygonPipeline.computeArea2D(finalPoints, viewer.scene.globe.ellipsoid);
            const centroid = Cesium.BoundingSphere.fromPoints(finalPoints).center;
            calculatedCenterPoint = Cesium.defined(viewer.scene.globe.ellipsoid.scaleToGeodeticSurface(centroid))
                ? viewer.scene.globe.ellipsoid.scaleToGeodeticSurface(centroid)
                : centroid;
        }

        console.log(`AreaMeasureTool: Finalized total area (no terrain sampling): ${formatArea(calculatedArea)}`);
        return { sampledPositions: finalPoints, totalArea: calculatedArea, centerPoint: calculatedCenterPoint };
    }
}