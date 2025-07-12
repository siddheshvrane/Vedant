// src/utils/tools/AreaMeasureTool.js
import * as Cesium from 'cesium';
import {
    clearDrawing,
    removeEventHandlers,
    addTemporaryPoint,
    addPersistentLabel,
    updateTemporaryLabel,
    formatArea,
    getToolState,
    setToolState
} from '../tool-helpers/tools-helpers.js';

export function setupAreaMeasureTool(isProjectedArea, clampShapeToGround) {
    clearDrawing();
    removeEventHandlers();

    const { handler, viewer } = getToolState();
    setToolState({ drawingPoints: [] }); // Reset drawing points specifically for this tool

    const measureType = isProjectedArea ? "3D Projected Area" : "3D Elevation Terrain Area";
    alert(`Area Measure (${measureType}): Left-click to add points. Right-click or Double-click to finish.`);

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

            if (drawingPoints.length >= 2) {
                let { activeShape } = getToolState();
                if (!activeShape) {
                    activeShape = viewer.entities.add({
                        polygon: {
                            hierarchy: new Cesium.CallbackProperty(() => {
                                const { drawingPoints, mousePosition } = getToolState();
                                const tempHierarchyPoints = [...drawingPoints];
                                if (mousePosition) {
                                    tempHierarchyPoints.push(mousePosition);
                                }
                                return new Cesium.PolygonHierarchy(tempHierarchyPoints);
                            }, false),
                            material: Cesium.Color.RED.withAlpha(0.2),
                            clampToGround: clampShapeToGround
                        },
                        polyline: { // Outline
                            positions: new Cesium.CallbackProperty(() => {
                                const { drawingPoints, mousePosition } = getToolState();
                                const positions = [...drawingPoints];
                                if (mousePosition) {
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
                    setToolState({ activeShape: activeShape }); // Update state
                }
                updateTemporaryAreaMeasure(isProjectedArea, [...drawingPoints, getToolState().mousePosition || drawingPoints[drawingPoints.length - 1]]);
            }
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    handler.setInputAction((move) => {
        const { drawingPoints, temporaryMeasureLabel } = getToolState();
        if (drawingPoints.length >= 1) {
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
                updateTemporaryAreaMeasure(isProjectedArea, tempPointsForLabel);
            } else {
                setToolState({ mousePosition: null }); // Update state
                if (temporaryMeasureLabel) {
                    viewer.entities.remove(temporaryMeasureLabel);
                    setToolState({ temporaryMeasureLabel: null }); // Update state
                }
            }
        }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    const finishArea = () => {
        removeEventHandlers();
        const { drawingPoints, temporaryMeasureLabel, activeShape, viewer } = getToolState();

        setToolState({ mousePosition: null });
        if (temporaryMeasureLabel) {
            viewer.entities.remove(temporaryMeasureLabel);
            setToolState({ temporaryMeasureLabel: null });
        }

        finalizeAreaMeasure(isProjectedArea, drawingPoints);

        if (activeShape && activeShape.polygon && activeShape.polyline) {
            activeShape.polygon.hierarchy = new Cesium.PolygonHierarchy(drawingPoints);
            activeShape.polyline.positions = [...drawingPoints, drawingPoints[0]];
        }
        console.log(`Area Measure (${measureType}) Finished.`);
    };

    handler.setInputAction(finishArea, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
    handler.setInputAction(finishArea, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
}

function updateTemporaryAreaMeasure(isProjectedArea, points) {
    const { viewer, temporaryMeasureLabel } = getToolState();

    if (points.length < 3) {
        if (temporaryMeasureLabel) {
            viewer.entities.remove(temporaryMeasureLabel);
            setToolState({ temporaryMeasureLabel: null });
        }
        return;
    }

    let totalArea = 0;
    let centerPoint = Cesium.Cartesian3.ZERO;

    if (isProjectedArea) {
        totalArea = Cesium.PolygonPipeline.computeArea2D(points);
        const boundingSphere = Cesium.BoundingSphere.fromPoints(points);
        centerPoint = boundingSphere.center;
    } else {
        totalArea = Cesium.PolygonPipeline.computeArea2D(points, viewer.scene.globe.ellipsoid);
        const centroid = Cesium.BoundingSphere.fromPoints(points).center;
        centerPoint = viewer.scene.globe.ellipsoid.scaleToGeodeticSurface(centroid);
    }

    const labelPosition = Cesium.Cartesian3.add(centerPoint, new Cesium.Cartesian3(0, 0, 50), new Cesium.Cartesian3());
    updateTemporaryLabel(labelPosition, `Area: ${formatArea(totalArea)}`);
}

function finalizeAreaMeasure(isProjectedArea, points) {
    const { viewer, labels } = getToolState();

    if (points.length < 3) {
        clearDrawing();
        alert("Minimum 3 points required for Area Measurement.");
        return;
    }

    labels.forEach(label => viewer.entities.remove(label));
    setToolState({ labels: [] });

    let totalArea = 0;
    let centerPoint = Cesium.Cartesian3.ZERO;

    if (isProjectedArea) {
        totalArea = Cesium.PolygonPipeline.computeArea2D(points);
        const boundingSphere = Cesium.BoundingSphere.fromPoints(points);
        centerPoint = boundingSphere.center;
    } else {
        totalArea = Cesium.PolygonPipeline.computeArea2D(points, viewer.scene.globe.ellipsoid);
        const centroid = Cesium.BoundingSphere.fromPoints(points).center;
        centerPoint = viewer.scene.globe.ellipsoid.scaleToGeodeticSurface(centroid);
    }

    const labelPosition = Cesium.Cartesian3.add(centerPoint, new Cesium.Cartesian3(0, 0, 50), new Cesium.Cartesian3());
    addPersistentLabel(labelPosition, `Total Area: ${formatArea(totalArea)}`);
}