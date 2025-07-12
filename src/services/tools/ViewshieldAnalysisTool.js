// src/utils/tools/ViewshieldAnalysisTool.js
import * as Cesium from 'cesium';
import {
    clearDrawing,
    removeEventHandlers,
    addTemporaryPoint,
    addPersistentLabel,
    getToolState,
    setToolState // For updating viewshieldPolylines
} from '../tool-helpers/tools-helpers.js';
import { PopupService } from '../../services/PopupService.js'; // IMPORTANT: Import PopupService

export function setupViewshieldAnalysisTool() {
    clearDrawing();
    removeEventHandlers();

    const { handler, viewer } = getToolState();

    // --- OLD: alert() for initial instructions ---
    // alert("Viewshield Analysis: Left-click to define an Observer point. Then left-click for a Target point. The line will show visible (green) and obstructed (red) segments. Right-click to clear.");

    // --- NEW: Using PopupService for instructions ---
    PopupService.showToolInstruction(
        `Left-click to define an Observer point. Then left-click for a Target point. The line will show visible (green) and obstructed (red) segments. Right-click to clear.`,
        `Viewshield Analysis`
    );
    // --- END NEW ---

    console.warn("Viewshield Analysis: This provides a visual line-of-sight analysis with color-coded segments.");

    let observerPoint = null;
    let targetPoint = null;

    handler.setInputAction((click) => {
        const cartesian = viewer.scene.pickPosition(click.position); // Always pick 3D position for LOS
        if (cartesian) {
            if (!observerPoint) {
                observerPoint = cartesian;
                addTemporaryPoint(observerPoint);
                addPersistentLabel(observerPoint, "Observer");
            } else if (!targetPoint) {
                targetPoint = cartesian;
                addTemporaryPoint(targetPoint);
                addPersistentLabel(targetPoint, "Target");

                analyzeLineOfSight(observerPoint, targetPoint);

                // --- OLD: alert() after target point set ---
                // alert("Target point set. Right-click to clear analysis.");
                // --- NEW: Using PopupService for instruction update ---
                PopupService.showToolInstruction(
                    `Target point set. Right-click to clear analysis.`,
                    `Viewshield Analysis`
                );
                // --- END NEW ---
            }
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    handler.setInputAction(() => {
        clearDrawing();
        observerPoint = null;
        targetPoint = null;
        removeEventHandlers();
        console.log("Viewshield Analysis cleared.");
        
        // --- OLD: alert() on clear ---
        // alert("Viewshield Analysis cleared. Click to define new observer point.");
        // --- NEW: Using PopupService for instruction update ---
        PopupService.showToolInstruction(
            `Viewshield Analysis cleared. Left-click to define new observer point.`,
            `Viewshield Analysis`
        );
        // --- END NEW ---
        // This is handled by the ToolManagementService's deactivateCurrentTool
        // which calls removeEventHandlers and then activeTool$.next(null)
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
}

async function analyzeLineOfSight(observerPoint, targetPoint) {
    const { viewer, viewshieldPolylines } = getToolState();
    if (!viewer || !observerPoint || !targetPoint) return;

    // Clear previous LOS segments
    viewshieldPolylines.forEach(entity => viewer.entities.remove(entity));
    setToolState({ viewshieldPolylines: [] }); // Reset array in state

    const numberOfSamples = 200; // More samples for smoother, more accurate visibility segments
    const samplePoints = [];
    for (let i = 0; i <= numberOfSamples; i++) {
        const interpolated = Cesium.Cartesian3.lerp(observerPoint, targetPoint, i / numberOfSamples, new Cesium.Cartesian3());
        samplePoints.push(interpolated);
    }

    try {
        // Get terrain heights for all interpolated points
        const clampedSampledPoints = await viewer.scene.clampToGround(samplePoints);

        const observerCarto = viewer.scene.globe.ellipsoid.cartesianToCartographic(observerPoint);
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
            const targetCartoHeight = viewer.scene.globe.ellipsoid.cartesianToCartographic(targetPoint).height;

            let expectedLOSHeight;
            if (totalDirectDistance === 0) { // Avoid division by zero if observer and target are same
                expectedLOSHeight = observerCarto.height;
            } else {
                expectedLOSHeight = observerCarto.height + (targetCartoHeight - observerCarto.height) * (distanceAlongLine / totalDirectDistance);
            }

            const currentTerrainHeight = viewer.scene.globe.ellipsoid.cartesianToCartographic(currentSampledPoint).height;

            const isObstructed = currentTerrainHeight > expectedLOSHeight + LOS_TOLERANCE_METERS;

            if (isObstructed && currentSegmentColor === Cesium.Color.LIMEGREEN) {
                // Visible segment just ended, draw it
                // Push the point *just before* obstruction
                currentSegmentPositions.push(Cesium.Cartesian3.lerp(previousSampledPoint, currentSampledPoint, 0.01, new Cesium.Cartesian3()));
                drawViewshieldSegment(currentSegmentPositions, currentSegmentColor);
                isOverallVisible = false; // Mark overall as obstructed

                // Start new obstructed segment
                currentSegmentStart = currentSampledPoint;
                currentSegmentColor = Cesium.Color.RED;
                currentSegmentPositions = [currentSegmentStart];
            } else if (!isObstructed && currentSegmentColor === Cesium.Color.RED) {
                // Obstructed segment just ended, draw it
                // Push the point *just before* clearing
                currentSegmentPositions.push(Cesium.Cartesian3.lerp(previousSampledPoint, currentSampledPoint, 0.01, new Cesium.Cartesian3()));
                drawViewshieldSegment(currentSegmentPositions, currentSegmentColor);

                // Start new visible segment
                currentSegmentStart = currentSampledPoint;
                currentSegmentColor = Cesium.Color.LIMEGREEN;
                currentSegmentPositions = [currentSegmentStart];
            }
            currentSegmentPositions.push(currentSampledPoint);
        }
        // Draw the last segment
        drawViewshieldSegment(currentSegmentPositions, currentSegmentColor);

        const midPoint = Cesium.Cartesian3.midpoint(observerPoint, targetPoint, new Cesium.Cartesian3());
        addPersistentLabel(midPoint, `Overall Visibility: ${isOverallVisible ? "Visible" : "Obstructed"}`);

    } catch (error) {
        console.error("Error during Viewshield Analysis:", error);
        // Draw a single orange line to indicate error
        drawViewshieldSegment([observerPoint, targetPoint], Cesium.Color.ORANGE);
        const midPoint = Cesium.Cartesian3.midpoint(observerPoint, targetPoint, new Cesium.Cartesian3());
        addPersistentLabel(midPoint, `Visibility: Error`);

        // --- NEW: Using PopupService for error notification ---
        PopupService.show('toolInstruction', {
            message: `An error occurred during viewshield analysis: ${error.message || 'Unknown error.'}`,
            title: `Viewshield Analysis Error`,
            showDismissButton: true
        });
        // --- END NEW ---
    }
}

function drawViewshieldSegment(positions, color) {
    const { viewer, viewshieldPolylines } = getToolState();
    if (positions.length < 2) return;
    const segmentEntity = viewer.entities.add({
        polyline: {
            positions: positions,
            width: 3,
            material: color,
            clampToGround: false // Line of sight is 3D
        }
    });
    viewshieldPolylines.push(segmentEntity);
    setToolState({ viewshieldPolylines: viewshieldPolylines }); // Update state
}