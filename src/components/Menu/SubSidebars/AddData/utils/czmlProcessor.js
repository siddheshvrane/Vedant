import { FileProcessor } from "./FileProcessor.js";

/**
 * Parses a CZML file, validates its structure, and extracts metadata.
 * @param {File} file - The CZML file object to process.
 * @returns {Promise<object>} A promise that resolves with structured CZML data.
 */
export async function parseCzml(file) {
  const fileContent = await FileProcessor.readFileAsText(file);
  let parsedJson;

  // Step 1: Validate that the content is valid JSON
  try {
    parsedJson = JSON.parse(fileContent);
  } catch (error) {
    throw new Error(`Invalid JSON in CZML file: ${error.message}`);
  }

  // Step 2: Validate the basic CZML structure
  if (!Array.isArray(parsedJson)) {
    throw new Error("Invalid CZML format: The root element must be an array.");
  }
  if (parsedJson.length === 0 || parsedJson[0]?.id !== "document") {
    console.warn(
      "CZMLProcessor: The first packet is not a 'document' packet. This is non-standard but may still work."
    );
  }

  // Step 3: Extract useful metadata
  const documentPacket = parsedJson[0] || {};
  const documentName = documentPacket.name || file.name;
  const packetCount = parsedJson.length;

  console.log("CzmlProcessor: Successfully processed CZML content.");

  // Step 4: Return the structured data
  return {
    czmlContent: parsedJson,
    documentName: documentName,
    packetCount: packetCount,
  };
}
