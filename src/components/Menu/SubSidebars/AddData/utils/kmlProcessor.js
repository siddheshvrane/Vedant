import * as Cesium from "cesium";
import { FileProcessor } from "./FileProcessor.js";

/**
 * Parses a KML file and extracts structured data, including coordinates.
 * @param {File} file - The KML file object to process.
 * @returns {Promise<object>} A promise that resolves with structured KML data.
 */
export async function parseKml(file) {
  const kmlText = await FileProcessor.readFileAsText(file);
  const parser = new DOMParser();
  const kmlDoc = parser.parseFromString(kmlText, "application/xml");

  const parserError = kmlDoc.querySelector("parsererror");
  if (parserError) {
    throw new Error(`Failed to parse KML file: ${parserError.innerText}`);
  }

  const placemarks = [];
  for (const placemarkNode of kmlDoc.getElementsByTagName("Placemark")) {
    const name =
      placemarkNode.getElementsByTagName("name")[0]?.textContent.trim() ||
      "Unnamed Placemark";
    const description =
      placemarkNode
        .getElementsByTagName("description")[0]
        ?.textContent.trim() || "";

    // NEW: Extract coordinates if they exist for a placemark
    let coordinates = null;
    const coordinatesNode =
      placemarkNode.getElementsByTagName("coordinates")[0];
    if (coordinatesNode) {
      // KML coordinates are in the format "longitude,latitude,altitude"
      const coordsText = coordinatesNode.textContent.trim();
      const [lon, lat, alt] = coordsText.split(",").map(Number);
      if (!isNaN(lon) && !isNaN(lat)) {
        coordinates = { lon, lat, alt: alt || 0 };
      }
    }

    placemarks.push({ name, description, coordinates });
  }

  return {
    rawContent: kmlText,
    documentName:
      kmlDoc
        .getElementsByTagName("Document")[0]
        ?.getElementsByTagName("name")[0]
        ?.textContent.trim() || file.name,
    placemarkCount: placemarks.length,
    placemarks: placemarks,
  };
}

/**
 * Renders a KML layer, adds a marker for the first placemark, and zooms.
 * @param {object} options
 * @param {Cesium.Viewer} options.viewer - The active Cesium viewer instance.
 * @param {Data} options.layerModel - The KML layer's data model.
 * @returns {Promise<object|null>} An object containing the kmlDataSource and markerEntity, or null on error.
 */
export async function renderAndZoomKml({ viewer, layerModel }) {
  if (!layerModel?.srcInfo?.kmlDetails?.rawContent) {
    console.error(
      "renderAndZoomKml: KML layer is missing rawContent.",
      layerModel
    );
    return null;
  }

  try {
    // 1. Load the KML DataSource
    const kmlDataSource = await Cesium.KmlDataSource.load(
      layerModel.srcInfo.kmlDetails.rawContent,
      {
        camera: viewer.camera,
        canvas: viewer.canvas,
        clampToGround: true, // ensures it sticks to terrain
      }
    );

    kmlDataSource.name = layerModel.name;
    await viewer.dataSources.add(kmlDataSource);

    // 2. Fly to the KML layer (only if there are entities)
    if (kmlDataSource.entities.values.length > 0) {
      await viewer.flyTo(kmlDataSource, { duration: 1.5 });
    }

    // 3. Add a marker for the first placemark with coordinates
    let markerEntity = null;
    const placemarks = layerModel.srcInfo.kmlDetails.placemarks;

    if (placemarks && placemarks.length > 0) {
      const firstPlacemark = placemarks.find((p) => p.coordinates);
      if (firstPlacemark) {
        const { lon, lat, alt = 0 } = firstPlacemark.coordinates;
        markerEntity = viewer.entities.add({
          name: `${layerModel.name} - Start Point`,
          position: Cesium.Cartesian3.fromDegrees(lon, lat, alt),
          point: {
            pixelSize: 12,
            color: Cesium.Color.DODGERBLUE,
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 2,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          label: {
            text: firstPlacemark.name,
            font: "14pt Poppins, sans-serif",
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            outlineWidth: 2,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -15),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        });
      }
    }

    console.log(
      `kmlProcessor: Successfully rendered KML and added marker for "${layerModel.name}".`
    );

    return { kmlDataSource, markerEntity };
  } catch (error) {
    console.error(
      `kmlProcessor: Error rendering KML layer "${layerModel.name}":`,
      error
    );
    return null;
  }
}
