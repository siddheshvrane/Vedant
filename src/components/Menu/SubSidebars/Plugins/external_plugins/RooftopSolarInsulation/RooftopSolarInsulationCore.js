// RooftopSolarInsulationCore.js

import * as Cesium from "cesium";
import {
  getToolState,
  setToolState,
  removeEventHandlers,
  clearDrawing,
} from "../../../BasicTools/tool-helpers/tools-helpers";
import { PopupService } from "../../../../../../services/PopupService";
import BuildingStats from "./BuildingStats.vue";

let buildingEntities = [];
let lastSelectedEntity = null;
let viewerRef = null;

export function setupRooftopSolarInsulationTool(viewer, options) {
  if (!viewer) {
    console.warn("[RooftopSolarInsulation] Viewer unavailable.");
    return;
  }

  clearRooftopSolarInsulation();
  setToolState({ viewer });
  viewerRef = viewer;

  // Enable Cesium shadows
  viewer.shadows = true;
  viewer.scene.shadowMap.enabled = true;
  updateShadowTime(options.shadowTime);

  const zoomLevel = getZoomLevel(viewer);
  if (zoomLevel < 6) {
    alert("Please zoom in further to load buildings.");
    return;
  }

  const extent = getAccurateScreenExtent(viewer);
  if (!extent) {
    alert("Unable to determine screen extent.");
    return;
  }

  const url = `https://vedas.sac.gov.in/vone/vec_tile_leh?l=${extent.west}&r=${extent.east}&t=${extent.north}&b=${extent.south}`;
  console.log("[Rooftop] Fetching extent from:", url);

  fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP Error: ${res.statusText}`);
      return res.json();
    })
    .then((geojson) => {
      geojson = scaleZValuesInGeoJSON(geojson);
      const { west, east, south, north } = extent;
      const visibleEntities = [];

      geojson.features.forEach((feature) => {
        if (feature.geometry?.type !== "MultiPolygon") return;

        const polygons = feature.geometry.coordinates;
        const props = feature.properties;
        const bbox = feature.bbox;

        const lon = (bbox[0] + bbox[2]) / 2;
        const lat = (bbox[1] + bbox[3]) / 2;
        if (lon < west || lon > east || lat < south || lat > north) return;

        const height = coordZ(polygons[0]) || props.height || 10;
        const seasonValue = getSeasonValue(props, options.selectedSeason);
        const color = getMaterialColor(
          options.selectedSeason === "height" ? height : seasonValue,
          options.selectedSeason !== "height"
        );

        polygons.forEach((polygon) => {
          polygon.forEach((ring) => {
            const positions = ring.map((coord) =>
              Cesium.Cartesian3.fromDegrees(coord[0], coord[1], 0)
            );
            console.log("Building Feature:", feature);

            const entity = viewer.entities.add({
              polygon: {
                hierarchy: new Cesium.PolygonHierarchy(positions),
                extrudedHeight: height,
                height: 0,
                material: color,
                outline: true,
                outlineColor: Cesium.Color.DARKGRAY,
                heightReference: Cesium.HeightReference.CLAMP_TO_TERRAIN,
                extrudedHeightReference:
                  Cesium.HeightReference.RELATIVE_TO_GROUND,
                shadows: Cesium.ShadowMode.ENABLED,
              },
              custom_prop: {
                ID: props.OBJECTID,
                centroid: [lon, lat],
                Height: height,
                March: props.March,
                June: props.June,
                September: props.September,
                December: props.December,
                Average: props.Average,

                times: props.times || [
                  "5:15",
                  "6:15",
                  "7:15",
                  "8:15",
                  "9:15",
                  "10:15",
                  "11:15",
                  "12:15",
                  "13:15",
                  "14:15",
                  "15:15",
                  "16:15",
                  "17:15",
                  "18:15",
                ],
                MarchHourly: props.MarchHourly || [
                  100, 98, 96, 94, 93, 92, 91, 91, 90, 90, 90, 90, 90, 90,
                ],
                JuneHourly: props.JuneHourly || [
                  100, 100, 99, 98, 98, 97, 97, 97, 97, 97, 97, 97, 98, 98,
                ],
                SeptemberHourly: props.SeptemberHourly || [
                  98, 97, 96, 95, 94, 94, 93, 93, 93, 93, 93, 93, 93, 93,
                ],
                DecemberHourly: props.DecemberHourly || [
                  96, 94, 93, 92, 91, 90, 89, 88, 87, 87, 87, 88, 89, 90,
                ],
              },
            });

            visibleEntities.push(entity);
          });
        });
      });

      buildingEntities = visibleEntities;
      console.log(`[Rooftop] ✅ Rendered ${visibleEntities.length} buildings.`);
    })
    .catch((err) => {
      console.error("[Rooftop] ❌ Fetch error:", err);
      alert("Failed to load rooftop building data.");
    });

  viewer.selectedEntityChanged.addEventListener((selected) => {
    if (!selected || !selected.custom_prop) return;

    if (lastSelectedEntity?.polygon) {
      lastSelectedEntity.polygon.outlineColor = Cesium.Color.DARKGRAY;
    }

    selected.polygon.outlineColor = Cesium.Color.RED;
    selected.polygon.outlineWidth = 3;
    lastSelectedEntity = selected;

    const props = selected.custom_prop;
    const lat = parseFloat(props.centroid[1]).toFixed(5);
    const lon = parseFloat(props.centroid[0]).toFixed(5);

    PopupService.show({
      component: BuildingStats,
      title: "Building Solar Stats",
      props: {
        data: {
          latitude: lat,
          longitude: lon,
          height: props.Height,
          March: props.March,
          June: props.June,
          September: props.September,
          December: props.December,
          Average: props.Average,
          times: props.times,
          MarchHourly: props.MarchHourly,
          JuneHourly: props.JuneHourly,
          SeptemberHourly: props.SeptemberHourly,
          DecemberHourly: props.DecemberHourly,
        },
        onClose: () => PopupService.hide(), // required!
      },
    });
  });
}

export function clearRooftopSolarInsulation() {
  const { viewer } = getToolState();
  if (viewer && buildingEntities.length) {
    buildingEntities.forEach((e) => viewer.entities.remove(e));
  }
  buildingEntities = [];
  lastSelectedEntity = null;
  removeEventHandlers();
  clearDrawing();
  console.log("[Rooftop] Tool cleared.");
}

export function updateShadowTime(hour) {
  if (!viewerRef) return;

  const validHour =
    typeof hour === "number" && hour >= 0 && hour <= 23 ? hour : 12;
  const date = new Date();
  date.setUTCHours(validHour, 0, 0, 0); // prevents Invalid Date

  const julian = Cesium.JulianDate.fromDate(date);
  viewerRef.clock.currentTime = julian;
  viewerRef.scene.light = new Cesium.SunLight(julian);
  viewerRef.scene.shadows = true;

  if (viewerRef.scene.shadowMap) {
    viewerRef.scene.shadowMap._lightCameraDirty = true;
    viewerRef.scene.shadowMap.dirty = true;
  }

  viewerRef.scene.requestRender();
  console.log(`[Rooftop] ☀️ Shadow time updated to ${validHour}:00 UTC`);
}

// ------------------ Helpers ------------------

function getZoomLevel(viewer) {
  const height = viewer.camera.positionCartographic.height;
  return Math.floor(19 - Math.log2(height));
}

function getAccurateScreenExtent(viewer) {
  const canvas = viewer.scene.canvas;
  const topLeft = pickGlobePosition(viewer, new Cesium.Cartesian2(0, 0));
  const bottomRight = pickGlobePosition(
    viewer,
    new Cesium.Cartesian2(canvas.width, canvas.height)
  );
  if (!topLeft || !bottomRight) return null;

  const topLeftCarto = Cesium.Cartographic.fromCartesian(topLeft);
  const bottomRightCarto = Cesium.Cartographic.fromCartesian(bottomRight);

  return {
    west: Cesium.Math.toDegrees(topLeftCarto.longitude),
    north: Cesium.Math.toDegrees(topLeftCarto.latitude),
    east: Cesium.Math.toDegrees(bottomRightCarto.longitude),
    south: Cesium.Math.toDegrees(bottomRightCarto.latitude),
  };
}

function pickGlobePosition(viewer, screenPosition) {
  const ray = viewer.camera.getPickRay(screenPosition);
  return ray ? viewer.scene.globe.pick(ray, viewer.scene) : null;
}

function getSeasonValue(props, season) {
  switch (season) {
    case "march":
      return props.March;
    case "june":
      return props.June;
    case "september":
      return props.September;
    case "december":
      return props.December;
    case "average":
    default:
      return props.Average;
  }
}

function scaleZValuesInGeoJSON(geojson) {
  geojson.features.forEach((f) => {
    const height = f.properties.height;
    if (typeof height !== "number") return;

    let minZ = Infinity;
    const coords = f.geometry.coordinates;
    coords.forEach((poly) =>
      poly.forEach((ring) =>
        ring.forEach((c) => {
          if (c.length === 3 && typeof c[2] === "number") {
            minZ = Math.min(minZ, c[2]);
          }
        })
      )
    );

    if (!isFinite(minZ) || minZ === 0) return;

    coords.forEach((poly) =>
      poly.forEach((ring) =>
        ring.forEach((c) => {
          if (c.length === 3) c[2] = c[2] - minZ + height;
        })
      )
    );
  });

  return geojson;
}

function coordZ(rings) {
  let maxZ = 0;
  rings.forEach((ring) =>
    ring.forEach((coord) => {
      if (coord.length >= 3 && typeof coord[2] === "number") {
        maxZ = Math.max(maxZ, coord[2]);
      }
    })
  );
  return maxZ || 0;
}

function getMaterialColor(value, isSeasonal = false) {
  if (isSeasonal) {
    if (value <= 75) return Cesium.Color.INDIANRED;
    if (value <= 80) return Cesium.Color.LIGHTPINK;
    if (value <= 85) return Cesium.Color.PALETURQUOISE;
    if (value <= 90) return Cesium.Color.PLUM;
    if (value <= 95) return Cesium.Color.PALEGREEN;
    return Cesium.Color.KHAKI;
  } else {
    if (value <= 5) return Cesium.Color.MOCCASIN;
    if (value <= 10) return Cesium.Color.LIGHTBLUE;
    if (value <= 15) return Cesium.Color.MEDIUMAQUAMARINE;
    if (value <= 20) return Cesium.Color.PINK;
    if (value <= 25) return Cesium.Color.PLUM;
    if (value <= 30) return Cesium.Color.ORCHID;
    return Cesium.Color.INDIANRED;
  }
}
