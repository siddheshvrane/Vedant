import * as Cesium from "cesium";
import { ToolManagementService } from "../../../../../services/ToolManagementService.js";
import {
  getToolState,
  setToolState,
  clearDrawing,
  removeEventHandlers,
  addTemporaryPoint,
} from "../tool-helpers/tools-helpers.js";
import { PopupService } from "../../../../../services/PopupService.js";

export function setupViewshieldAnalysisTool(viewer, options) {
  clearDrawing();
  removeEventHandlers();
  setToolState({ drawingPoints: [], mousePosition: null, rayEntities: [] });

  const initial = {
    observerHeight: options.observerHeight ?? 1.75,
    viewDistance: options.viewDistance ?? 5000,
    rayCount: options.rayCount ?? 64,
  };

  PopupService.showViewshedForm({
    viewshedOptions: initial,
    onStart: (params) => placeObserver(viewer, params),
    onCancel: () => {
      ToolManagementService.deactivateCurrentTool();
      PopupService.hide();
      clearDrawing();
    },
  });
}

function placeObserver(viewer, params) {
  PopupService.showToolInstruction("Click to place observer.", "Viewshed Tool");

  let { handler } = getToolState();
  handler?.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);

  handler = handler || new Cesium.ScreenSpaceEventHandler(viewer.canvas);
  setToolState({ handler });

  handler.setInputAction(async (event) => {
    const position = viewer.scene.pickPosition(event.position);
    if (!Cesium.defined(position)) {
      PopupService.showToolInstruction("Click on terrain!", "Error", true);
      return;
    }

    const carto = Cesium.Cartographic.fromCartesian(position);
    const lon = Cesium.Math.toDegrees(carto.longitude);
    const lat = Cesium.Math.toDegrees(carto.latitude);
    const obsHeight = carto.height + params.observerHeight;

    const observer = Cesium.Cartesian3.fromDegrees(lon, lat, obsHeight);
    addTemporaryPoint(observer);
    removeEventHandlers();
    PopupService.hide();

    const { visiblePoints, hiddenPoints } = await castRays(
      viewer,
      lon,
      lat,
      obsHeight,
      params.rayCount,
      params.viewDistance
    );

    clearDrawing();

    const defs = {
      polygon: {
        hierarchy: new Cesium.PolygonHierarchy(visiblePoints),
        material: Cesium.Color.LIME.withAlpha(0.5),
        perPositionHeight: true,
      },
      points: [
        {
          position: observer,
          point: {
            pixelSize: 8,
            color: Cesium.Color.BLUE,
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 2,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        },
      ],
      labels: [
        {
          position: observer,
          label: {
            text: `Observer\nH: ${params.observerHeight}m, R: ${params.viewDistance}m`,
            font: "14pt Poppins",
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -15),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        },
      ],
    };

    if (hiddenPoints.length >= 3) {
      defs.hiddenPolygon = {
        hierarchy: new Cesium.PolygonHierarchy(hiddenPoints),
        material: Cesium.Color.RED.withAlpha(0.3),
        perPositionHeight: true,
      };
    }

    ToolManagementService.addMeasurement("Viewshed Analysis", "Viewshed", defs);
    ToolManagementService.deactivateCurrentTool();
    viewer.scene.requestRender?.();
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
}

async function castRays(viewer, lon, lat, height, rayCount, maxDist) {
  const visible = [],
    hidden = [];
  const origin = Cesium.Cartesian3.fromDegrees(lon, lat, height);
  const step = 100;

  for (let i = 0; i < rayCount; i++) {
    const heading = Cesium.Math.toRadians((i * 360) / rayCount);
    const rayResult = await traceRay(
      viewer,
      lon,
      lat,
      height,
      heading,
      maxDist,
      step
    );
    if (rayResult.visible) visible.push(rayResult.visible);
    if (rayResult.hidden) hidden.push(rayResult.hidden);

    if (i % 10 === 0) await new Promise((r) => setTimeout(r, 2));
  }

  return {
    visiblePoints: sortByHeading(visible, origin),
    hiddenPoints: sortByHeading(hidden, origin),
  };
}

async function traceRay(viewer, lon, lat, obsHeight, heading, maxDist, step) {
  let maxAngle = -Infinity;
  let last = Cesium.Cartesian3.fromDegrees(lon, lat, obsHeight);
  let lastVisible = null,
    lastHidden = null;

  for (let dist = step; dist <= maxDist; dist += step) {
    const { latitude, longitude } = getDestination(lon, lat, heading, dist);
    const terrainHeight = await getHeight(viewer, longitude, latitude);
    const target = Cesium.Cartesian3.fromDegrees(
      longitude,
      latitude,
      terrainHeight
    );

    const angle = Math.atan2(terrainHeight - obsHeight, dist);
    const isVisible = angle > maxAngle;

    const rayEntity = viewer.entities.add({
      polyline: {
        positions: [last, target],
        width: 2,
        material: isVisible ? Cesium.Color.GREEN : Cesium.Color.RED,
        clampToGround: false,
      },
    });

    getToolState().rayEntities.push(rayEntity);

    if (isVisible) {
      maxAngle = angle;
      lastVisible = target;
    } else {
      lastHidden = target;
    }

    last = target;
  }

  return { visible: lastVisible, hidden: lastHidden };
}

function getDestination(lon, lat, heading, dist) {
  const R = 6371000;
  const φ1 = Cesium.Math.toRadians(lat);
  const λ1 = Cesium.Math.toRadians(lon);
  const δ = dist / R;

  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(heading)
  );
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(heading) * Math.sin(δ) * Math.cos(φ1),
      Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2)
    );

  return {
    latitude: Cesium.Math.toDegrees(φ2),
    longitude: Cesium.Math.toDegrees(λ2),
  };
}

async function getHeight(viewer, lon, lat) {
  const carto = Cesium.Cartographic.fromDegrees(lon, lat);
  try {
    if (viewer.terrainProvider?.availability) {
      const [result] = await Cesium.sampleTerrainMostDetailed(
        viewer.terrainProvider,
        [carto]
      );
      return result?.height || 0;
    }
    return viewer.scene.globe.getHeight(carto) || 0;
  } catch {
    return 0;
  }
}

function sortByHeading(points, origin) {
  return points.sort((a, b) => {
    const angleA = Math.atan2(a.y - origin.y, a.x - origin.x);
    const angleB = Math.atan2(b.y - origin.y, b.x - origin.x);
    return angleA - angleB;
  });
}

export function clearViewshield() {
  clearDrawing();
  removeEventHandlers();
  PopupService.hide();
}
