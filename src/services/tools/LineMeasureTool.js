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
import { PopupService } from '../../services/PopupService.js';

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

    const toolName = isDisplacement ? "3D Displacement Line" : "3D Terrain Line";
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

            // *** UPDATED: Use pickPosition for more accurate mouse following ***
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
    }, 50); // Keep throttle at 50ms, now that picking is more accurate/consistent

    handler.setInputAction(throttledMouseMoveHandler, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    // --- RIGHT_CLICK Handler (Finalize) ---
    handler.setInputAction(async () => { // Added 'async' because finalizeLineMeasure will be async
        removeEventHandlers();

        const { drawingPoints, temporaryMeasureLabel, activeShape, viewer } = getToolState();

        PopupService.hide();

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

        // Finalize measurement - this is where we do the expensive, accurate terrain sampling
        await finalizeLineMeasure(isDisplacement, drawingPoints);

        if (Cesium.defined(activeShape) && Cesium.defined(activeShape.polyline)) {
            // After finalization, update the activeShape to static, accurate positions if needed.
            // For clampToGround, this means ensuring it's on the terrain.
            // If finalizeLineMeasure returns sampled points, update here.
            activeShape.polyline.positions = drawingPoints; // Assuming drawingPoints are now finalized
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
 * This function will now perform accurate terrain sampling for '3D Terrain Line'.
 * @param {boolean} isDisplacement - Whether to calculate 2D Cartesian distance or 3D surface distance.
 * @param {Array<Cesium.Cartesian3>} points - All the clicked points for the line (from LEFT_CLICK).
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
        return;
    }

    const { labels } = getToolState();
    labels.forEach(label => viewer.entities.remove(label));
    setToolState({ labels: [] });

    let totalDistance = 0;
    const finalPoints = []; // To store potentially terrain-sampled points

    // If it's a terrain line, sample the terrain for accurate height.
    // This is the potentially expensive but accurate part.
    if (!isDisplacement && Cesium.defined(viewer.terrainProvider) && viewer.terrainProvider.ready) {
        const cartographicPoints = points.map(p => viewer.scene.globe.ellipsoid.cartesianToCartographic(p));
        // Sample terrain along the path between the clicked points
        try {
            // For a line, sampling *between* points is crucial for accurate terrain distance.
            // This is a simplified approach; for truly accurate paths, you might need
            // to interpolate more points and then sample.
            // For now, let's just ensure the clicked points themselves have accurate heights.
            const sampledCartographics = await Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, cartographicPoints);
            sampledCartographics.forEach(c => finalPoints.push(viewer.scene.globe.ellipsoid.cartographicToCartesian(c)));
        } catch (error) {
            console.error("Error sampling terrain for line measure:", error);
            // Fallback to original points if terrain sampling fails
            finalPoints.push(...points);
        }
    } else {
        // For displacement or if no terrain is available/ready
        finalPoints.push(...points);
    }

    // Now calculate total distance using the (potentially sampled) finalPoints
    for (let i = 0; i < finalPoints.length - 1; i++) {
        const lastPosition = finalPoints[i];
        const currentPosition = finalPoints[i + 1];
        let segmentDistance;

        if (isDisplacement) {
            segmentDistance = Cesium.Cartesian3.distance(lastPosition, currentPosition);
        } else {
            // For terrain, calculate geodesic distance using the sampled points
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

    console.log(`LineMeasureTool: Finalized total distance: ${formatDistance(totalDistance)}`);
}