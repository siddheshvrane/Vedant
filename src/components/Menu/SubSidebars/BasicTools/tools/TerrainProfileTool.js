import * as Cesium from "cesium";
import { ToolManagementService } from "../../../../../services/ToolManagementService.js";
import {
  setToolState,
  getToolState,
  clearDrawing,
  removeEventHandlers,
  addTemporaryPoint,
} from "../tool-helpers/tools-helpers.js";
import { PopupService } from "../../../../../services/PopupService.js";

let clickHandler = null; // This handler is for clicking on an *existing* profile line

export function setupTerrainProfileTool(viewer, options = {}) {
  if (!viewer || !viewer.canvas) {
    console.warn("[TerrainProfileTool] Viewer not available.");
    return;
  }

  clearTerrainProfile(); // Ensure any previous profile/tool state is cleared
  setToolState({ points: [], profileEntity: null });

  PopupService.showToolInstruction(
    "Click two points to generate terrain profile.",
    "Terrain Profile Tool"
  );

  const handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
  setToolState({ handler }); // Store the current tool's handler

  handler.setInputAction(async (event) => {
    const position = viewer.scene.pickPosition(event.position);
    if (!position) return;

    const toolState = getToolState();
    const points = toolState.points || [];
    points.push(position);
    addTemporaryPoint(position);
    setToolState({ points });

    if (points.length === 2) {
      removeEventHandlers(); // Remove the drawing handlers

      // Show loading message using PopupService
      PopupService.showToolInstruction(
        "Sampling terrain, please wait...",
        "Terrain Profile",
        false
      ); // showDismissButton: false means no 'OK' button

      // Yield UI so loading popup appears
      await new Promise((r) => setTimeout(r, 100));

      const profile = await calculateTerrainProfile(
        viewer,
        points[0],
        points[1],
        options.sampleCount || 50
      );

      if (!Array.isArray(profile) || profile.length === 0) {
        console.warn("[TerrainProfileTool] Empty or invalid profile data.");
        PopupService.showToolInstruction(
          "Failed to generate profile. Try again."
        );
        ToolManagementService.deactivateCurrentTool(); // Deactivate tool on failure
        return;
      }

      const entity = drawProfileLine(viewer, points[0], points[1], profile);
      setToolState({ profileEntity: entity }); // Store the entity

      // NEW: Use PopupService to show the terrain profile stats
      PopupService.showTerrainProfileStats({ profile, entity });

      // The tool should remain active if the user can interact with the profile.
      // If the tool is meant to be single-use, then deactivate here:
      // ToolManagementService.deactivateCurrentTool();
      // However, usually, after showing stats, the tool becomes inactive,
      // and clicking the line re-shows the stats.
      // So, let's keep the tool active until explicitly deactivated.
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
}

function drawProfileLine(viewer, start, end, profile) {
  const entity = viewer.entities.add({
    name: "TerrainProfileLine",
    polyline: {
      positions: [start, end],
      width: 3,
      material: Cesium.Color.CYAN,
      clampToGround: true,
    },
    properties: {
      terrainProfile: profile, // Store profile data directly on entity for easy retrieval
    },
  });

  // Ensure clickHandler is set up only once for picking existing lines
  if (!clickHandler) {
    clickHandler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
    clickHandler.setInputAction((movement) => {
      const picked = viewer.scene.pick(movement.position);
      // Check if the picked entity has our terrainProfile property
      if (
        picked &&
        picked.id &&
        picked.id.properties &&
        picked.id.properties.terrainProfile
      ) {
        const pickedProfile = picked.id.properties.terrainProfile.getValue();
        // NEW: Use PopupService to show the stats when an existing line is clicked
        PopupService.showTerrainProfileStats({
          profile: pickedProfile,
          entity: picked.id,
        });
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  }

  return entity;
}

async function calculateTerrainProfile(viewer, start, end, sampleCount = 50) {
  const startCarto = Cesium.Cartographic.fromCartesian(start);
  const endCarto = Cesium.Cartographic.fromCartesian(end);

  const positions = [];
  for (let i = 0; i <= sampleCount; i++) {
    const fraction = i / sampleCount;
    const lon = Cesium.Math.lerp(
      startCarto.longitude,
      endCarto.longitude,
      fraction
    );
    const lat = Cesium.Math.lerp(
      startCarto.latitude,
      endCarto.latitude,
      fraction
    );
    positions.push(new Cesium.Cartographic(lon, lat));
  }

  const terrainProvider = viewer.terrainProvider;
  let updated = [];

  try {
    if (terrainProvider.availability) {
      // Check if terrain provider is available for sampling
      updated = await Cesium.sampleTerrainMostDetailed(
        terrainProvider,
        positions
      );
    } else {
      // Fallback if terrain provider doesn't have availability (e.g., flat globe)
      updated = positions.map((c) => {
        const h = viewer.scene.globe.getHeight(c) || 0; // Use globe height if no terrain
        return new Cesium.Cartographic(c.longitude, c.latitude, h);
      });
    }
  } catch (err) {
    console.error("Terrain sampling failed:", err);
    return []; // Return empty array on error
  }

  const totalDistance = Cesium.Cartesian3.distance(start, end);

  return updated
    .map((c, i) => ({
      lon: Cesium.Math.toDegrees(c.longitude),
      lat: Cesium.Math.toDegrees(c.latitude),
      distance: (i / sampleCount) * totalDistance,
      height: c.height,
    }))
    .filter((p) => !isNaN(p.height) && isFinite(p.height)); // Filter out invalid height values
}

export function clearTerrainProfile() {
  const { viewer, profileEntity, handler } = getToolState(); // Get the tool's handler as well

  clearDrawing(); // Clears temporary points if any
  removeEventHandlers(); // Removes the drawing action handlers

  // If there's an active clickHandler for existing lines, destroy it only when the tool is explicitly cleared.
  // This ensures existing lines are still clickable unless explicitly stated.
  if (clickHandler) {
    clickHandler.destroy();
    clickHandler = null;
  }

  if (viewer && profileEntity && viewer.entities.contains(profileEntity)) {
    viewer.entities.remove(profileEntity);
  }

  setToolState({ points: [], profileEntity: null, handler: null }); // Reset tool state
  PopupService.hide(); // Ensure any open popups (like instructions or stats) are hidden
  console.log("[TerrainProfileTool] Cleared.");
}
