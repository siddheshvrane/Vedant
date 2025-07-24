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

export function setupViewshieldAnalysisTool(viewer) {
  clearDrawing();
  removeEventHandlers();
  setToolState({ drawingPoints: [], mousePosition: null, rayEntities: [] });

  PopupService.showToolInstruction("Click to place observer", "Viewshed Tool");

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
    const baseHeight = carto.height;

    const observer = Cesium.Cartesian3.fromDegrees(lon, lat, baseHeight);
    addTemporaryPoint(observer);
    removeEventHandlers();

    PopupService.showViewshedForm({
      viewshedOptions: {
        observerHeight: 10,
        viewDistance: 500,
        rayCount: 16,
      },
      onStart: (params) => {
        placeObserver(viewer, {
          observerLon: lon,
          observerLat: lat,
          baseHeight,
          ...params,
        });
      },
      onCancel: () => {
        ToolManagementService.deactivateCurrentTool();
        PopupService.hide();
        clearDrawing();
      },
    });
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
}

function placeObserver(
  viewer,
  {
    observerLon: lon,
    observerLat: lat,
    baseHeight,
    observerHeight,
    viewDistance,
    rayCount,
  }
) {
  const obsHeight = baseHeight + observerHeight;
  const observer = Cesium.Cartesian3.fromDegrees(lon, lat, obsHeight);

  PopupService.showToolInstruction(
    "Sampling terrain, please wait...",
    "ViewShed Analysis",
    false
  );

  const observerPoint = viewer.entities.add({
    position: observer,
    point: {
      pixelSize: 10,
      color: Cesium.Color.DODGERBLUE,
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  });

  const observerLabel = viewer.entities.add({
    position: observer,
    label: {
      text: `Observer\nH: ${observerHeight}m, R: ${viewDistance}m`,
      font: "14pt Poppins",
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 2,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      pixelOffset: new Cesium.Cartesian2(0, -15),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  });

  runViewshedAnalysis(
    viewer,
    lon,
    lat,
    obsHeight,
    rayCount,
    viewDistance,
    observerPoint,
    observerLabel,
    observerHeight
  );
}

async function runViewshedAnalysis(
  viewer,
  lon,
  lat,
  obsHeight,
  rayCount,
  viewDistance,
  observerPoint,
  observerLabel,
  observerHeight
) {
  PopupService.showToolInstruction(
    "Sampling terrain, please wait...",
    "ViewShed Analysis",
    false
  );

  const { visiblePoints, hiddenPoints, fullCirclePoints, rayEntities } =
    await castRays(viewer, lon, lat, obsHeight, rayCount, viewDistance);

  const fullPolygon = await renderGroundPolygon(
    viewer,
    fullCirclePoints,
    Cesium.Color.RED.withAlpha(0.05)
  );
  const visiblePolygon = await renderGroundPolygon(
    viewer,
    visiblePoints,
    Cesium.Color.LIME.withAlpha(0.2)
  );
  const hiddenPolygon = await renderGroundPolygon(
    viewer,
    hiddenPoints,
    Cesium.Color.RED.withAlpha(0.2)
  );

  const createdEntities = [
    observerPoint,
    observerLabel,
    fullPolygon,
    visiblePolygon,
    hiddenPolygon,
    ...rayEntities,
  ].filter(Boolean);

  ToolManagementService.addMeasurement(
    "Viewshield Analysis",
    `Obs: ${observerHeight}m, R: ${(viewDistance / 1000).toFixed(1)}km`,
    {
      observer: observerPoint,
      label: observerLabel,
      polygons: [fullPolygon, visiblePolygon, hiddenPolygon].filter(Boolean),
      rays: rayEntities,
    }
  );

  ToolManagementService.deactivateCurrentTool();
  PopupService.hide();
  viewer.scene.requestRender?.();
}

async function castRays(viewer, lon, lat, height, rayCount, maxDist) {
  const visible = [],
    hidden = [],
    full = [],
    rayEntities = [];
  const step = 100;
  const batchSize = 8;

  const headings = Array.from({ length: rayCount }, (_, i) =>
    Cesium.Math.toRadians((i * 360) / rayCount)
  );

  for (let i = 0; i < headings.length; i += batchSize) {
    const batch = headings
      .slice(i, i + batchSize)
      .map((heading) =>
        traceRay(viewer, lon, lat, height, heading, maxDist, step)
      );

    const results = await Promise.all(batch);

    results.forEach(({ visible: v, hidden: h, endPoint, raySegments }) => {
      if (v) visible.push(v);
      if (h) hidden.push(h);
      if (endPoint) full.push(endPoint);
      if (raySegments) rayEntities.push(...raySegments);
    });
  }

  return {
    visiblePoints: sortByHeading(visible, lon, lat),
    hiddenPoints: sortByHeading(hidden, lon, lat),
    fullCirclePoints: sortByHeading(full, lon, lat),
    rayEntities,
  };
}

async function traceRay(viewer, lon, lat, obsHeight, heading, maxDist, step) {
  let maxAngle = -Infinity;
  let last = Cesium.Cartesian3.fromDegrees(lon, lat, obsHeight);
  let lastVisible = null,
    lastHidden = null,
    endPoint = null;
  const raySegments = [];

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

    const segment = viewer.entities.add({
      polyline: {
        positions: [last, target],
        width: 1.5,
        material: isVisible ? Cesium.Color.LIME : Cesium.Color.RED,
        clampToGround: true,
        classificationType: Cesium.ClassificationType.TERRAIN,
        depthFailMaterial: new Cesium.ColorMaterialProperty(
          Cesium.Color.TRANSPARENT
        ),
      },
    });
    raySegments.push(segment);

    if (isVisible) {
      maxAngle = angle;
      lastVisible = target;
    } else {
      lastHidden = target;
    }

    last = target;
    endPoint = target;
  }

  return { visible: lastVisible, hidden: lastHidden, endPoint, raySegments };
}

async function renderGroundPolygon(viewer, positions, color) {
  if (!positions || positions.length < 3) return;

  try {
    const cartoPositions = positions.map((p) =>
      Cesium.Cartographic.fromCartesian(p)
    );

    const updatedHeights = viewer.terrainProvider?.availability
      ? await Cesium.sampleTerrainMostDetailed(
          viewer.terrainProvider,
          cartoPositions
        )
      : cartoPositions.map((p) => {
          p.height = viewer.scene.globe.getHeight(p) || 0;
          return p;
        });

    const cart3D = updatedHeights.map((p) =>
      Cesium.Cartesian3.fromRadians(p.longitude, p.latitude, p.height)
    );

    return viewer.entities.add({
      polygon: {
        hierarchy: new Cesium.PolygonHierarchy(cart3D),
        material: color,
        perPositionHeight: true,
        classificationType: Cesium.ClassificationType.TERRAIN,
        depthFailMaterial: new Cesium.ColorMaterialProperty(
          Cesium.Color.TRANSPARENT
        ),
      },
    });
  } catch (err) {
    console.warn("Polygon render failed:", err);
  }
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

function sortByHeading(points, lon, lat) {
  return points.sort((a, b) => {
    const cartA = Cesium.Cartographic.fromCartesian(a);
    const cartB = Cesium.Cartographic.fromCartesian(b);
    const angleA = Math.atan2(
      cartA.longitude - Cesium.Math.toRadians(lon),
      cartA.latitude - Cesium.Math.toRadians(lat)
    );
    const angleB = Math.atan2(
      cartB.longitude - Cesium.Math.toRadians(lon),
      cartB.latitude - Cesium.Math.toRadians(lat)
    );
    return angleA - angleB;
  });
}

export function clearViewshield() {
  clearDrawing();
  removeEventHandlers();
  PopupService.hide();
}
