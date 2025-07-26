// src/components/Menu/SubSidebars/BasicTools/tools/FlyThroughTool.js

import * as Cesium from 'cesium';
import {
    clearDrawing,
    removeEventHandlers,
    addTemporaryPoint,
    throttle,
    getToolState,
    setToolState,
} from '../tool-helpers/tools-helpers.js';
import { PopupService } from '../../../../../services/PopupService.js';
import { ToolManagementService } from '../../../../../services/ToolManagementService.js';

/**
 * Sets up the FlyThrough tool, allowing users to define a camera path and then fly along it.
 * @param {Cesium.Viewer} viewer The Cesium Viewer instance.
 */
export function setupFlyThroughTool(viewer) {
    console.log("FlyThroughTool: Setting up tool");
    
    setToolState({
        viewer: viewer,
        handler: viewer ? new Cesium.ScreenSpaceEventHandler(viewer.canvas) : null,
        drawingPoints: [],
        activeShape: null,
        flythroughPath: null,
        animation: null,
        mousePosition: null,
    });

    const { handler } = getToolState();

    viewer.clock.clockRange = Cesium.ClockRange.UNBOUNDED;
    viewer.clock.shouldAnimate = true;

    const toolName = "Flythrough Tool";
    PopupService.showToolInstruction(
        `Left-click to add path points. Right-click to finish and start flythrough.`,
        toolName
    );
    console.log("FlyThroughTool: Initial instruction popup shown.");

    // LEFT_CLICK Handler
    handler.setInputAction((click) => {
        console.log("FlyThroughTool: Left click detected at screen position:", click.position);
        
        let cartesian = viewer.scene.pickPosition(click.position);
        if (!Cesium.defined(cartesian)) {
            cartesian = viewer.camera.pickEllipsoid(click.position, viewer.scene.globe.ellipsoid);
        }

        if (Cesium.defined(cartesian)) {
            if (isNaN(cartesian.x) || isNaN(cartesian.y) || isNaN(cartesian.z)) {
                console.error("FlyThroughTool: Picked position contains NaN:", cartesian);
                PopupService.showToolInstruction(
                    "Invalid position selected. Please try clicking on the globe.",
                    toolName,
                    true
                );
                return;
            }

            const { drawingPoints } = getToolState();
            drawingPoints.push(cartesian);
            setToolState({ drawingPoints: [...drawingPoints] });

            console.log(`FlyThroughTool: Added point ${drawingPoints.length}:`, cartesian);
            addTemporaryPoint(cartesian);

            if (drawingPoints.length === 1) {
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
                        width: 4,
                        material: Cesium.Color.YELLOW.withAlpha(0.7),
                        clampToGround: true,
                        show: true
                    }
                });
                setToolState({ activeShape: activeShape });
            }

            PopupService.showToolInstruction(
                `Point ${drawingPoints.length} added. Continue clicking or right-click to start flythrough.`,
                toolName
            );

            if (viewer.scene.requestRenderMode) {
                viewer.scene.requestRender();
            }
        } else {
            console.warn("FlyThroughTool: Could not pick a valid position on LEFT_CLICK.");
            PopupService.showToolInstruction(
                "Could not determine 3D position. Please click directly on the globe surface.",
                toolName,
                true
            );
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // MOUSE_MOVE Handler
    const throttledMouseMoveHandler = throttle((move) => {
        const { drawingPoints } = getToolState();
        if (drawingPoints.length > 0) {
            let cartesian = viewer.scene.pickPosition(move.endPosition);
            if (!Cesium.defined(cartesian)) {
                cartesian = viewer.camera.pickEllipsoid(move.endPosition, viewer.scene.globe.ellipsoid);
            }

            if (Cesium.defined(cartesian) && !isNaN(cartesian.x) && !isNaN(cartesian.y) && !isNaN(cartesian.z)) {
                setToolState({ mousePosition: cartesian });
            } else {
                setToolState({ mousePosition: null });
            }

            if (viewer.scene.requestRenderMode) {
                viewer.scene.requestRender();
            }
        }
    }, 75);

    handler.setInputAction(throttledMouseMoveHandler, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    // RIGHT_CLICK Handler
    handler.setInputAction(async () => {
        console.log("FlyThroughTool: Right-click detected, finalizing path");
        removeEventHandlers();

        const { drawingPoints, activeShape } = getToolState();
        PopupService.hide();

        if (drawingPoints.length < 2) {
            console.warn("FlyThroughTool: Not enough points for flythrough");
            clearDrawing();
            ToolManagementService.deactivateCurrentTool();
            PopupService.showToolInstruction(
                `Minimum 2 points required for flythrough path.`,
                `FlyThrough Error`,
                true
            );
            return;
        }

        if (Cesium.defined(activeShape)) {
            viewer.entities.remove(activeShape);
            setToolState({ activeShape: null });
        }

        clearDrawing();

        PopupService.showToolInstruction(
            'Preparing flythrough path...',
            'Processing FlyThrough',
            false
        );

        try {
            console.log("FlyThroughTool: Starting terrain sampling with", drawingPoints.length, "points");
            const { sampledPositions } = await sampleTerrainForFlyThrough(drawingPoints, viewer);

            if (sampledPositions.length < 2) {
                PopupService.showToolInstruction(
                    'Could not create valid flythrough path. Please try selecting different points.',
                    'FlyThrough Error',
                    true
                );
                ToolManagementService.deactivateCurrentTool();
                return;
            }

            const flythroughPath = viewer.entities.add({
                polyline: {
                    positions: sampledPositions,
                    width: 5,
                    material: Cesium.Color.CYAN,
                    clampToGround: true,
                    show: true,
                }
            });
            setToolState({ flythroughPath: flythroughPath });

            PopupService.showToolInstruction(
                'Starting flythrough animation...',
                'FlyThrough Active',
                false
            );

            await animateFlyThrough(sampledPositions, viewer);

        } catch (error) {
            console.error("FlyThroughTool: Error during flythrough:", error);
            PopupService.showToolInstruction(
                `Flythrough failed: ${error.message || 'Unknown error'}`,
                `FlyThrough Error`,
                true
            );
            ToolManagementService.deactivateCurrentTool();
        }

        if (viewer.scene.requestRenderMode) {
            viewer.scene.requestRender();
        }

    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
}

/**
 * Samples terrain elevations along the drawn path for a smooth flythrough.
 */
async function sampleTerrainForFlyThrough(points, viewer) {
    console.log("DEBUG: sampleTerrainForFlyThrough - input points:", points.length);

    if (points.length < 2) {
        console.warn("FlyThroughTool: Less than 2 points provided for terrain sampling");
        return { sampledPositions: [] };
    }

    const cleanPoints = points.filter(p => 
        Cesium.defined(p) && 
        !isNaN(p.x) && !isNaN(p.y) && !isNaN(p.z)
    );
    
    if (cleanPoints.length !== points.length) {
        console.warn(`FlyThroughTool: Removed ${points.length - cleanPoints.length} invalid points`);
    }
    
    if (cleanPoints.length < 2) {
        console.error("FlyThroughTool: Not enough valid points after filtering");
        return { sampledPositions: [] };
    }

    let finalPositions = [];

    if (Cesium.defined(viewer.terrainProvider) && viewer.terrainProvider.ready) {
        console.log("FlyThroughTool: Using terrain provider for elevation sampling");
        
        const cartographicPoints = cleanPoints.map(p => 
            viewer.scene.globe.ellipsoid.cartesianToCartographic(p)
        );

        const samplePoints = [];
        samplePoints.push(...cartographicPoints);
        
        for (let i = 0; i < cartographicPoints.length - 1; i++) {
            const p1 = cartographicPoints[i];
            const p2 = cartographicPoints[i + 1];
            
            const cart1 = viewer.scene.globe.ellipsoid.cartographicToCartesian(p1);
            const cart2 = viewer.scene.globe.ellipsoid.cartographicToCartesian(p2);
            const distance = Cesium.Cartesian3.distance(cart1, cart2);
            
            if (distance > 1000) {
                const numSamples = Math.min(15, Math.floor(distance / 1000));
                
                for (let j = 1; j < numSamples; j++) {
                    const t = j / numSamples;
                    const interpolated = new Cesium.Cartographic(
                        Cesium.Math.lerp(p1.longitude, p2.longitude, t),
                        Cesium.Math.lerp(p1.latitude, p2.latitude, t),
                        Cesium.Math.lerp(p1.height || 0, p2.height || 0, t)
                    );
                    samplePoints.push(interpolated);
                }
            }
        }

        try {
            console.log(`FlyThroughTool: Sampling terrain for ${samplePoints.length} points`);
            const updatedCartographics = await Cesium.sampleTerrainMostDetailed(
                viewer.terrainProvider, 
                samplePoints
            );
            
            const heightOffset = 20; // Much lower height for ground-level view
            finalPositions = updatedCartographics.map(c => {
                const adjustedHeight = (c.height || 0) + heightOffset;
                const adjustedCartographic = new Cesium.Cartographic(
                    c.longitude, 
                    c.latitude, 
                    adjustedHeight
                );
                return viewer.scene.globe.ellipsoid.cartographicToCartesian(adjustedCartographic);
            });
            
            console.log("FlyThroughTool: Terrain sampling completed successfully");
            
        } catch (error) {
            console.error("FlyThroughTool: Terrain sampling failed:", error);
            finalPositions = cleanPoints.map(p => {
                const cartographic = viewer.scene.globe.ellipsoid.cartesianToCartographic(p);
                const elevated = new Cesium.Cartographic(
                    cartographic.longitude,
                    cartographic.latitude,
                    (cartographic.height || 0) + 30 // Lower fallback height
                );
                return viewer.scene.globe.ellipsoid.cartographicToCartesian(elevated);
            });
            console.log("FlyThroughTool: Using fallback elevation");
        }
    } else {
        console.warn("FlyThroughTool: No terrain provider available, using ellipsoid heights");
        finalPositions = cleanPoints.map(p => {
            const cartographic = viewer.scene.globe.ellipsoid.cartesianToCartographic(p);
            const elevated = new Cesium.Cartographic(
                cartographic.longitude,
                cartographic.latitude,
                (cartographic.height || 0) + 25 // Low height for ground-level view
            );
            return viewer.scene.globe.ellipsoid.cartographicToCartesian(elevated);
        });
    }

    const validPositions = finalPositions.filter(p => 
        Cesium.defined(p) && 
        !isNaN(p.x) && !isNaN(p.y) && !isNaN(p.z)
    );

    if (validPositions.length !== finalPositions.length) {
        console.warn(`FlyThroughTool: Filtered out ${finalPositions.length - validPositions.length} invalid positions`);
    }

    console.log(`FlyThroughTool: Returning ${validPositions.length} valid positions for animation`);
    return { sampledPositions: validPositions };
}

/**
 * Animates the camera along the defined path with proper viewing angle.
 */
async function animateFlyThrough(pathPositions, viewer) {
    console.log("DEBUG: animateFlyThrough - starting with", pathPositions.length, "positions");

    if (pathPositions.length < 2) {
        console.warn("FlyThroughTool: Not enough points to animate");
        return;
    }

    // Calculate duration
    let totalDistance = 0;
    for (let i = 0; i < pathPositions.length - 1; i++) {
        totalDistance += Cesium.Cartesian3.distance(pathPositions[i], pathPositions[i + 1]);
    }

    const baseSpeed = 5; // Much slower speed for detailed viewing (50 m/s)
    const minDuration = 8;
    const maxDuration = 60;
    const duration = Math.max(minDuration, Math.min(maxDuration, totalDistance / baseSpeed));
    
    console.log(`FlyThroughTool: Animation - ${totalDistance.toFixed(0)}m path, ${duration.toFixed(1)}s duration`);

    // Fly through each point sequentially
    let currentIndex = 0;
    
    const flyToNextPoint = () => {
        if (currentIndex >= pathPositions.length - 1) {
            // Animation complete
            console.log("FlyThroughTool: Animation completed successfully");
            setToolState({ animation: null });
            PopupService.showToolInstruction("Flythrough completed!", "Success", false);
            setTimeout(() => {
                ToolManagementService.deactivateCurrentTool();
            }, 2000);
            return;
        }

        // Position camera at ground level with the tilted viewing angle
        const currentPosition = pathPositions[currentIndex];
        const nextPosition = pathPositions[currentIndex + 1];
        
        // Get terrain height at current position for ground clamping
        const currentCartographic = viewer.scene.globe.ellipsoid.cartesianToCartographic(currentPosition);
        const groundHeight = currentCartographic.height || 0;
        
        // Clamp camera to just above ground level (5-10 meters above terrain)
        const cameraHeight = groundHeight + 10; // 10 meters above ground
        const clampedCameraCartographic = new Cesium.Cartographic(
            currentCartographic.longitude,
            currentCartographic.latitude,
            cameraHeight
        );
        const clampedCameraPosition = viewer.scene.globe.ellipsoid.cartographicToCartesian(clampedCameraCartographic);
        
        const segmentDuration = duration / (pathPositions.length - 1);
        
        console.log(`Flying from point ${currentIndex + 1} to ${currentIndex + 2}/${pathPositions.length} at ${cameraHeight.toFixed(1)}m height`);
        
        // Calculate direction vector from current to next position
        const direction = Cesium.Cartesian3.subtract(nextPosition, clampedCameraPosition, new Cesium.Cartesian3());
        const normalizedDirection = Cesium.Cartesian3.normalize(direction, new Cesium.Cartesian3());
        
        // Get the surface normal (up vector) at current position
        const surfaceNormal = Cesium.Cartesian3.normalize(clampedCameraPosition, new Cesium.Cartesian3());
        
        // Tilt the direction slightly downward to see the path ahead (15 degrees)
        const tiltAngle = Cesium.Math.toRadians(15); // Gentle downward tilt to see the route
        
        // Calculate right vector (perpendicular to both direction and surface normal)
        const right = Cesium.Cartesian3.cross(normalizedDirection, surfaceNormal, new Cesium.Cartesian3());
        const normalizedRight = Cesium.Cartesian3.normalize(right, new Cesium.Cartesian3());
        
        // Create a quaternion rotation to tilt the direction vector downward
        const rotationAxis = normalizedRight;
        const quaternion = Cesium.Quaternion.fromAxisAngle(rotationAxis, -tiltAngle);
        const rotationMatrix = Cesium.Matrix3.fromQuaternion(quaternion);
        
        // Apply the rotation to get the tilted direction
        const tiltedDirection = Cesium.Matrix3.multiplyByVector(rotationMatrix, normalizedDirection, new Cesium.Cartesian3());
        
        // Calculate the proper up vector for the tilted camera
        const cameraUp = Cesium.Cartesian3.cross(normalizedRight, tiltedDirection, new Cesium.Cartesian3());
        const normalizedCameraUp = Cesium.Cartesian3.normalize(cameraUp, new Cesium.Cartesian3());

        const flightPromise = viewer.camera.flyTo({
            destination: clampedCameraPosition, // Use clamped ground-level position
            orientation: {
                direction: tiltedDirection,
                up: normalizedCameraUp
            },
            duration: segmentDuration,
            easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
            complete: () => {
                currentIndex++;
                // Continue to next point after a brief pause
                setTimeout(flyToNextPoint, 200);
            },
            cancel: () => {
                console.log("FlyThroughTool: Animation cancelled");
                setToolState({ animation: null });
                PopupService.showToolInstruction("Flythrough cancelled", "Cancelled", true);
                ToolManagementService.deactivateCurrentTool();
            }
        });

        // Store the flight promise for cancellation
        setToolState({ 
            animation: {
                cancel: () => {
                    viewer.camera.cancelFlight();
                }
            }
        });
    };

    // Start the sequential flight
    flyToNextPoint();
    console.log(`FlyThroughTool: Starting ground-level flight through ${pathPositions.length} points with 15° downward tilt`);
}

/**
 * Stops the current flythrough animation and cleans up.
 */
export function stopFlyThrough() {
    console.log("FlyThroughTool: Stopping and cleaning up");
    
    const { animation, viewer, flythroughPath } = getToolState();

    if (Cesium.defined(animation)) {
        if (animation.cancel) {
            animation.cancel();
        }
        viewer.camera.cancelFlight();
    }

    if (Cesium.defined(flythroughPath)) {
        viewer.entities.remove(flythroughPath);
        setToolState({ flythroughPath: null });
    }

    clearDrawing();
    removeEventHandlers();

    setToolState({
        drawingPoints: [],
        activeShape: null,
        animation: null,
        mousePosition: null,
    });

    PopupService.hide();
    console.log("FlyThroughTool: Cleanup completed");
}