import * as Cesium from 'cesium';
import {
    clearDrawing,
    removeEventHandlers,
    addTemporaryPoint,
    addTemporaryPersistentLabel, // Corrected import to use the temporary label helper
    getToolState,
    setToolState // For managing viewshieldPolylines state
} from '../tool-helpers/tools-helpers.js';
import { PopupService } from '../../../../../services/PopupService.js';

export function setupViewshieldAnalysisTool() {
    clearDrawing(); // Ensures previous state is clean
    removeEventHandlers(); // Ensures no old handlers are active

    // No need to reset viewshieldPolylines here explicitly as clearDrawing() handles it.

    PopupService.showToolInstruction(
        `Left-click to define an Observer point. Then left-click for a Target point. The line will show visible (green) and obstructed (red) segments. Right-click to clear.`,
        `Viewshield Analysis`
    );
    console.warn("Viewshield Analysis: This provides a visual line-of-sight analysis with color-coded segments.");

    let observerPoint = null;
    let targetPoint = null;

    const { handler, viewer } = getToolState();

    handler.setInputAction((click) => {
        const cartesian = viewer.scene.pickPosition(click.position); // Always pick 3D position for LOS
        if (Cesium.defined(cartesian)) {
            if (!observerPoint) {
                observerPoint = cartesian;
                addTemporaryPoint(observerPoint); // Helper to add and track point
                addTemporaryPersistentLabel(observerPoint, "Observer"); // Use the correct temporary label helper
            } else if (!targetPoint) {
                targetPoint = cartesian;
                addTemporaryPoint(targetPoint); // Helper to add and track point
                addTemporaryPersistentLabel(targetPoint, "Target"); // Use the correct temporary label helper

                analyzeLineOfSight(observerPoint, targetPoint);

                PopupService.showToolInstruction(
                    `Target point set. Right-click to clear analysis.`,
                    `Viewshield Analysis`
                );
            }
        } else {
            console.warn("Viewshield Analysis: Could not pick a valid position.");
            PopupService.showToolInstruction(
                `Could not pick a valid position. Please click on the globe.`,
                `Viewshield Analysis Error`,
                true
            );
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    handler.setInputAction(() => {
        clearDrawing(); // Clears all temporary entities including viewshield polylines, points, and labels
        observerPoint = null;
        targetPoint = null;
        removeEventHandlers(); // Cleans up handlers (important before deactivating tool)
        console.log("Viewshield Analysis cleared.");

        PopupService.showToolInstruction(
            `Viewshield Analysis cleared. Left-click to define new observer point.`,
            `Viewshield Analysis`
        );
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
}

async function analyzeLineOfSight(observerPoint, targetPoint) {
    const { viewer } = getToolState();
    if (!viewer || !observerPoint || !targetPoint) {
        console.error("Viewshield Analysis: Missing viewer, observer, or target point.");
        return;
    }

    // Since clearDrawing is called on right-click, if a new analysis is started within the same
    // tool activation without a right-click, we should clear previous viewshield segments.
    // However, the current flow ensures observerPoint/targetPoint are reset, implying a new session,
    // so clearDrawing at the start of setup should suffice for total reset.
    // If you need to re-run analysis while tool is active with existing points (e.g., changing parameters),
    // you'd add a specific `clearViewshieldPolylines()` function here.
    // For now, assume clearDrawing on right-click is the main reset.

    const numberOfSamples = 200; // More samples for smoother, more accurate visibility segments
    const samplePoints = [];
    for (let i = 0; i <= numberOfSamples; i++) {
        const interpolated = Cesium.Cartesian3.lerp(observerPoint, targetPoint, i / numberOfSamples, new Cesium.Cartesian3());
        samplePoints.push(interpolated);
    }

    try {
        PopupService.showToolInstruction(
            'Calculating line of sight with terrain...',
            'Processing Viewshield',
            false // No dismiss button during processing
        );

        // Convert Cartesians to Cartographics for terrain sampling
        const sampleCartographics = samplePoints.map(p => Cesium.Cartographic.fromCartesian(p));

        // Use Cesium.TerrainSampler.sampleTerrain for accurate terrain heights
        const clampedCartographics = await Cesium.TerrainSampler.sampleTerrain(viewer.terrainProvider, sampleCartographics);
        // Convert sampled Cartographics back to Cartesians
        const clampedSampledPoints = clampedCartographics.map(c => Cesium.Cartographic.toCartesian(c));

        PopupService.hide(); // Hide processing popup once sampling is done.

        const observerCarto = Cesium.Cartographic.fromCartesian(observerPoint); // Get cartographic for observer's height
        let currentSegmentStart = observerPoint;
        let currentSegmentColor = Cesium.Color.LIMEGREEN; // Assume visible initially
        let currentSegmentPositions = [observerPoint];
        let isOverallVisible = true;
        const LOS_TOLERANCE_METERS = 1.0; // Tolerance for obstruction detection

        for (let i = 1; i < clampedSampledPoints.length; i++) {
            const currentSampledPoint = clampedSampledPoints[i];
            const previousSampledPoint = clampedSampledPoints[i - 1];

            const distanceAlongLine = Cesium.Cartesian3.distance(observerPoint, currentSampledPoint);
            const totalDirectDistance = Cesium.Cartesian3.distance(observerPoint, targetPoint);
            const targetCartoHeight = Cesium.Cartographic.fromCartesian(targetPoint).height;

            let expectedLOSHeight;
            if (totalDirectDistance === 0) { // Avoid division by zero if observer and target are same
                expectedLOSHeight = observerCarto.height;
            } else {
                expectedLOSHeight = observerCarto.height + (targetCartoHeight - observerCarto.height) * (distanceAlongLine / totalDirectDistance);
            }

            const currentTerrainHeight = Cesium.Cartographic.fromCartesian(currentSampledPoint).height;

            const isObstructed = currentTerrainHeight > expectedLOSHeight + LOS_TOLERANCE_METERS;

            if (isObstructed && currentSegmentColor === Cesium.Color.LIMEGREEN) {
                // Visible segment just ended, draw it
                // Push the point *just before* obstruction
                currentSegmentPositions.push(previousSampledPoint);
                drawViewshieldSegment(currentSegmentPositions, currentSegmentColor);
                isOverallVisible = false; // Mark overall as obstructed

                // Start new obstructed segment
                currentSegmentStart = currentSampledPoint;
                currentSegmentColor = Cesium.Color.RED;
                currentSegmentPositions = [currentSegmentStart];
            } else if (!isObstructed && currentSegmentColor === Cesium.Color.RED) {
                // Obstructed segment just ended, draw it
                // Push the point *just before* clearing
                currentSegmentPositions.push(previousSampledPoint);
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
        addTemporaryPersistentLabel(midPoint, `Overall Visibility: ${isOverallVisible ? "Visible" : "Obstructed"}`);

    } catch (error) {
        console.error("Error during Viewshield Analysis:", error);
        PopupService.hide(); // Hide any processing popup
        // Draw a single orange line to indicate error
        drawViewshieldSegment([observerPoint, targetPoint], Cesium.Color.ORANGE);
        const midPoint = Cesium.Cartesian3.midpoint(observerPoint, targetPoint, new Cesium.Cartesian3());
        addTemporaryPersistentLabel(midPoint, `Visibility: Error`);

        PopupService.showToolInstruction(
            `An error occurred during viewshield analysis: ${error.message || 'Unknown error.'} Please ensure terrain is available and try again.`,
            `Viewshield Analysis Error`,
            true
        );
    } finally {
        if (viewer.scene.requestRenderMode) {
            viewer.scene.requestRender();
        }
    }
}

/**
 * Draws a segment of the viewshield line and tracks it in the toolState.viewshieldPolylines array.
 * @param {Array<Cesium.Cartesian3>} positions - The points for this segment.
 * @param {Cesium.Color} color - The color for this segment.
 */
function drawViewshieldSegment(positions, color) {
    const { viewer, viewshieldPolylines } = getToolState(); // Get the array from toolState
    if (positions.length < 2) return;
    const segmentEntity = viewer.entities.add({
        polyline: {
            positions: positions,
            width: 3,
            material: color,
            clampToGround: false // Line of sight is 3D, not clamped
        }
    });
    viewshieldPolylines.push(segmentEntity); // Add to the array in toolState for clearing
    // No need to call setToolState here because viewshieldPolylines is an array reference,
    // so push() directly modifies the array within the toolState object.
    // If you were replacing the array, then setToolState would be needed.
}