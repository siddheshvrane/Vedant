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

let clickHandler = null;

export function setupTerrainProfileTool(viewer, options = {}) {
  if (!viewer || !viewer.canvas) {
    console.warn("[TerrainProfileTool] Viewer not available.");
    return;
  }

  clearTerrainProfile();
  setToolState({ points: [], profileEntity: null });

  PopupService.showToolInstruction(
    "Click two points to generate terrain profile.",
    "Terrain Profile Tool"
  );

  const handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
  setToolState({ handler });

  handler.setInputAction(async (event) => {
    const position = viewer.scene.pickPosition(event.position);
    if (!position) return;

    const toolState = getToolState();
    const points = toolState.points || [];
    points.push(position);
    addTemporaryPoint(position);
    setToolState({ points });

    if (points.length === 2) {
      removeEventHandlers();

      PopupService.showToolInstruction(
        "Sampling terrain, please wait...",
        "Terrain Profile",
        false
      );

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
        ToolManagementService.deactivateCurrentTool();
        return;
      }

      const entity = drawProfileLine(viewer, points[0], points[1], profile);
      setToolState({ profileEntity: entity });

      PopupService.showTerrainProfileStats({ profile });

      ToolManagementService.addMeasurement(
        "Terrain Profile",
        `${(Cesium.Cartesian3.distance(points[0], points[1]) / 1000).toFixed(
          2
        )} km`,
        {
          entity: viewer.entities.getById(entity.id),
        }
      );

      // 🔽 Show popup immediately for the newly drawn profile line
      PopupService.showTerrainProfileStats({ profile });

      ToolManagementService.deactivateCurrentTool();
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
}

function drawProfileLine(viewer, start, end, profile) {
  const entity = viewer.entities.add({
    id: `terrain-profile-${Date.now()}`,
    name: "TerrainProfileLine",
    polyline: {
      positions: [start, end],
      width: 3,
      material: Cesium.Color.CYAN,
      clampToGround: true,
    },
    properties: {
      terrainProfile: profile,
    },
  });

  if (!clickHandler) {
    clickHandler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
    clickHandler.setInputAction((movement) => {
      const picked = viewer.scene.pick(movement.position);
      if (
        picked &&
        picked.id &&
        picked.id.properties &&
        picked.id.properties.terrainProfile
      ) {
        const pickedProfile = picked.id.properties.terrainProfile.getValue();
        PopupService.showTerrainProfileStats({
          profile: pickedProfile,
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
      updated = await Cesium.sampleTerrainMostDetailed(
        terrainProvider,
        positions
      );
    } else {
      updated = positions.map((c) => {
        const h = viewer.scene.globe.getHeight(c) || 0;
        return new Cesium.Cartographic(c.longitude, c.latitude, h);
      });
    }
  } catch (err) {
    console.error("Terrain sampling failed:", err);
    return [];
  }

  const totalDistance = Cesium.Cartesian3.distance(start, end);

  return updated
    .map((c, i) => ({
      lon: Cesium.Math.toDegrees(c.longitude),
      lat: Cesium.Math.toDegrees(c.latitude),
      distance: (i / sampleCount) * totalDistance,
      height: c.height,
    }))
    .filter((p) => !isNaN(p.height) && isFinite(p.height));
}

export function clearTerrainProfile() {
  const { viewer, profileEntity, handler } = getToolState();

  clearDrawing();
  removeEventHandlers();

  if (clickHandler) {
    clickHandler.destroy();
    clickHandler = null;
  }

  if (viewer && profileEntity && viewer.entities.contains(profileEntity)) {
    viewer.entities.remove(profileEntity);
  }

  setToolState({ points: [], profileEntity: null, handler: null });
  PopupService.hide();
  console.log("[TerrainProfileTool] Cleared.");
}
