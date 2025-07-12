// src/utils/tools/LineMeasureTool.js
import * as Cesium from 'cesium';
import {
    clearDrawing,
    removeEventHandlers,
    addTemporaryPoint,
    addPersistentLabel,
    updateTemporaryLabel,
    formatDistance,
    getToolState,
    setToolState // Import setter to update drawingPoints and activeShape
} from '../tool-helpers/tools-helpers.js';
import { PopupService } from '../../services/PopupService.js'; // IMPORTANT: Import PopupService

export function setupLineMeasureTool(isDisplacement, clampShapeToGround) {
    clearDrawing();
    removeEventHandlers();

    const { handler, viewer } = getToolState();
    setToolState({ drawingPoints: [] }); // Reset drawing points specifically for this tool

    // --- MODIFIED: Simplify title for Line Measure ---
    const toolTitle = isDisplacement ? "2D Line Measure" : "3D Line Measure"; // Changed for clarity, will be simplified below
    const displayTitle = toolTitle.replace(/\s*\(.*?\)/g, ''); // Remove content in parentheses
    
    PopupService.showToolInstruction(
        `Left-click to add points. Right-click to finish.`,
        displayTitle // Use the simplified title
    );
    // --- END MODIFIED ---

    handler.setInputAction((click) => {
        let cartesian;
        if (clampShapeToGround) {
            const ray = viewer.camera.getPickRay(click.position);
            cartesian = viewer.scene.globe.pick(ray, viewer.scene);
        } else {
            cartesian = viewer.scene.pickPosition(click.position);
        }

        if (cartesian) {
            const { drawingPoints } = getToolState();
            drawingPoints.push(cartesian);
            addTemporaryPoint(cartesian);
            setToolState({ drawingPoints: drawingPoints }); // Update state

            if (drawingPoints.length === 1) {
                const activeShape = viewer.entities.add({
                    polyline: {
                        positions: new Cesium.CallbackProperty(() => {
                            const { drawingPoints, mousePosition } = getToolState();
                            const positions = [...drawingPoints];
                            if (mousePosition) {
                                positions.push(mousePosition);
                            }
                            return positions;
                        }, false),
                        width: 3,
                        material: Cesium.Color.RED,
                        clampToGround: clampShapeToGround
                    }
                });
                setToolState({ activeShape: activeShape }); // Update state
            } else {
                const lastTwoPoints = [drawingPoints[drawingPoints.length - 2], drawingPoints[drawingPoints.length - 1]];
                updateLineMeasureSegment(isDisplacement, lastTwoPoints);
            }
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    handler.setInputAction((move) => {
        const { drawingPoints, temporaryMeasureLabel } = getToolState();
        if (drawingPoints.length > 0) {
            let cartesian;
            if (clampShapeToGround) {
                const ray = viewer.camera.getPickRay(move.endPosition);
                cartesian = viewer.scene.globe.pick(ray, viewer.scene);
            } else {
                cartesian = viewer.scene.pickPosition(move.endPosition);
            }

            if (cartesian) {
                setToolState({ mousePosition: cartesian }); // Update state
                const tempPointsForLabel = [...drawingPoints, cartesian];
                updateTemporaryLineMeasure(isDisplacement, tempPointsForLabel);
            } else {
                setToolState({ mousePosition: null }); // Update state
                if (temporaryMeasureLabel) {
                    viewer.entities.remove(temporaryMeasureLabel);
                    setToolState({ temporaryMeasureLabel: null }); // Update state
                }
            }
        }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    handler.setInputAction(() => {
        removeEventHandlers();
        const { drawingPoints, temporaryMeasureLabel, activeShape, viewer } = getToolState();

        setToolState({ mousePosition: null });
        if (temporaryMeasureLabel) {
            viewer.entities.remove(temporaryMeasureLabel);
            setToolState({ temporaryMeasureLabel: null });
        }

        finalizeLineMeasure(isDisplacement, drawingPoints);

        if (activeShape && activeShape.polyline) {
            activeShape.polyline.positions = drawingPoints;
        }
        // Removed console.log that used original measureType
        console.log(`Line Measure Finished.`);
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
}

function updateLineMeasureSegment(isDisplacement, segmentPoints) {
    const { viewer } = getToolState();
    if (segmentPoints.length < 2) return;
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
    addPersistentLabel(midPoint, formatDistance(segmentDistance));
}

function updateTemporaryLineMeasure(isDisplacement, allPointsIncludingMouse) {
    const { viewer } = getToolState();
    if (allPointsIncludingMouse.length < 2) return;
    const lastPosition = allPointsIncludingMouse[allPointsIncludingMouse.length - 2];
    const currentPosition = allPointsIncludingMouse[allPointsIncludingMouse.length - 1];
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

function finalizeLineMeasure(isDisplacement, points) {
    const { viewer, labels } = getToolState();
    if (points.length < 2) return;

    labels.forEach(label => viewer.entities.remove(label));
    setToolState({ labels: [] }); // Clear labels array in state

    let totalDistance = 0;
    for (let i = 0; i < points.length - 1; i++) {
        const lastPosition = points[i];
        const currentPosition = points[i + 1];
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
    const lastPoint = points[points.length - 1];
    const labelPosition = Cesium.Cartesian3.add(lastPoint, new Cesium.Cartesian3(0, 0, 50), new Cesium.Cartesian3());
    addPersistentLabel(labelPosition, `Total: ${formatDistance(totalDistance)}`);
}