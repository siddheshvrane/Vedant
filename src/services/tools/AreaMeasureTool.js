import * as Cesium from 'cesium';
import {
    clearDrawing,
    removeEventHandlers,
    addTemporaryPoint,
    addPersistentLabel,
    updateTemporaryLabel,
    formatArea,
    getToolState,
    setToolState,
    throttle
} from '../tool-helpers/tools-helpers.js';
import { PopupService } from '../../services/PopupService.js';

/**
 * Sets up the Area Measure tool for either 2D projected area or 3D terrain-following area.
 * @param {boolean} isProjectedArea - True for 2D projected area, false for 3D terrain-following area.
 * @param {boolean} clampShapeToGround - True to clamp the rubber-banding shape to the terrain, false for 3D space.
 */
export function setupAreaMeasureTool(isProjectedArea, clampShapeToGround) {
    clearDrawing();
    removeEventHandlers();

    const { handler, viewer } = getToolState();
    setToolState({
        drawingPoints: [],
        activeShape: null,
        temporaryMeasureLabel: null,
        mousePosition: null
    });

    const toolName = isProjectedArea ? "2D Area Measure (Projected)" : "3D Area Measure (Terrain)";
    PopupService.showToolInstruction(
        `Left-click to add points. Right-click or Double-click to finish.`,
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
            cartesian = viewer.scene.pickPosition(click.position);
            if (!Cesium.defined(cartesian)) {
                cartesian = viewer.camera.pickEllipsoid(click.position, viewer.scene.globe.ellipsoid);
            }
        }

        if (Cesium.defined(cartesian)) {
            const { drawingPoints, viewer } = getToolState();
            drawingPoints.push(cartesian);
            setToolState({ drawingPoints: drawingPoints });

            addTemporaryPoint(cartesian);

            if (drawingPoints.length >= 1) {
                let { activeShape } = getToolState();
                if (!Cesium.defined(activeShape)) {
                    activeShape = viewer.entities.add({
                        polygon: {
                            hierarchy: new Cesium.CallbackProperty(() => {
                                const { drawingPoints, mousePosition } = getToolState();
                                const tempHierarchyPoints = [...drawingPoints];
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
                                const { drawingPoints, mousePosition } = getToolState();
                                const positions = [...drawingPoints];
                                if (Cesium.defined(mousePosition)) {
                                    positions.push(mousePosition);
                                }
                                if (positions.length > 1) {
                                    positions.push(positions[0]);
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
                if (drawingPoints.length >= 2 && Cesium.defined(getToolState().mousePosition)) {
                    updateTemporaryAreaMeasure(isProjectedArea, [...drawingPoints, getToolState().mousePosition]);
                } else {
                    updateTemporaryLabel(null, '');
                }
            }

            if (viewer.scene.requestRenderMode) {
                viewer.scene.requestRender();
            }
        } else {
            console.warn("AreaMeasureTool: Could not pick a valid position on LEFT_CLICK.");
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // --- MOUSE_MOVE Handler ---
    const throttledMouseMoveHandler = throttle((move) => {
        const { drawingPoints, viewer } = getToolState();
        if (drawingPoints.length >= 1) {
            let cartesian;

            // *** UPDATED: Use pickPosition for more accurate mouse following ***
            // This attempts to pick on 3D content first, then terrain.
            cartesian = viewer.scene.pickPosition(move.endPosition);

            if (!Cesium.defined(cartesian)) {
                // Fallback to ellipsoid if no 3D object/terrain is picked at all
                cartesian = viewer.camera.pickEllipsoid(move.endPosition, viewer.scene.globe.ellipsoid);
            }

            if (Cesium.defined(cartesian)) {
                setToolState({ mousePosition: cartesian });
                if (drawingPoints.length >= 2) {
                    updateTemporaryAreaMeasure(isProjectedArea, [...drawingPoints, cartesian]);
                } else {
                    updateTemporaryLabel(null, '');
                }

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
    }, 50); // Keep throttle at 50ms now that picking is more accurate/consistent

    handler.setInputAction(throttledMouseMoveHandler, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    // --- Finalize Function (shared by Right-Click and Double-Click) ---
    const finishArea = async () => { // Added 'async'
        removeEventHandlers();

        const { drawingPoints, temporaryMeasureLabel, activeShape, viewer } = getToolState();

        PopupService.hide();

        if (drawingPoints.length < 3) {
            console.warn("AreaMeasureTool: Finalize triggered before enough points. Clearing drawing.");
            clearDrawing();
            return;
        }

        setToolState({ mousePosition: null });
        if (Cesium.defined(temporaryMeasureLabel)) {
            viewer.entities.remove(temporaryMeasureLabel);
            setToolState({ temporaryMeasureLabel: null });
        }

        // Finalize measurement - this is where we do the expensive, accurate terrain sampling
        await finalizeAreaMeasure(isProjectedArea, drawingPoints);

        if (Cesium.defined(activeShape)) {
            // After finalization, update the activeShape to static, accurate positions if needed.
            if (Cesium.defined(activeShape.polygon)) {
                activeShape.polygon.hierarchy = new Cesium.PolygonHierarchy(drawingPoints);
            }
            if (Cesium.defined(activeShape.polyline)) {
                activeShape.polyline.positions = [...drawingPoints, drawingPoints[0]];
            }
        }

        console.log(`Area Measure Tool: Measurement finalized.`);

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
        centerPoint = Cesium.defined(viewer.scene.globe.ellipsoid.scaleToGeodeticSurface(centroid))
            ? viewer.scene.globe.ellipsoid.scaleToGeodeticSurface(centroid)
            : centroid;
    }

    const labelOffset = new Cesium.Cartesian3(0, 0, 50);
    const labelPosition = Cesium.Cartesian3.add(centerPoint, labelOffset, new Cesium.Cartesian3());
    updateTemporaryLabel(labelPosition, `Area: ${formatArea(totalArea)}`);
}

/**
 * Finalizes the area measure, calculates total area, and adds a persistent label.
 * This function will now perform accurate terrain sampling for '3D Area Measure'.
 * @param {boolean} isProjectedArea - True for 2D projected area, false for 3D terrain-following area.
 * @param {Array<Cesium.Cartesian3>} points - All the clicked points for the polygon (from LEFT_CLICK).
 */
async function finalizeAreaMeasure(isProjectedArea, points) {
    const { viewer } = getToolState();

    if (points.length < 3 || !points.every(p => Cesium.defined(p))) {
        clearDrawing();
        PopupService.show('toolInstruction', {
            message: `Minimum 3 points are required to measure an area.`,
            title: `Area Measurement Error`,
            showDismissButton: true
        });
        console.warn("AreaMeasureTool: finalizeAreaMeasure called with insufficient points. Clearing drawing and showing error.");
        return;
    }

    const { labels } = getToolState();
    labels.forEach(label => viewer.entities.remove(label));
    setToolState({ labels: [] });

    let totalArea = 0;
    let centerPoint = Cesium.Cartesian3.ZERO;
    const finalPoints = [];

    // If it's a terrain area, sample the terrain for accurate height for final calculation.
    if (!isProjectedArea && Cesium.defined(viewer.terrainProvider) && viewer.terrainProvider.ready) {
        const cartographicPoints = points.map(p => viewer.scene.globe.ellipsoid.cartesianToCartographic(p));
        try {
            const sampledCartographics = await Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, cartographicPoints);
            sampledCartographics.forEach(c => finalPoints.push(viewer.scene.globe.ellipsoid.cartographicToCartesian(c)));
        } catch (error) {
            console.error("Error sampling terrain for area measure:", error);
            // Fallback to original points if terrain sampling fails
            finalPoints.push(...points);
        }
    } else {
        finalPoints.push(...points);
    }

    if (isProjectedArea) {
        totalArea = Cesium.PolygonPipeline.computeArea2D(finalPoints);
        const boundingSphere = Cesium.BoundingSphere.fromPoints(finalPoints);
        centerPoint = boundingSphere.center;
    } else {
        // For 3D terrain area, computeArea2D with ellipsoid for the sampled points
        totalArea = Cesium.PolygonPipeline.computeArea2D(finalPoints, viewer.scene.globe.ellipsoid);
        const centroid = Cesium.BoundingSphere.fromPoints(finalPoints).center;
        centerPoint = Cesium.defined(viewer.scene.globe.ellipsoid.scaleToGeodeticSurface(centroid))
            ? viewer.scene.globe.ellipsoid.scaleToGeodeticSurface(centroid)
            : centroid;
    }

    const labelOffset = new Cesium.Cartesian3(0, 0, 50);
    const labelPosition = Cesium.Cartesian3.add(centerPoint, labelOffset, new Cesium.Cartesian3());
    addPersistentLabel(labelPosition, `Total Area: ${formatArea(totalArea)}`);

    console.log(`AreaMeasureTool: Finalized total area: ${formatArea(totalArea)}`);
}