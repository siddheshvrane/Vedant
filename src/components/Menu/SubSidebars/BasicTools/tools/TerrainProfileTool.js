import * as Cesium from 'cesium';
import {
    clearDrawing,
    removeEventHandlers,
    addTemporaryPoint,
    addTemporaryPersistentLabel, // Corrected import: Use the temporary label helper
    getToolState,
    setToolState // For updating groundPolyline
} from '../tool-helpers/tools-helpers.js';
import { PopupService } from '../../../../../services/PopupService.js'; // IMPORTANT: Import PopupService

export function setupTerrainProfileTool() {
    clearDrawing(); // Clears any previous temporary drawings and resets tool state
    removeEventHandlers(); // Ensures no old handlers are active

    const { handler, viewer } = getToolState();

    PopupService.showToolInstruction(
        `Left-click to define start and end points of a profile line. Right-click to clear. The profile will appear in a panel.`,
        `Terrain Profile`
    );
    console.warn("Terrain Profile tool will now display a basic profile in an HTML panel.");

    let startPoint = null;
    let endPoint = null;

    handler.setInputAction((click) => {
        const cartesian = viewer.scene.pickPosition(click.position); // Pick 3D position
        if (Cesium.defined(cartesian)) { // Ensure cartesian is defined
            if (!startPoint) {
                startPoint = cartesian;
                addTemporaryPoint(startPoint);
                addTemporaryPersistentLabel(startPoint, "Start"); // Use addTemporaryPersistentLabel
            } else if (!endPoint) {
                endPoint = cartesian;
                addTemporaryPoint(endPoint);
                addTemporaryPersistentLabel(endPoint, "End"); // Use addTemporaryPersistentLabel

                // Add the ground polyline directly to the viewer and store in toolState
                const groundPolyline = viewer.entities.add({
                    polyline: {
                        positions: [startPoint, endPoint],
                        width: 3,
                        material: Cesium.Color.GREEN,
                        clampToGround: true // Profile line should follow terrain
                    }
                });
                setToolState({ groundPolyline: groundPolyline }); // Update state to track this entity for clearing

                generateTerrainProfile(startPoint, endPoint);

                PopupService.showToolInstruction(
                    `End point set. Right-click to clear the profile.`,
                    `Terrain Profile`
                );
            }
        } else {
            console.warn("Terrain Profile: Could not pick a valid position.");
            PopupService.showToolInstruction(
                `Could not pick a valid position. Please click on the globe.`,
                `Terrain Profile Error`,
                true
            );
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    handler.setInputAction(() => {
        clearDrawing(); // This will remove the points, labels, and the groundPolyline
        startPoint = null;
        endPoint = null;
        removeEventHandlers();
        console.log("Terrain Profile cleared.");
        
        PopupService.showToolInstruction(
            `Terrain Profile cleared. Left-click to define new profile line.`,
            `Terrain Profile`
        );
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
}

async function generateTerrainProfile(startPoint, endPoint) {
    const { viewer } = getToolState();
    if (!viewer || !startPoint || !endPoint) {
        console.error("Terrain Profile: Missing viewer, startPoint, or endPoint.");
        return;
    }

    const numberOfSamples = 200; // More samples for a smoother profile
    const interpolatedCartesians = [];

    for (let i = 0; i <= numberOfSamples; i++) {
        const ratio = i / numberOfSamples;
        const interpolated = Cesium.Cartesian3.lerp(startPoint, endPoint, ratio, new Cesium.Cartesian3());
        interpolatedCartesians.push(interpolated);
    }

    try {
        PopupService.showToolInstruction(
            'Sampling terrain for profile...',
            'Processing Terrain Profile',
            false // No dismiss button during processing
        );

        // Convert Cartesians to Cartographics for terrain sampling
        const sampleCartographics = interpolatedCartesians.map(p => Cesium.Cartographic.fromCartesian(p));

        // Use Cesium.TerrainSampler.sampleTerrain for accurate terrain heights
        const clampedCartographics = await Cesium.TerrainSampler.sampleTerrain(viewer.terrainProvider, sampleCartographics);
        
        // Convert sampled Cartographics back to Cartesians (though not strictly needed for profileData, good practice)
        const clampedPositions = clampedCartographics.map(c => Cesium.Cartographic.toCartesian(c));


        const profileData = clampedCartographics.map((carto, index) => { // Use clampedCartographics directly
            // Calculate horizontal distance from the start point (on the ellipsoid surface)
            const startCarto = Cesium.Cartographic.fromCartesian(startPoint);
            const geodesic = new Cesium.EllipsoidGeodesic(startCarto, carto); // Use sampled carto directly
            const horizontalDistance = geodesic.surfaceDistance;

            return {
                distance: horizontalDistance,
                elevation: carto.height
            };
        });

        PopupService.hide(); // Hide processing popup once sampling is done.

        console.log("Terrain Profile Data (Horizontal Distance, Elevation):", profileData);
        displayTerrainProfileInPanel(profileData);

    } catch (error) {
        console.error("Error generating terrain profile:", error);
        PopupService.hide(); // Hide any processing popup
        PopupService.show('toolInstruction', {
            message: `Could not sample terrain heights. Error: ${error.message || 'Unknown error.'} Please ensure terrain is available.`,
            title: `Terrain Profile Error`,
            showDismissButton: true
        });

        // Hide the panel if there's an error
        const panel = document.getElementById('terrainProfilePanel');
        if (panel) {
            panel.style.display = 'none';
        }
    } finally {
        if (viewer.scene.requestRenderMode) {
            viewer.scene.requestRender();
        }
    }
}

function displayTerrainProfileInPanel(profileData) {
    const panel = document.getElementById('terrainProfilePanel');
    const chartDataContainer = document.getElementById('profileChartData');

    if (!panel || !chartDataContainer) {
        console.error("Terrain profile panel or data container not found in HTML.");
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

    htmlContent += `<p style="margin-top: 10px;"><em>(A full charting library like Chart.js or D3.js would render a graph here based on this data.)</em></p>`;

    chartDataContainer.innerHTML = htmlContent;
    panel.style.display = 'block'; // Show the panel
}