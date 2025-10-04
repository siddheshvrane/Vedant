import { FileProcessor } from "./FileProcessor.js";

/**
 * Parses a GeoJSON file, validates its structure, and extracts metadata.
 * @param {File} file - The GeoJSON file object to process.
 * @returns {Promise<object>} A promise that resolves with structured GeoJSON data.
 */
export async function parseGeoJson(file) {
  const fileContent = await FileProcessor.readFileAsText(file);
  let parsedJson;

  // Step 1: Validate that the content is valid JSON
  try {
    parsedJson = JSON.parse(fileContent);
  } catch (error) {
    throw new Error(`Invalid JSON in GeoJSON file: ${error.message}`);
  }

  // Step 2: Validate basic GeoJSON structure
  if (
    !parsedJson.type ||
    !["Feature", "FeatureCollection"].includes(parsedJson.type)
  ) {
    throw new Error(
      "Invalid GeoJSON format: Missing or invalid 'type' property at the root."
    );
  }

  // Step 3: Extract useful metadata
  const name = parsedJson.name || file.name;
  const crs = parsedJson.crs?.properties?.name || "WGS84 (Assumed)";
  const featureCount =
    parsedJson.type === "FeatureCollection" ? parsedJson.features.length : 1;

  console.log("GeoJsonProcessor: Successfully processed GeoJSON content.");

  // Step 4: Return the structured data
  return {
    jsonContent: parsedJson,
    name: name,
    crs: crs,
    featureCount: featureCount,
  };
}
