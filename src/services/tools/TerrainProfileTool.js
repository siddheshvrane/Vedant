// src/utils/tools/TerrainProfileTool.js
import * as Cesium from 'cesium';
import {
    clearDrawing,
    removeEventHandlers,
    addTemporaryPoint,
    addPersistentLabel,
    getToolState,
    setToolState // For updating groundPolyline
} from '../tool-helpers/tools-helpers.js';
import { PopupService } from '../../services/PopupService.js'; // IMPORTANT: Import PopupService

export function setupTerrainProfileTool() {
    clearDrawing();
    removeEventHandlers();

    const { handler, viewer } = getToolState();

    // --- OLD: alert() for initial instructions ---
    // alert("Terrain Profile: Left-click to define start and end points of a profile line. Right-click to clear. The profile will appear in a panel.");
    
    // --- NEW: Using PopupService for instructions ---
    PopupService.showToolInstruction(
        `Left-click to define start and end points of a profile line. Right-click to clear. The profile will appear in a panel.`,
        `Terrain Profile`
    );
    // --- END NEW ---

    console.warn("Terrain Profile tool will now display a basic profile in an HTML panel.");

    let startPoint = null;
    let endPoint = null;

    handler.setInputAction((click) => {
        const cartesian = viewer.scene.pickPosition(click.position); // Pick 3D position
        if (cartesian) {
            if (!startPoint) {
                startPoint = cartesian;
                addTemporaryPoint(startPoint);
                addPersistentLabel(startPoint, "Start");
            } else if (!endPoint) {
                endPoint = cartesian;
                addTemporaryPoint(endPoint);
                addPersistentLabel(endPoint, "End");

                const groundPolyline = viewer.entities.add({
                    polyline: {
                        positions: [startPoint, endPoint],
                        width: 3,
                        material: Cesium.Color.GREEN,
                        clampToGround: true // Profile line should follow terrain
                    }
                });
                setToolState({ groundPolyline: groundPolyline }); // Update state

                generateTerrainProfile(startPoint, endPoint);

                // --- OLD: alert() after end point set ---
                // alert("End point set. Right-click to clear.");
                // --- NEW: Using PopupService for instruction update ---
                PopupService.showToolInstruction(
                    `End point set. Right-click to clear the profile.`,
                    `Terrain Profile`
                );
                // --- END NEW ---
            }
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    handler.setInputAction(() => {
        clearDrawing();
        startPoint = null;
        endPoint = null;
        removeEventHandlers();
        console.log("Terrain Profile cleared.");
        
        // --- OLD: alert() on clear ---
        // alert("Terrain Profile cleared. Click to define new profile line.");
        // --- NEW: Using PopupService for instruction update ---
        PopupService.showToolInstruction(
            `Terrain Profile cleared. Left-click to define new profile line.`,
            `Terrain Profile`
        );
        // --- END NEW ---
        // This is handled by the ToolManagementService's deactivateCurrentTool
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
}

async function generateTerrainProfile(startPoint, endPoint) {
    const { viewer } = getToolState();
    if (!viewer || !startPoint || !endPoint) return;

    const numberOfSamples = 200; // More samples for a smoother profile
    const interpolatedPositions = [];

    for (let i = 0; i <= numberOfSamples; i++) {
        const ratio = i / numberOfSamples;
        const interpolated = Cesium.Cartesian3.lerp(startPoint, endPoint, ratio, new Cesium.Cartesian3());
        interpolatedPositions.push(interpolated);
    }

    try {
        const clampedPositions = await viewer.scene.clampToGround(interpolatedPositions);

        const profileData = clampedPositions.map((pos) => {
            const carto = viewer.scene.globe.ellipsoid.cartesianToCartographic(pos);
            // Calculate horizontal distance from the start point (on the ellipsoid surface)
            const startCarto = viewer.scene.globe.ellipsoid.cartesianToCartographic(startPoint);
            const currentCarto = viewer.scene.globe.ellipsoid.cartesianToCartographic(pos);
            const geodesic = new Cesium.EllipsoidGeodesic(startCarto, currentCarto);
            const horizontalDistance = geodesic.surfaceDistance;

            return {
                distance: horizontalDistance,
                elevation: carto.height
            };
        });

        console.log("Terrain Profile Data (Horizontal Distance, Elevation):", profileData);
        displayTerrainProfileInPanel(profileData);

    } catch (error) {
        console.error("Error generating terrain profile:", error);
        // --- OLD: alert() for error ---
        // alert("Error generating terrain profile: Could not sample terrain heights.");
        // --- NEW: Using PopupService for error notification ---
        PopupService.show('toolInstruction', { // Using 'toolInstruction' type for error as well
            message: `Could not sample terrain heights. Error: ${error.message || 'Unknown error.'}`,
            title: `Terrain Profile Error`,
            showDismissButton: true // Ensure dismiss button for errors
        });
        // --- END NEW ---

        // Hide the panel if there's an error
        const panel = document.getElementById('terrainProfilePanel');
        if (panel) {
            panel.style.display = 'none';
        }
    }
}

function displayTerrainProfileInPanel(profileData) {
    const panel = document.getElementById('terrainProfilePanel');
    const chartDataContainer = document.getElementById('profileChartData');

    if (!panel || !chartDataContainer) {
        console.error("Terrain profile panel or data container not found in HTML.");
        // If the panel isn't found, we should inform the user via popup too.
        PopupService.show('toolInstruction', {
            message: `Terrain profile display panel not found. Ensure 'terrainProfilePanel' and 'profileChartData' elements exist in your HTML.`,
            title: `Terrain Profile Setup Error`,
            showDismissButton: true
        });
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