import { ValidationHelper } from "./ValidationHelper.js";

/**
 * ThreeDTileProcessor: Handles the business logic for processing 3D Tile submissions.
 */
export class ThreeDTileProcessor {
  /**
   * Validates and parses the 3D Tile submission payload.
   * @param {object} payload - The form submission payload containing the baseUrl.
   * @returns {object} Result object with success status and structured srcInfo/error.
   */
  static validateAndParse(payload) {
    if (!payload.baseUrl) {
      return {
        success: false,
        error: "Please enter a URL for the 3D Tile service.",
      };
    }

    // Use the existing helper for generic URL validation
    const urlValidation = ValidationHelper.validateUrl(payload.baseUrl);
    if (!urlValidation.isValid) {
      return {
        success: false,
        error: `Invalid 3D Tile URL: ${urlValidation.error}`,
      };
    }

    // Add a specific check for the common 'tileset.json' pattern
    if (!payload.baseUrl.toLowerCase().endsWith("tileset.json")) {
      console.warn(
        `ThreeDTileProcessor: The provided URL does not end with 'tileset.json'. While not always required, this is a very common convention for Cesium 3D Tilesets.`
      );
    }

    // If all checks pass, structure the srcInfo object
    const srcInfo = {
      url: payload.baseUrl,
    };

    console.log(
      "ThreeDTileProcessor: Successfully processed 3D Tile data from URL."
    );
    return { success: true, srcInfo };
  }
}
