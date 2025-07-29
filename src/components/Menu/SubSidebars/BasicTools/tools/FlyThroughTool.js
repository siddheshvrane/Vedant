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

// Default configuration values
const DEFAULT_CONFIG = {
    cameraHeight: 20,           // meters above ground
    cameraSpeed: 10,           // meters per second
    cameraTilt: 45,            // degrees (0=straight down, 90=horizontal)
    showProgressUpdates: true, // show progress during animation
    pauseBetweenPoints: 200    // milliseconds pause between flight segments
};

/**
 * Sets up the FlyThrough tool with reduced popup frequency and user configuration.
 * @param {Cesium.Viewer} viewer The Cesium Viewer instance.
 */
export function setupFlyThroughTool(viewer) {
    console.log("FlyThroughTool: Setting up enhanced tool with configuration options");

    setToolState({
        viewer: viewer,
        handler: viewer ? new Cesium.ScreenSpaceEventHandler(viewer.canvas) : null,
        drawingPoints: [],
        activeShape: null,
        flythroughPath: null,
        animation: null,
        mousePosition: null,
        config: { ...DEFAULT_CONFIG }, // Initialize with default config
        lastPopupTime: 0
    });

    const { handler } = getToolState();

    viewer.clock.clockRange = Cesium.ClockRange.UNBOUNDED;
    viewer.clock.shouldAnimate = true;

    const toolName = "Enhanced FlyThrough Tool";
    PopupService.showToolInstruction(
        `Click to add path points (minimum 2). Right-click when ready to configure and start flythrough.`,
        toolName
    );
    console.log("FlyThroughTool: Initial instruction shown.");

    // LEFT_CLICK Handler with reduced popup frequency
    handler.setInputAction((click) => {
        const currentTime = Date.now();
        const { lastPopupTime } = getToolState();

        let cartesian = viewer.scene.pickPosition(click.position);
        if (!Cesium.defined(cartesian)) {
            cartesian = viewer.camera.pickEllipsoid(click.position, viewer.scene.globe.ellipsoid);
        }

        if (Cesium.defined(cartesian)) {
            if (isNaN(cartesian.x) || isNaN(cartesian.y) || isNaN(cartesian.z)) {
                console.error("FlyThroughTool: Invalid position:", cartesian);
                // Only show error popup if it's been more than 3 seconds since last popup
                if (currentTime - lastPopupTime > 3000) {
                    PopupService.showToolInstruction(
                        "Invalid position. Please click on the globe.",
                        toolName,
                        true
                    );
                    setToolState({ lastPopupTime: currentTime });
                }
                return;
            }

            const { drawingPoints } = getToolState();
            drawingPoints.push(cartesian);
            setToolState({ drawingPoints: [...drawingPoints] });

            console.log(`FlyThroughTool: Added point ${drawingPoints.length}`);
            addTemporaryPoint(cartesian);

            // Create or update the polyline
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

            // Show popup only for significant milestones or after time intervals
            const shouldShowPopup = (
                drawingPoints.length === 1 ||   // First point
                drawingPoints.length === 2 ||   // Second point (minimum for flythrough)
                drawingPoints.length % 5 === 0 || // Every 5th point
                (currentTime - lastPopupTime > 10000) // Every 10 seconds
            );

            if (shouldShowPopup) {
                const message = drawingPoints.length === 1
                    ? "First point added. Click to add more points."
                    : drawingPoints.length === 2
                        ? "Minimum points reached. Add more or right-click to configure flythrough."
                        : `${drawingPoints.length} points added. Right-click to start flythrough.`;

                PopupService.showToolInstruction(message, toolName);
                setToolState({ lastPopupTime: currentTime });
            }

            if (viewer.scene.requestRenderMode) {
                viewer.scene.requestRender();
            }
        } else {
            console.warn("FlyThroughTool: Could not pick valid position");
            // Throttled error message
            if (currentTime - lastPopupTime > 5000) {
                PopupService.showToolInstruction(
                    "Please click directly on the globe surface.",
                    toolName,
                    true
                );
                setToolState({ lastPopupTime: currentTime });
            }
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

    // RIGHT_CLICK Handler with configuration dialog
    handler.setInputAction(async () => {
        console.log("FlyThroughTool: Right-click detected, showing configuration");

        const { drawingPoints, activeShape, config } = getToolState();
        PopupService.hide(); // Hide any current instruction popup

        if (drawingPoints.length < 2) {
            console.warn("FlyThroughTool: Not enough points for flythrough");
            PopupService.showToolInstruction(
                `Need at least 2 points for flythrough. Currently have ${drawingPoints.length}.`,
                `FlyThrough Error`,
                true
            );
            return;
        }

        // Show configuration dialog using PopupService
        PopupService.showFlyThroughForm({
            height: config.cameraHeight,
            tilt: config.cameraTilt,
            speed: config.cameraSpeed,
            duration: null, // FlyThroughPopup will calculate or let user input duration
            loop: false,    // Assuming not looping by default from the form
            onStart: async (formConfig) => {
                console.log("FlyThroughTool: Configuration confirmed:", formConfig);

                // FIXED: Create the final config object with proper mapping from form values
                const finalConfig = {
                    cameraHeight: formConfig.height,      // Map 'height' to 'cameraHeight'
                    cameraSpeed: formConfig.speed,        // Map 'speed' to 'cameraSpeed'  
                    cameraTilt: formConfig.tilt,          // Map 'tilt' to 'cameraTilt'
                    duration: formConfig.duration,        // Keep duration as is
                    loop: formConfig.loop,                // Keep loop as is
                    showProgressUpdates: config.showProgressUpdates, // Keep existing setting
                    pauseBetweenPoints: config.pauseBetweenPoints    // Keep existing setting
                };

                console.log("FlyThroughTool: Final mapped config:", finalConfig);

                // Remove event handlers and clean up drawing
                removeEventHandlers();

                if (Cesium.defined(activeShape)) {
                    viewer.entities.remove(activeShape);
                    setToolState({ activeShape: null });
                }
                clearDrawing();

                // Start flythrough with the properly mapped configuration
                await startConfiguredFlyThrough(drawingPoints, viewer, finalConfig);
            },
            onCancel: () => {
                console.log("FlyThroughTool: Configuration cancelled");
                PopupService.showToolInstruction(
                    "Flythrough setup cancelled. Continue adding points or right-click again.",
                    toolName
                );
            }
        });

    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
}

/**
 * Starts the flythrough with user-specified configuration
 */
async function startConfiguredFlyThrough(drawingPoints, viewer, config) {
    PopupService.showToolInstruction(
        'Preparing flythrough path...',
        'Processing FlyThrough',
        false
    );

    try {
        console.log("FlyThroughTool: Starting terrain sampling with config:", config);
        const { sampledPositions } = await sampleTerrainForFlyThrough(drawingPoints, viewer, config.cameraHeight);

        if (sampledPositions.length < 2) {
            PopupService.showToolInstruction(
                'Could not create valid flythrough path. Please try different points.',
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

        if (config.showProgressUpdates) {
            PopupService.showToolInstruction(
                `Starting flythrough: ${config.cameraHeight}m height, ${config.cameraSpeed}m/s speed, ${config.cameraTilt}° tilt (0°=down, 90°=horizontal)`,
                'FlyThrough Active',
                false
            );
        }

        // Store start time in config for completion message
        config._startTime = Date.now();

        // Pass a callback to animateConfiguredFlyThrough to show the completion popup
        await animateConfiguredFlyThrough(sampledPositions, viewer, config, () => {
            const totalTime = ((Date.now() - config._startTime) / 1000).toFixed(1);
            PopupService.showToolInstruction(
                `Flythrough completed! Total time: ${totalTime}s`,
                "Success",
                true // Show dismiss button for final success message
            );
            ToolManagementService.deactivateCurrentTool(); // Deactivate tool after successful completion and popup
        });

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
}

/**
 * Enhanced terrain sampling with configurable camera height
 */
async function sampleTerrainForFlyThrough(points, viewer, cameraHeight = 20) {
    console.log("DEBUG: sampleTerrainForFlyThrough - input points:", points.length, "height:", cameraHeight);

    if (points.length < 2) {
        console.warn("FlyThroughTool: Less than 2 points provided");
        return { sampledPositions: [] };
    }

    const cleanPoints = points.filter(p =>
        Cesium.defined(p) &&
        !isNaN(p.x) && !isNaN(p.y) && !isNaN(p.z)
    );

    if (cleanPoints.length < 2) {
        console.error("FlyThroughTool: Not enough valid points after filtering");
        return { sampledPositions: [] };
    }

    let finalPositions = [];

    if (Cesium.defined(viewer.terrainProvider) && viewer.terrainProvider.ready) {
        console.log("FlyThroughTool: Using terrain provider with height offset:", cameraHeight);

        const cartographicPoints = cleanPoints.map(p =>
            viewer.scene.globe.ellipsoid.cartesianToCartographic(p)
        );

        const samplePoints = [];
        samplePoints.push(...cartographicPoints);

        // Add interpolated points for smoother path
        for (let i = 0; i < cartographicPoints.length - 1; i++) {
            const p1 = cartographicPoints[i];
            const p2 = cartographicPoints[i + 1];

            const cart1 = viewer.scene.globe.ellipsoid.cartographicToCartesian(p1);
            const cart2 = viewer.scene.globe.ellipsoid.cartesianToCartesian(p2);
            const distance = Cesium.Cartesian3.distance(cart1, cart2);

            if (distance > 1000) {
                const numSamples = Math.min(20, Math.floor(distance / 500));

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

            finalPositions = updatedCartographics.map(c => {
                const adjustedHeight = (c.height || 0) + cameraHeight;
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
                    (cartographic.height || 0) + cameraHeight
                );
                return viewer.scene.globe.ellipsoid.cartographicToCartesian(elevated);
            });
            console.log("FlyThroughTool: Using fallback elevation");
        }
    } else {
        console.warn("FlyThroughTool: No terrain provider, using ellipsoid heights");
        finalPositions = cleanPoints.map(p => {
            const cartographic = viewer.scene.globe.ellipsoid.cartesianToCartographic(p);
            const elevated = new Cesium.Cartographic(
                cartographic.longitude,
                cartographic.latitude,
                (cartographic.height || 0) + cameraHeight
            );
            return viewer.scene.globe.ellipsoid.cartographicToCartesian(elevated);
        });
    }

    const validPositions = finalPositions.filter(p =>
        Cesium.defined(p) &&
        !isNaN(p.x) && !isNaN(p.y) && !isNaN(p.z)
    );

    console.log(`FlyThroughTool: Returning ${validPositions.length} valid positions`);
    return { sampledPositions: validPositions };
}

/**
 * Calculate camera orientation for a specific flight segment
 * @param {Cesium.Cartesian3} currentPosition Current camera position
 * @param {Cesium.Cartesian3} nextPosition Next position in the path
 * @param {number} tiltAngle Camera tilt angle in degrees
 * @returns {object} Camera orientation with direction and up vectors
 */
function calculateSegmentOrientation(currentPosition, nextPosition, tiltAngle) {
    // Direction vector from current to next position (where we're heading)
    const direction = Cesium.Cartesian3.subtract(nextPosition, currentPosition, new Cesium.Cartesian3());
    const normalizedDirection = Cesium.Cartesian3.normalize(direction, new Cesium.Cartesian3());

    // Get surface normal at current position (points up from ground)
    const surfaceNormal = Cesium.Cartesian3.normalize(currentPosition, new Cesium.Cartesian3());

    // Calculate right vector (perpendicular to both direction and surface normal)
    const right = Cesium.Cartesian3.cross(normalizedDirection, surfaceNormal, new Cesium.Cartesian3());
    const normalizedRight = Cesium.Cartesian3.normalize(right, new Cesium.Cartesian3());

    // Correct tilt calculation
    // 0° = looking straight down (along surface normal)
    // 90° = looking horizontally (along direction vector)
    const tiltRadians = Cesium.Math.toRadians(tiltAngle);

    // Create tilted direction by blending surface normal and forward direction
    const tiltedDirection = new Cesium.Cartesian3();

    if (tiltAngle === 0) {
        // Looking straight down
        Cesium.Cartesian3.negate(surfaceNormal, tiltedDirection);
    } else if (tiltAngle === 90) {
        // Looking horizontally forward
        Cesium.Cartesian3.clone(normalizedDirection, tiltedDirection);
    } else {
        // Blend between down and forward based on tilt angle
        const downWeight = Math.cos(tiltRadians);
        const forwardWeight = Math.sin(tiltRadians);

        const downVector = Cesium.Cartesian3.negate(surfaceNormal, new Cesium.Cartesian3());
        const forwardVector = normalizedDirection;

        // Weighted combination
        const weightedDown = Cesium.Cartesian3.multiplyByScalar(downVector, downWeight, new Cesium.Cartesian3());
        const weightedForward = Cesium.Cartesian3.multiplyByScalar(forwardVector, forwardWeight, new Cesium.Cartesian3());

        Cesium.Cartesian3.add(weightedDown, weightedForward, tiltedDirection);
        Cesium.Cartesian3.normalize(tiltedDirection, tiltedDirection);
    }

    // Calculate proper up vector
    const cameraUp = Cesium.Cartesian3.cross(normalizedRight, tiltedDirection, new Cesium.Cartesian3());
    const normalizedCameraUp = Cesium.Cartesian3.normalize(cameraUp, new Cesium.Cartesian3());

    return {
        direction: tiltedDirection,
        up: normalizedCameraUp
    };
}

/**
 * Enhanced animation with smooth continuous movement and direction changes
 * @param {Array<Cesium.Cartesian3>} pathPositions The calculated path positions.
 * @param {Cesium.Viewer} viewer The Cesium Viewer instance.
 * @param {object} config The flythrough configuration.
 * @param {Function} onComplete Callback function to execute when the animation finishes.
 */
async function animateConfiguredFlyThrough(pathPositions, viewer, config, onComplete) {
    console.log("DEBUG: animateConfiguredFlyThrough - config:", config);

    if (pathPositions.length < 2) {
        console.warn("FlyThroughTool: Not enough points to animate");
        onComplete();
        return;
    }

    // Calculate total distance and duration based on user speed
    let totalDistance = 0;
    for (let i = 0; i < pathPositions.length - 1; i++) {
        totalDistance += Cesium.Cartesian3.distance(pathPositions[i], pathPositions[i + 1]);
    }

    // Use duration from config if provided, otherwise calculate based on speed
    let duration;
    if (config.duration && config.duration > 0) {
        duration = config.duration;
        // If duration is specified, adjust speed to match
        config.cameraSpeed = totalDistance / duration;
        console.log(`FlyThroughTool: Using specified duration ${duration}s, adjusted speed to ${config.cameraSpeed.toFixed(1)}m/s`);
    } else {
        duration = totalDistance / config.cameraSpeed;
    }

    console.log(`FlyThroughTool: ${totalDistance.toFixed(0)}m path, ${duration.toFixed(1)}s duration at ${config.cameraSpeed.toFixed(1)}m/s`);

    let currentIndex = 0;

    // Position camera at first point with initial orientation
    const firstOrientation = calculateSegmentOrientation(pathPositions[0], pathPositions[1], config.cameraTilt);
    viewer.camera.setView({
        destination: pathPositions[0],
        orientation: firstOrientation
    });

    const flyToNextPoint = () => {
        console.log(`FlyThroughTool: flyToNextPoint called, currentIndex: ${currentIndex}, total points: ${pathPositions.length}`);
        
        // Check if we've completed all segments
        if (currentIndex >= pathPositions.length - 1) {
            console.log("FlyThroughTool: Animation completed successfully - reached all points");
            setToolState({ animation: null });

            if (config.showProgressUpdates) {
                PopupService.hide();
            }
            onComplete();
            return;
        }

        const currentPosition = pathPositions[currentIndex];
        const nextPosition = pathPositions[currentIndex + 1];

        console.log(`FlyThroughTool: Flying from point ${currentIndex} to point ${currentIndex + 1}`);

        // Calculate segment duration based on distance to maintain constant speed
        const segmentDistance = Cesium.Cartesian3.distance(currentPosition, nextPosition);
        const segmentDuration = segmentDistance / config.cameraSpeed;

        // Show progress if enabled
        if (config.showProgressUpdates && (currentIndex % 3 === 0 || currentIndex < 5)) {
            const progress = Math.round((currentIndex / (pathPositions.length - 1)) * 100);
            const elapsed = ((Date.now() - config._startTime) / 1000).toFixed(0);
            PopupService.showToolInstruction(
                `Flying: ${progress}% complete (${elapsed}s elapsed) - Point ${currentIndex + 1}/${pathPositions.length}`,
                'FlyThrough Progress',
                false
            );
        }

        // Calculate orientation for current segment
        const currentOrientation = calculateSegmentOrientation(currentPosition, nextPosition, config.cameraTilt);

        // Simple and reliable flight - just fly to the next point
        viewer.camera.flyTo({
            destination: nextPosition,
            orientation: currentOrientation,
            duration: segmentDuration,
            easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
            complete: () => {
                console.log(`FlyThroughTool: Completed flight to point ${currentIndex + 1}`);
                currentIndex++;
                // Continue to next point after a short pause
                setTimeout(flyToNextPoint, config.pauseBetweenPoints);
            },
            cancel: () => {
                console.log("FlyThroughTool: Animation cancelled by user");
                setToolState({ animation: null });
                PopupService.showToolInstruction("Flythrough cancelled", "Cancelled", true);
                ToolManagementService.deactivateCurrentTool();
            }
        });

        // Store animation reference for potential cancellation
        setToolState({
            animation: {
                cancel: () => {
                    viewer.camera.cancelFlight();
                }
            }
        });
    };

    // Start the flythrough after a short delay
    setTimeout(flyToNextPoint, 300);
    console.log(`FlyThroughTool: Starting smooth flight with ${config.cameraHeight}m height, ${config.cameraTilt}° tilt (0°=down, 90°=horizontal), ${config.cameraSpeed.toFixed(1)}m/s speed`);
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
        config: { ...DEFAULT_CONFIG }, // Reset config to default
        lastPopupTime: 0
    });

    PopupService.hide(); // Ensure popup is hidden on tool deactivation
    console.log("FlyThroughTool: Cleanup completed");
}