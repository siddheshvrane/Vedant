// src/services/ToolManagementService.js
import { Subject, BehaviorSubject } from 'rxjs';
import * as Cesium from 'cesium';
import { MapService } from './MapService.js'; // Ensure correct path

// Helper function for formatting distances
function formatDistance(meters) {
    if (meters < 1000) {
        return `${meters.toFixed(2)} m`;
    } else {
        return `${(meters / 1000).toFixed(2)} km`;
    }
}

// Helper function for formatting areas, ALWAYS in km^2
function formatArea(sqMeters) {
    // Convert square meters to square kilometers, ensuring precision for smaller values
    return `${(sqMeters / 1000000).toFixed(6)} km²`;
}

class ToolManagementServiceClass {
    activeTool$ = new BehaviorSubject(null); // Stores the name of the active tool
    privateViewer = null; // Cesium Viewer instance

    // Internals for drawing tools
    privateHandler = null; // ScreenSpaceEventHandler
    privateDrawingPoints = []; // Array of Cesium.Cartesian3 (clicked points)
    privateActiveShape = null; // The temporary polyline/polygon entity
    privateLabels = []; // Array of *persistent* label entities (segment lengths, total length, final area)
    privatePoints = []; // Array of point entities

    // Dedicated variable for the *single, dynamic* label shown during mouse move
    privateTemporaryMeasureLabel = null;
    // Variable to store the current mouse position for rubber-banding
    privateMousePosition = null;

    privateGroundPolyline = null; // Specific for Terrain Profile
    privateViewshieldPolylines = []; // For Viewshield Analysis segments

    constructor() {
        // Subscribe to MapService to get the Cesium viewer instance
        MapService.globeViewer$.subscribe(viewer => {
            this.privateViewer = viewer;
            if (viewer) {
                console.log("ToolManagementService: Received Cesium Viewer instance.");
                if (!this.privateHandler) {
                    this.privateHandler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
                }
            } else {
                this.deactivateCurrentTool();
                if (this.privateHandler) {
                    this.privateHandler.destroy();
                    this.privateHandler = null;
                }
            }
        });
    }

    /**
     * Activates a specific tool and deactivates any currently active one.
     * @param {string} toolName - The name of the tool to activate.
     */
    activateTool(toolName) {
        if (!this.privateViewer) {
            console.warn("ToolManagementService: Cesium Viewer not available. Cannot activate tool.");
            return;
        }

        // Toggle behavior: if the same tool is clicked, deactivate it
        if (this.activeTool$.getValue() === toolName) {
            this.deactivateCurrentTool();
            return;
        }

        // Deactivate current tool if different
        this.deactivateCurrentTool();

        // Activate the new tool
        this.activeTool$.next(toolName);
        console.log(`ToolManagementService: Activating tool: ${toolName}`);

        switch (toolName) {
            case 'Line Measure': // User wants this to be 3D Displacement
                this.setupLineMeasureTool(true, false); // isDisplacement = true, clampShapeToGround = false
                break;
            case '3D Line Measure': // User wants this to be 3D Elevation Terrain Following
                this.setupLineMeasureTool(false, true); // isDisplacement = false, clampShapeToGround = true
                break;
            case 'Area Measure': // User wants this to be 3D Projected Area
                this.setupAreaMeasureTool(true, false); // isProjectedArea = true, clampShapeToGround = false
                break;
            case '3D Area Measure': // User wants this to be 3D Elevation Terrain Following Area
                this.setupAreaMeasureTool(false, true); // isProjectedArea = false, clampToGround = true
                break;
            case 'Viewshield Analysis':
                this.setupViewshieldAnalysisTool();
                break;
            case 'Terrain Profile':
                this.setupTerrainProfileTool();
                break;
            default:
                console.warn(`ToolManagementService: Unknown tool requested: ${toolName}`);
                this.deactivateCurrentTool();
                break;
        }
    }

    /**
     * Deactivates the currently active tool and cleans up its resources.
     */
    deactivateCurrentTool() {
        const activeTool = this.activeTool$.getValue();
        if (activeTool) {
            console.log(`ToolManagementService: Deactivating tool: ${activeTool}`);
            this.clearDrawing();
            this.removeEventHandlers();
        }
        this.activeTool$.next(null);
    }

    removeEventHandlers() {
        if (this.privateHandler) {
            this.privateHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
            this.privateHandler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
            this.privateHandler.removeInputAction(Cesium.ScreenSpaceEventType.RIGHT_CLICK);
            this.privateHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
        }
    }

    clearDrawing() {
        if (this.privateViewer) {
            this.privatePoints.forEach(entity => this.privateViewer.entities.remove(entity));
            this.privateLabels.forEach(entity => this.privateViewer.entities.remove(entity)); // Clear persistent labels
            if (this.privateTemporaryMeasureLabel) { // Clear the temporary label
                this.privateViewer.entities.remove(this.privateTemporaryMeasureLabel);
                this.privateTemporaryMeasureLabel = null;
            }
            if (this.privateActiveShape) {
                this.privateViewer.entities.remove(this.privateActiveShape);
            }
            if (this.privateGroundPolyline) {
                this.privateViewer.entities.remove(this.privateGroundPolyline);
                this.privateGroundPolyline = null;
            }
            // Clear Viewshield specific polylines
            this.privateViewshieldPolylines.forEach(entity => this.privateViewer.entities.remove(entity));
            this.privateViewshieldPolylines = [];
        }
        this.privateDrawingPoints = [];
        this.privateActiveShape = null;
        this.privateLabels = []; // Reset array
        this.privatePoints = [];
        this.privateMousePosition = null; // Reset mouse position

        // Hide terrain profile panel
        const panel = document.getElementById('terrainProfilePanel');
        if (panel) {
            panel.style.display = 'none';
        }
    }

    addTemporaryPoint(position) {
        if (!this.privateViewer) return;
        const point = this.privateViewer.entities.add({
            position: position,
            point: {
                pixelSize: 8,
                color: Cesium.Color.YELLOW,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 2,
                disableDepthTestDistance: Number.POSITIVE_INFINITY
            },
        });
        this.privatePoints.push(point);
    }

    addPersistentLabel(position, text) {
        if (!this.privateViewer) return;
        const label = this.privateViewer.entities.add({
            position: position,
            label: {
                text: text,
                font: '14pt Poppins',
                fillColor: Cesium.Color.WHITE,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 2,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -10),
                disableDepthTestDistance: Number.POSITIVE_INFINITY
            },
        });
        this.privateLabels.push(label);
    }

    // Helper to add or update the *single* temporary label
    updateTemporaryLabel(position, text) {
        if (!this.privateViewer) return;
        if (this.privateTemporaryMeasureLabel) {
            this.privateViewer.entities.remove(this.privateTemporaryMeasureLabel);
        }
        this.privateTemporaryMeasureLabel = this.privateViewer.entities.add({
            position: position,
            label: {
                text: text,
                font: '14pt Poppins',
                fillColor: Cesium.Color.CYAN, // Different color for temporary label
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 2,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -10),
                disableDepthTestDistance: Number.POSITIVE_INFINITY
            },
        });
    }

    // --- Line Measure Tool ---
    setupLineMeasureTool(isDisplacement, clampShapeToGround) {
        this.clearDrawing();
        this.removeEventHandlers();
        let handler = this.privateHandler;
        let viewer = this.privateViewer;

        const measureType = isDisplacement ? "3D Displacement" : "3D Elevation Terrain (Geodesic)";
        alert(`Line Measure (${measureType}): Left-click to add points. Right-click to finish.`);

        handler.setInputAction((click) => {
            let cartesian;
            if (clampShapeToGround) {
                const ray = viewer.camera.getPickRay(click.position);
                cartesian = viewer.scene.globe.pick(ray, viewer.scene);
            } else {
                cartesian = viewer.scene.pickPosition(click.position);
            }

            if (cartesian) {
                this.privateDrawingPoints.push(cartesian);
                this.addTemporaryPoint(cartesian);

                if (this.privateDrawingPoints.length === 1) {
                    this.privateActiveShape = viewer.entities.add({
                        polyline: {
                            positions: new Cesium.CallbackProperty(() => {
                                const positions = [...this.privateDrawingPoints];
                                if (this.privateMousePosition) {
                                    positions.push(this.privateMousePosition);
                                }
                                return positions;
                            }, false),
                            width: 3,
                            material: Cesium.Color.RED,
                            clampToGround: clampShapeToGround
                        }
                    });
                } else {
                    const lastTwoPoints = [this.privateDrawingPoints[this.privateDrawingPoints.length - 2], this.privateDrawingPoints[this.privateDrawingPoints.length - 1]];
                    this.updateLineMeasureSegment(isDisplacement, lastTwoPoints);
                }
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        handler.setInputAction((move) => {
            if (this.privateDrawingPoints.length > 0) {
                let cartesian;
                if (clampShapeToGround) {
                    const ray = viewer.camera.getPickRay(move.endPosition);
                    cartesian = viewer.scene.globe.pick(ray, viewer.scene);
                } else {
                    cartesian = viewer.scene.pickPosition(move.endPosition);
                }

                if (cartesian) {
                    this.privateMousePosition = cartesian;
                    const tempPointsForLabel = [...this.privateDrawingPoints, cartesian];
                    this.updateTemporaryLineMeasure(isDisplacement, tempPointsForLabel);
                } else {
                    this.privateMousePosition = null;
                    if (this.privateTemporaryMeasureLabel) {
                        this.privateViewer.entities.remove(this.privateTemporaryMeasureLabel);
                        this.privateTemporaryMeasureLabel = null;
                    }
                }
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        handler.setInputAction(() => {
            this.removeEventHandlers();
            this.privateMousePosition = null;
            if (this.privateTemporaryMeasureLabel) {
                this.privateViewer.entities.remove(this.privateTemporaryMeasureLabel);
                this.privateTemporaryMeasureLabel = null;
            }
            this.finalizeLineMeasure(isDisplacement, this.privateDrawingPoints);
            if (this.privateActiveShape && this.privateActiveShape.polyline) {
                this.privateActiveShape.polyline.positions = this.privateDrawingPoints;
            }
            console.log(`Line Measure (${measureType}) Finished.`);
        }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
    }

    updateLineMeasureSegment(isDisplacement, segmentPoints) {
        if (segmentPoints.length < 2) return;
        let segmentDistance;
        const lastPosition = segmentPoints[0];
        const currentPosition = segmentPoints[1];
        if (isDisplacement) {
            segmentDistance = Cesium.Cartesian3.distance(lastPosition, currentPosition);
        } else {
            const carto1 = this.privateViewer.scene.globe.ellipsoid.cartesianToCartographic(lastPosition);
            const carto2 = this.privateViewer.scene.globe.ellipsoid.cartesianToCartographic(currentPosition);
            const geodesic = new Cesium.EllipsoidGeodesic(carto1, carto2);
            segmentDistance = geodesic.surfaceDistance;
        }
        const midPoint = Cesium.Cartesian3.midpoint(lastPosition, currentPosition, new Cesium.Cartesian3());
        this.addPersistentLabel(midPoint, formatDistance(segmentDistance));
    }

    updateTemporaryLineMeasure(isDisplacement, allPointsIncludingMouse) {
        if (allPointsIncludingMouse.length < 2) return;
        const lastPosition = allPointsIncludingMouse[allPointsIncludingMouse.length - 2];
        const currentPosition = allPointsIncludingMouse[allPointsIncludingMouse.length - 1];
        let segmentDistance;
        if (isDisplacement) {
            segmentDistance = Cesium.Cartesian3.distance(lastPosition, currentPosition);
        } else {
            const carto1 = this.privateViewer.scene.globe.ellipsoid.cartesianToCartographic(lastPosition);
            const carto2 = this.privateViewer.scene.globe.ellipsoid.cartesianToCartographic(currentPosition);
            const geodesic = new Cesium.EllipsoidGeodesic(carto1, carto2);
            segmentDistance = geodesic.surfaceDistance;
        }
        const midPoint = Cesium.Cartesian3.midpoint(lastPosition, currentPosition, new Cesium.Cartesian3());
        this.updateTemporaryLabel(midPoint, formatDistance(segmentDistance));
    }

    finalizeLineMeasure(isDisplacement, points) {
        if (points.length < 2) return;
        this.privateLabels.forEach(label => this.privateViewer.entities.remove(label));
        this.privateLabels = [];
        let totalDistance = 0;
        for (let i = 0; i < points.length - 1; i++) {
            const lastPosition = points[i];
            const currentPosition = points[i + 1];
            let segmentDistance;
            if (isDisplacement) {
                segmentDistance = Cesium.Cartesian3.distance(lastPosition, currentPosition);
            } else {
                const carto1 = this.privateViewer.scene.globe.ellipsoid.cartesianToCartographic(lastPosition);
                const carto2 = this.privateViewer.scene.globe.ellipsoid.cartesianToCartographic(currentPosition);
                const geodesic = new Cesium.EllipsoidGeodesic(carto1, carto2);
                segmentDistance = geodesic.surfaceDistance;
            }
            totalDistance += segmentDistance;
            const midPoint = Cesium.Cartesian3.midpoint(lastPosition, currentPosition, new Cesium.Cartesian3());
            this.addPersistentLabel(midPoint, formatDistance(segmentDistance));
        }
        const lastPoint = points[points.length - 1];
        const labelPosition = Cesium.Cartesian3.add(lastPoint, new Cesium.Cartesian3(0, 0, 50), new Cesium.Cartesian3());
        this.addPersistentLabel(labelPosition, `Total: ${formatDistance(totalDistance)}`);
    }

    // --- Area Measure Tool ---
    setupAreaMeasureTool(isProjectedArea, clampShapeToGround) {
        this.clearDrawing();
        this.removeEventHandlers();
        let handler = this.privateHandler;
        let viewer = this.privateViewer;

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
                this.privateDrawingPoints.push(cartesian);
                this.addTemporaryPoint(cartesian);

                if (this.privateDrawingPoints.length >= 2) {
                    if (!this.privateActiveShape) {
                        this.privateActiveShape = viewer.entities.add({
                            polygon: {
                                hierarchy: new Cesium.CallbackProperty(() => {
                                    const tempHierarchyPoints = [...this.privateDrawingPoints];
                                    if (this.privateMousePosition) {
                                        tempHierarchyPoints.push(this.privateMousePosition);
                                    }
                                    return new Cesium.PolygonHierarchy(tempHierarchyPoints);
                                }, false),
                                material: Cesium.Color.RED.withAlpha(0.2),
                                clampToGround: clampShapeToGround
                            },
                            polyline: { // Outline
                                positions: new Cesium.CallbackProperty(() => {
                                    const positions = [...this.privateDrawingPoints];
                                    if (this.privateMousePosition) {
                                        positions.push(this.privateMousePosition);
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
                    }
                    this.updateTemporaryAreaMeasure(isProjectedArea, [...this.privateDrawingPoints, this.privateMousePosition || this.privateDrawingPoints[this.privateDrawingPoints.length - 1]]);
                }
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        handler.setInputAction((move) => {
            if (this.privateDrawingPoints.length >= 1) {
                let cartesian;
                if (clampShapeToGround) {
                    const ray = viewer.camera.getPickRay(move.endPosition);
                    cartesian = viewer.scene.globe.pick(ray, viewer.scene);
                } else {
                    cartesian = viewer.scene.pickPosition(move.endPosition);
                }

                if (cartesian) {
                    this.privateMousePosition = cartesian;
                    const tempPointsForLabel = [...this.privateDrawingPoints, cartesian];
                    this.updateTemporaryAreaMeasure(isProjectedArea, tempPointsForLabel);
                } else {
                    this.privateMousePosition = null;
                    if (this.privateTemporaryMeasureLabel) {
                        this.privateViewer.entities.remove(this.privateTemporaryMeasureLabel);
                        this.privateTemporaryMeasureLabel = null;
                    }
                }
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        const finishArea = () => {
            this.removeEventHandlers();
            this.privateMousePosition = null;
            if (this.privateTemporaryMeasureLabel) {
                this.privateViewer.entities.remove(this.privateTemporaryMeasureLabel);
                this.privateTemporaryMeasureLabel = null;
            }
            this.finalizeAreaMeasure(isProjectedArea, this.privateDrawingPoints);
            if (this.privateActiveShape && this.privateActiveShape.polygon && this.privateActiveShape.polyline) {
                this.privateActiveShape.polygon.hierarchy = new Cesium.PolygonHierarchy(this.privateDrawingPoints);
                this.privateActiveShape.polyline.positions = [...this.privateDrawingPoints, this.privateDrawingPoints[0]];
            }
            console.log(`Area Measure (${measureType}) Finished.`);
        };

        handler.setInputAction(finishArea, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
        handler.setInputAction(finishArea, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    }

    updateTemporaryAreaMeasure(isProjectedArea, points) {
        if (points.length < 3) {
            if (this.privateTemporaryMeasureLabel) {
                this.privateViewer.entities.remove(this.privateTemporaryMeasureLabel);
                this.privateTemporaryMeasureLabel = null;
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
            totalArea = Cesium.PolygonPipeline.computeArea2D(points, this.privateViewer.scene.globe.ellipsoid);
            const centroid = Cesium.BoundingSphere.fromPoints(points).center;
            centerPoint = this.privateViewer.scene.globe.ellipsoid.scaleToGeodeticSurface(centroid);
        }

        const labelPosition = Cesium.Cartesian3.add(centerPoint, new Cesium.Cartesian3(0, 0, 50), new Cesium.Cartesian3());
        this.updateTemporaryLabel(labelPosition, `Area: ${formatArea(totalArea)}`);
    }

    finalizeAreaMeasure(isProjectedArea, points) {
        if (points.length < 3) {
            this.clearDrawing();
            alert("Minimum 3 points required for Area Measurement.");
            return;
        }

        this.privateLabels.forEach(label => this.privateViewer.entities.remove(label));
        this.privateLabels = [];

        let totalArea = 0;
        let centerPoint = Cesium.Cartesian3.ZERO;

        if (isProjectedArea) {
            totalArea = Cesium.PolygonPipeline.computeArea2D(points);
            const boundingSphere = Cesium.BoundingSphere.fromPoints(points);
            centerPoint = boundingSphere.center;
        } else {
            totalArea = Cesium.PolygonPipeline.computeArea2D(points, this.privateViewer.scene.globe.ellipsoid);
            const centroid = Cesium.BoundingSphere.fromPoints(points).center;
            centerPoint = this.privateViewer.scene.globe.ellipsoid.scaleToGeodeticSurface(centroid);
        }

        const labelPosition = Cesium.Cartesian3.add(centerPoint, new Cesium.Cartesian3(0, 0, 50), new Cesium.Cartesian3());
        this.addPersistentLabel(labelPosition, `Total Area: ${formatArea(totalArea)}`);
    }

    // --- Viewshield Analysis Tool (Enhanced) ---
    setupViewshieldAnalysisTool() {
        this.clearDrawing();
        this.removeEventHandlers();
        let handler = this.privateHandler;
        let viewer = this.privateViewer;

        alert("Viewshield Analysis: Left-click to define an Observer point. Then left-click for a Target point. The line will show visible (green) and obstructed (red) segments. Right-click to clear.");
        console.warn("Viewshield Analysis: This provides a visual line-of-sight analysis with color-coded segments.");

        let observerPoint = null;
        let targetPoint = null;

        handler.setInputAction((click) => {
            const cartesian = viewer.scene.pickPosition(click.position); // Always pick 3D position for LOS
            if (cartesian) {
                if (!observerPoint) {
                    observerPoint = cartesian;
                    this.addTemporaryPoint(observerPoint);
                    this.addPersistentLabel(observerPoint, "Observer");
                } else if (!targetPoint) {
                    targetPoint = cartesian;
                    this.addTemporaryPoint(targetPoint);
                    this.addPersistentLabel(targetPoint, "Target");

                    this.analyzeLineOfSight(observerPoint, targetPoint);

                    alert("Target point set. Right-click to clear analysis.");
                }
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        handler.setInputAction(() => {
            this.clearDrawing();
            observerPoint = null;
            targetPoint = null;
            this.removeEventHandlers();
            console.log("Viewshield Analysis cleared.");
            alert("Viewshield Analysis cleared. Click to define new observer point.");
            this.activeTool$.next(null);
        }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
    }

    async analyzeLineOfSight(observerPoint, targetPoint) {
        if (!this.privateViewer || !observerPoint || !targetPoint) return;

        // Clear previous LOS segments
        this.privateViewshieldPolylines.forEach(entity => this.privateViewer.entities.remove(entity));
        this.privateViewshieldPolylines = [];

        const numberOfSamples = 200; // More samples for smoother, more accurate visibility segments
        const samplePoints = [];
        for (let i = 0; i <= numberOfSamples; i++) {
            const interpolated = Cesium.Cartesian3.lerp(observerPoint, targetPoint, i / numberOfSamples, new Cesium.Cartesian3());
            samplePoints.push(interpolated);
        }

        try {
            // Get terrain heights for all interpolated points
            const clampedSampledPoints = await this.privateViewer.scene.clampToGround(samplePoints);

            const observerCarto = this.privateViewer.scene.globe.ellipsoid.cartesianToCartographic(observerPoint);
            let currentSegmentStart = observerPoint;
            let currentSegmentColor = Cesium.Color.LIMEGREEN; // Assume visible initially
            let currentSegmentPositions = [observerPoint];
            let isOverallVisible = true;
            const LOS_TOLERANCE_METERS = 1.0; // Tolerance for obstruction detection

            for (let i = 1; i < clampedSampledPoints.length; i++) {
                const currentSampledPoint = clampedSampledPoints[i];
                const previousSampledPoint = clampedSampledPoints[i - 1]; // To calculate segment midpoint for color change

                // Calculate the expected height on the direct line of sight from observer to current point
                const distanceAlongLine = Cesium.Cartesian3.distance(observerPoint, currentSampledPoint);
                const totalDirectDistance = Cesium.Cartesian3.distance(observerPoint, targetPoint);
                const targetCartoHeight = this.privateViewer.scene.globe.ellipsoid.cartesianToCartographic(targetPoint).height;

                let expectedLOSHeight;
                if (totalDirectDistance === 0) { // Avoid division by zero if observer and target are same
                    expectedLOSHeight = observerCarto.height;
                } else {
                    expectedLOSHeight = observerCarto.height + (targetCartoHeight - observerCarto.height) * (distanceAlongLine / totalDirectDistance);
                }


                const currentTerrainHeight = this.privateViewer.scene.globe.ellipsoid.cartesianToCartographic(currentSampledPoint).height;

                const isObstructed = currentTerrainHeight > expectedLOSHeight + LOS_TOLERANCE_METERS;

                if (isObstructed && currentSegmentColor === Cesium.Color.LIMEGREEN) {
                    // Visible segment just ended, draw it
                    // Push the point *just before* obstruction
                    currentSegmentPositions.push(Cesium.Cartesian3.lerp(previousSampledPoint, currentSampledPoint, 0.01, new Cesium.Cartesian3()));
                    this.drawViewshieldSegment(currentSegmentPositions, currentSegmentColor);
                    isOverallVisible = false; // Mark overall as obstructed

                    // Start new obstructed segment
                    currentSegmentStart = currentSampledPoint;
                    currentSegmentColor = Cesium.Color.RED;
                    currentSegmentPositions = [currentSegmentStart];
                } else if (!isObstructed && currentSegmentColor === Cesium.Color.RED) {
                    // Obstructed segment just ended, draw it
                    // Push the point *just before* clearing
                    currentSegmentPositions.push(Cesium.Cartesian3.lerp(previousSampledPoint, currentSampledPoint, 0.01, new Cesium.Cartesian3()));
                    this.drawViewshieldSegment(currentSegmentPositions, currentSegmentColor);

                    // Start new visible segment
                    currentSegmentStart = currentSampledPoint;
                    currentSegmentColor = Cesium.Color.LIMEGREEN;
                    currentSegmentPositions = [currentSegmentStart];
                }
                currentSegmentPositions.push(currentSampledPoint);
            }
            // Draw the last segment
            this.drawViewshieldSegment(currentSegmentPositions, currentSegmentColor);

            const midPoint = Cesium.Cartesian3.midpoint(observerPoint, targetPoint, new Cesium.Cartesian3());
            this.addPersistentLabel(midPoint, `Overall Visibility: ${isOverallVisible ? "Visible" : "Obstructed"}`);

        } catch (error) {
            console.error("Error during Viewshield Analysis:", error);
            // Draw a single orange line to indicate error
            this.drawViewshieldSegment([observerPoint, targetPoint], Cesium.Color.ORANGE);
            const midPoint = Cesium.Cartesian3.midpoint(observerPoint, targetPoint, new Cesium.Cartesian3());
            this.addPersistentLabel(midPoint, `Visibility: Error`);
        }
    }

    drawViewshieldSegment(positions, color) {
        if (positions.length < 2) return;
        const segmentEntity = this.privateViewer.entities.add({
            polyline: {
                positions: positions,
                width: 3,
                material: color,
                clampToGround: false // Line of sight is 3D
            }
        });
        this.privateViewshieldPolylines.push(segmentEntity);
    }

    // --- Terrain Profile Tool (Enhanced) ---
    setupTerrainProfileTool() {
        this.clearDrawing();
        this.removeEventHandlers();
        let handler = this.privateHandler;
        let viewer = this.privateViewer;

        alert("Terrain Profile: Left-click to define start and end points of a profile line. Right-click to clear. The profile will appear in a panel.");
        console.warn("Terrain Profile tool will now display a basic profile in an HTML panel.");

        let startPoint = null;
        let endPoint = null;

        handler.setInputAction((click) => {
            const cartesian = viewer.scene.pickPosition(click.position); // Pick 3D position
            if (cartesian) {
                if (!startPoint) {
                    startPoint = cartesian;
                    this.addTemporaryPoint(startPoint);
                    this.addPersistentLabel(startPoint, "Start");
                } else if (!endPoint) {
                    endPoint = cartesian;
                    this.addTemporaryPoint(endPoint);
                    this.addPersistentLabel(endPoint, "End");

                    this.privateGroundPolyline = viewer.entities.add({
                        polyline: {
                            positions: [startPoint, endPoint],
                            width: 3,
                            material: Cesium.Color.GREEN,
                            clampToGround: true // Profile line should follow terrain
                        }
                    });

                    this.generateTerrainProfile(startPoint, endPoint);

                    alert("End point set. Right-click to clear.");
                }
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        handler.setInputAction(() => {
            this.clearDrawing();
            startPoint = null;
            endPoint = null;
            this.removeEventHandlers();
            console.log("Terrain Profile cleared.");
            alert("Terrain Profile cleared. Click to define new profile line.");
            this.activeTool$.next(null);
        }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
    }

    async generateTerrainProfile(startPoint, endPoint) {
        if (!this.privateViewer || !startPoint || !endPoint) return;

        const numberOfSamples = 200; // More samples for a smoother profile
        const interpolatedPositions = [];

        for (let i = 0; i <= numberOfSamples; i++) {
            const ratio = i / numberOfSamples;
            const interpolated = Cesium.Cartesian3.lerp(startPoint, endPoint, ratio, new Cesium.Cartesian3());
            interpolatedPositions.push(interpolated);
        }

        try {
            const clampedPositions = await this.privateViewer.scene.clampToGround(interpolatedPositions);

            const profileData = clampedPositions.map((pos) => {
                const carto = this.privateViewer.scene.globe.ellipsoid.cartesianToCartographic(pos);
                // Calculate horizontal distance from the start point (on the ellipsoid surface)
                const startCarto = this.privateViewer.scene.globe.ellipsoid.cartesianToCartographic(startPoint);
                const currentCarto = this.privateViewer.scene.globe.ellipsoid.cartesianToCartographic(pos);
                const geodesic = new Cesium.EllipsoidGeodesic(startCarto, currentCarto);
                const horizontalDistance = geodesic.surfaceDistance;

                return {
                    distance: horizontalDistance,
                    elevation: carto.height
                };
            });

            console.log("Terrain Profile Data (Horizontal Distance, Elevation):", profileData);
            this.displayTerrainProfileInPanel(profileData);

        } catch (error) {
            console.error("Error generating terrain profile:", error);
            alert("Error generating terrain profile: Could not sample terrain heights.");
            // Hide the panel if there's an error
            const panel = document.getElementById('terrainProfilePanel');
            if (panel) {
                panel.style.display = 'none';
            }
        }
    }

    displayTerrainProfileInPanel(profileData) {
        const panel = document.getElementById('terrainProfilePanel');
        const chartDataContainer = document.getElementById('profileChartData');

        if (!panel || !chartDataContainer) {
            console.error("Terrain profile panel or data container not found in HTML.");
            return;
        }

        let htmlContent = '<p><strong>Distance (m) - Elevation (m)</strong></p>';
        htmlContent += '<div style="max-height: 250px; overflow-y: auto; border: 1px solid #777; padding: 5px; background: rgba(0,0,0,0.5);"><ul>';
        profileData.forEach(point => {
            htmlContent += `<li>${point.distance.toFixed(2)} m - ${point.elevation.toFixed(2)} m</li>`;
        });
        htmlContent += '</ul></div>';

        // Placeholder for a charting library integration:
        htmlContent += `<p style="margin-top: 10px;"><em>(A full charting library like Chart.js or D3.js would render a graph here based on this data.)</em></p>`;


        chartDataContainer.innerHTML = htmlContent;
        panel.style.display = 'block'; // Show the panel
    }
}

export const ToolManagementService = new ToolManagementServiceClass();