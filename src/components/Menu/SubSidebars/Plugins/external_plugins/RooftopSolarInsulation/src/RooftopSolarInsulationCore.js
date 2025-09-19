import * as Cesium from "cesium";
import {
  getToolState,
  setToolState,
  removeEventHandlers,
  clearDrawing,
} from "../../../../BasicTools/tool-helpers/tools-helpers";
import { PopupService } from "../../../../../../../services/PopupService";
import BuildingStats from "./BuildingStats.vue";
import { eventBus } from "../../../evenBus";

let buildingEntities = [];
export let lastSelectedEntity = null;
let viewerRef = null;
let selectedEntityChangedListener = null;

// **New: store the latest options for access in selection listener**
let currentOptions = {
  selectedSeason: "",
  shadowTime: 12,
  selectedDate: null,
};

let rooftopPopupOpen = false;

// 🔹 Cache hourly datasets so repeated clicks don’t refetch
const hourlyCache = new Map();

// 🔹 Fetch per-building hourly stats
async function fetchHourlyDataForBuilding(id) {
  if (hourlyCache.has(id)) return hourlyCache.get(id);

  const res = await fetch(
    "https://vedas.sac.gov.in/vone_staging2/get_leh_data",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: String(parseInt(id, 10)) }),
    }
  );
  if (!res.ok) throw new Error(`Hourly fetch failed: ${res.statusText}`);
  const json = await res.json();

  const times = [
    "5:15",
    "5:30",
    "5:45",
    "6:00",
    "6:15",
    "6:30",
    "6:45",
    "7:00",
    "7:15",
    "7:30",
    "7:45",
    "8:00",
    "8:15",
    "8:30",
    "8:45",
    "9:00",
    "9:15",
    "9:30",
    "9:45",
    "10:00",
    "10:15",
    "10:30",
    "10:45",
    "11:00",
    "11:15",
    "11:30",
    "11:45",
    "12:00",
    "12:15",
    "12:30",
    "12:45",
    "13:00",
    "13:15",
    "13:30",
    "13:45",
    "14:00",
    "14:15",
    "14:30",
    "14:45",
    "15:00",
    "15:15",
    "15:30",
    "15:45",
    "16:00",
    "16:15",
    "16:30",
    "16:45",
    "17:00",
    "17:15",
    "17:30",
    "17:45",
    "18:00",
    "18:15",
    "18:30",
  ];

  const [m, j, s, d] = json.df;

  const data = {
    times,
    MarchHourly: (m || []).slice(0, -1),
    JuneHourly: (j || []).slice(0, -1),
    SeptemberHourly: (s || []).slice(0, -1),
    DecemberHourly: (d || []).slice(0, -1),
    March: m?.[m.length - 1],
    June: j?.[j.length - 1],
    September: s?.[s.length - 1],
    December: d?.[d.length - 1],
    Average: (() => {
      const vals = [
        m?.[m.length - 1],
        j?.[j.length - 1],
        s?.[s.length - 1],
        d?.[d.length - 1],
      ]
        .map((v) => (typeof v === "number" ? v : null))
        .filter((v) => v !== null);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    })(),
  };

  hourlyCache.set(id, data);
  return data;
}

// Normalize season string, treat empty or "none" as no season
function normalizeSeason(season) {
  if (!season) return ""; // empty string means none
  const s = season.trim().toLowerCase();
  if (s === "none") return "";
  return s;
}

// Updates building polygon colors based on selected season or height
export function updateBuildingColorsForSeason(season) {
  season = normalizeSeason(season);
  console.log(
    "[Rooftop] updateBuildingColorsForSeason called with season:",
    season
  );

  if (!buildingEntities.length) {
    console.log("[Rooftop] No building entities to update.");
    return;
  }

  for (const entity of buildingEntities) {
    if (!entity.custom_prop) continue;

    // If no season, fallback to "Average"
    const seasonValue = season
      ? getSeasonValue(entity.custom_prop, season)
      : entity.custom_prop.Average;

    entity.polygon.material = getMaterialColor(
      season === "height" ? entity.custom_prop.Height : seasonValue,
      season !== "height" && season !== ""
    );
  }
  console.log("[Rooftop] Building colors updated.");
}

// Sets up the rooftop solar insulation tool and loads buildings within visible extent
export function setupRooftopSolarInsulationTool(viewer, options) {
  console.log(
    "[Rooftop] setupRooftopSolarInsulationTool called with options:",
    options
  );

  if (!options) {
    console.warn("[Rooftop] Warning: options object missing!");
    return;
  }

  // **Save current options globally**
  currentOptions.selectedSeason = normalizeSeason(options.selectedSeason);
  currentOptions.shadowTime = options.shadowTime ?? 12;
  currentOptions.selectedDate = options.selectedDate ?? null;

  if (!viewer) {
    console.warn("[RooftopSolarInsulation] Viewer unavailable.");
    return;
  }

  clearRooftopSolarInsulation();
  setToolState({ viewer });
  viewerRef = viewer;

  viewer.shadows = true;
  viewer.scene.shadowMap.enabled = true;

  // Update shadow time with date and season info
  updateShadowTime(
    currentOptions.shadowTime,
    currentOptions.selectedDate,
    currentOptions.selectedSeason
  );

  const zoomLevel = getZoomLevel(viewer);
  console.log("[Rooftop] Current zoom level:", zoomLevel);
  if (zoomLevel < 6) {
    alert("Please zoom in further to load buildings.");
    return;
  }

  const extent = getAccurateScreenExtent(viewer);
  console.log("[Rooftop] Screen extent:", extent);
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

      for (const feature of geojson.features) {
        if (feature.geometry?.type !== "MultiPolygon") continue;

        const polygons = feature.geometry.coordinates;
        const props = feature.properties;
        const bbox = feature.bbox;

        const lon = (bbox[0] + bbox[2]) / 2;
        const lat = (bbox[1] + bbox[3]) / 2;
        if (lon < west || lon > east || lat < south || lat > north) continue;

        const height = coordZ(polygons[0]) || props.height || 10;
        // If no season, fallback to Average
        const seasonValue = currentOptions.selectedSeason
          ? getSeasonValue(props, currentOptions.selectedSeason)
          : props.Average;
        const color = getMaterialColor(
          currentOptions.selectedSeason === "height" ? height : seasonValue,
          currentOptions.selectedSeason !== "height" &&
            currentOptions.selectedSeason !== ""
        );

        for (const polygon of polygons) {
          for (const ring of polygon) {
            const positions = ring.map((coord) =>
              Cesium.Cartesian3.fromDegrees(coord[0], coord[1], 0)
            );

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
          }
        }
      }

      buildingEntities = visibleEntities;
      console.log(`[Rooftop] ✅ Rendered ${visibleEntities.length} buildings.`);
    })
    .catch((err) => {
      console.error("[Rooftop] ❌ Fetch error:", err);
      alert("Failed to load rooftop building data.");
    });

  // Clean up previous listener if any
  if (selectedEntityChangedListener && viewer.selectedEntityChanged) {
    viewer.selectedEntityChanged.removeEventListener(
      selectedEntityChangedListener
    );
  }

  selectedEntityChangedListener = async (selected) => {
    if (!selected || !selected.custom_prop) return;

    if (lastSelectedEntity?.polygon) {
      lastSelectedEntity.polygon.outlineColor = Cesium.Color.DARKGRAY;
      lastSelectedEntity.polygon.outlineWidth = 1;
    }

    selected.polygon.outlineColor = Cesium.Color.RED;
    selected.polygon.outlineWidth = 3;
    lastSelectedEntity = selected;

    const props = selected.custom_prop;
    const lat = parseFloat(props.centroid[1]).toFixed(5);
    const lon = parseFloat(props.centroid[0]).toFixed(5);
    const id = props.ID;

    console.log(`[Rooftop] Selected building #${id} at lat:${lat}, lon:${lon}`);

    // Always fetch hourly per-building data
    let hourly;
    try {
      hourly = await fetchHourlyDataForBuilding(id);
    } catch (e) {
      console.error(e);
      // fallback to props if fetch fails
      hourly = {
        times: props.times || [],
        MarchHourly: props.MarchHourly || [],
        JuneHourly: props.JuneHourly || [],
        SeptemberHourly: props.SeptemberHourly || [],
        DecemberHourly: props.DecemberHourly || [],
        March: props.March,
        June: props.June,
        September: props.September,
        December: props.December,
        Average: props.Average,
      };
    }

    const season = currentOptions.selectedSeason || "";
    const shadowTime = currentOptions.shadowTime ?? 12;

    // Pick hourly data for current season
    let hourlyData = [];
    switch (season.toLowerCase()) {
      case "march":
        hourlyData = hourly.MarchHourly;
        break;
      case "june":
        hourlyData = hourly.JuneHourly;
        break;
      case "september":
        hourlyData = hourly.SeptemberHourly;
        break;
      case "december":
        hourlyData = hourly.DecemberHourly;
        break;
      default:
        hourlyData = []; // Or compute average curve if desired
        break;
    }

    if (!rooftopPopupOpen) {
      PopupService.show({
        isPlugin: true,
        pluginId: "rooftop-solar-insulation",
        tabTitle: "Building Solar Stats",
        component: BuildingStats,
        props: {
          data: {
            latitude: lat,
            longitude: lon,
            height: props.Height,
            March: hourly.March ?? props.March,
            June: hourly.June ?? props.June,
            September: hourly.September ?? props.September,
            December: hourly.December ?? props.December,
            Average: hourly.Average ?? props.Average,
            times: hourly.times || props.times,
            MarchHourly: hourly.MarchHourly,
            JuneHourly: hourly.JuneHourly,
            SeptemberHourly: hourly.SeptemberHourly,
            DecemberHourly: hourly.DecemberHourly,
            selectedSeason: season,
            shadowTime,
            hourlyData,
          },
          onClose: () => {
            PopupService.hide();
            rooftopPopupOpen = false;
          },
        },
      });
      rooftopPopupOpen = true;
    } else {
      // just send update if popup already open
      eventBus.emit("update-building-stats", {
        latitude: lat,
        longitude: lon,
        height: props.Height,
        March: hourly.March ?? props.March,
        June: hourly.June ?? props.June,
        September: hourly.September ?? props.September,
        December: hourly.December ?? props.December,
        Average: hourly.Average ?? props.Average,
        times: hourly.times || props.times,
        MarchHourly: hourly.MarchHourly,
        JuneHourly: hourly.JuneHourly,
        SeptemberHourly: hourly.SeptemberHourly,
        DecemberHourly: hourly.DecemberHourly,
        selectedSeason: season,
        shadowTime,
        hourlyData,
      });
    }
  };

  viewer.selectedEntityChanged.addEventListener(selectedEntityChangedListener);
}

// ... rest of your code unchanged ...

export function clearRooftopSolarInsulation() {
  const { viewer } = getToolState();
  if (viewer && buildingEntities.length) {
    for (const e of buildingEntities) {
      viewer.entities.remove(e);
    }
  }
  buildingEntities = [];
  lastSelectedEntity = null;
  removeEventHandlers();
  clearDrawing();

  // Remove event listener if any
  if (viewer && selectedEntityChangedListener) {
    viewer.selectedEntityChanged.removeEventListener(
      selectedEntityChangedListener
    );
    selectedEntityChangedListener = null;
  }

  console.log("[Rooftop] Tool cleared.");
}

// Get building data for a specific season, including current season value
export function getUpdatedBuildingDataForSeason(entity, season) {
  season = normalizeSeason(season);
  console.log(
    "[Rooftop] getUpdatedBuildingDataForSeason called with season:",
    season
  );
  if (!entity?.custom_prop) return null;

  const val = season
    ? getSeasonValue(entity.custom_prop, season)
    : entity.custom_prop.Average;
  console.log("[Rooftop] Season value for entity:", val);
  return {
    ...entity.custom_prop,
    CurrentSeasonValue: val,
  };
}

// Update Cesium scene shadows based on hour, date, and season
export function updateShadowTime(hour, dateObj, selectedSeason) {
  selectedSeason = normalizeSeason(selectedSeason);
  console.log("[Rooftop] updateShadowTime called with:", {
    hour,
    dateObj,
    selectedSeason,
  });
  if (!viewerRef) {
    console.warn("[Rooftop] Viewer reference not set.");
    return;
  }

  const validHour =
    typeof hour === "number" && hour >= 0 && hour <= 23 ? hour : 12;
  let date;

  // If season is set (and not empty), override date to seasonal fixed date only if dateObj is missing
  if (selectedSeason && !dateObj) {
    const year = new Date().getFullYear();
    switch (selectedSeason) {
      case "march":
        date = new Date(year, 2, 21); // March 21
        break;
      case "june":
        date = new Date(year, 5, 21); // June 21
        break;
      case "september":
        date = new Date(year, 8, 21); // September 21
        break;
      case "december":
        date = new Date(year, 11, 21); // December 21
        break;
      default:
        date = new Date();
        console.warn(
          "[Rooftop] updateShadowTime unknown season, using current date."
        );
    }
  } else {
    // No season or season empty string, use dateObj if provided or current date
    date = dateObj instanceof Date ? new Date(dateObj) : new Date();
  }

  date.setHours(validHour, 0, 0, 0);

  const julian = Cesium.JulianDate.fromDate(date);
  viewerRef.clock.currentTime = julian;
  viewerRef.scene.light = new Cesium.SunLight(julian);
  viewerRef.scene.shadows = true;

  if (viewerRef.scene.shadowMap) {
    viewerRef.scene.shadowMap._lightCameraDirty = true;
    viewerRef.scene.shadowMap.dirty = true;
  }

  viewerRef.scene.requestRender();
  console.log(
    `[Rooftop] ☀️ Shadow datetime updated to ${date.toLocaleString()} (local)`
  );
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
  if (!season || typeof season !== "string" || season === "") {
    console.warn(
      "[Rooftop] getSeasonValue received invalid or empty season:",
      season
    );
    return props.Average;
  }

  switch (season.toLowerCase()) {
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
  for (const feature of geojson.features) {
    const height = feature.properties.height;
    if (typeof height !== "number") continue;

    let minZ = Infinity;
    const coords = feature.geometry.coordinates;
    for (const poly of coords) {
      for (const ring of poly) {
        for (const c of ring) {
          if (c.length === 3 && typeof c[2] === "number") {
            minZ = Math.min(minZ, c[2]);
          }
        }
      }
    }

    if (!isFinite(minZ) || minZ === 0) continue;

    for (const poly of coords) {
      for (const ring of poly) {
        for (const c of ring) {
          if (c.length === 3) c[2] = c[2] - minZ + height;
        }
      }
    }
  }

  return geojson;
}

function coordZ(rings) {
  let maxZ = 0;
  for (const ring of rings) {
    for (const coord of ring) {
      if (coord.length >= 3 && typeof coord[2] === "number") {
        maxZ = Math.max(maxZ, coord[2]);
      }
    }
  }
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
