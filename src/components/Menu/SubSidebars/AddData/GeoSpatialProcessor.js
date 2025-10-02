import Data from "../../../../datamodels/Data.js";
import Service from "../../../../datamodels/Service.js";
import { ArgumentParser } from "./utils/ArgumentParser.js";
import { ValidationHelper } from "./utils/ValidationHelper.js";
import { parseKml } from "./utils/KmlProcessor.js";
import { parseCzml } from "./utils/czmlProcessor.js";
import { ThreeDTileProcessor } from "./utils/threeDTileProcessor.js";
import { parseGeoJson } from "./utils/geojsonProcessor.js";
import { ThreeDModelProcessor } from "./utils/threeDModelProcessor.js";

/**
 * GeoSpatialProcessor: A router that delegates processing logic to specialized utilities.
 */
export class GeoSpatialProcessor {
  /**
   * Processes a geo-spatial submission by routing to the correct sub-processor.
   */
  static async processSubmission(payload, file) {
    try {
      if (payload.selectedOption === "data") {
        return await this._processDataSubmission(payload, file);
      } else {
        return this._processServiceSubmission(payload);
      }
    } catch (error) {
      console.error(
        "GeoSpatialProcessor: Error during submission routing:",
        error
      );
      return {
        success: false,
        error: `Failed to process ${payload.contentType}: ${
          error.message || error
        }`,
      };
    }
  }
  /**
   * Routes data submissions to the appropriate specialized processor.
   * @private
   */

  static async _processDataSubmission(payload, file) {
    let result;

    switch (payload.contentType) {
      case "geojson":
        const geojsonDetails = await parseGeoJson(file);
        result = { success: true, srcInfo: { geojsonDetails } };
        break;
      case "kml":
        const kmlDetails = await parseKml(file);
        result = { success: true, srcInfo: { kmlDetails } };
        break;
      case "czml":
        const czmlDetails = await parseCzml(file);
        result = { success: true, srcInfo: { czmlDetails } };
        break;
      case "3dtile":
        result = ThreeDTileProcessor.validateAndParse(payload);
        break;
      case "3dmodel":
        result = await ThreeDModelProcessor.process(payload, file);
        break;
      default:
        return {
          success: false,
          error: `Unsupported data type: ${payload.contentType}`,
        };
    }

    if (!result.success) {
      return result; // Return the error object from the sub-processor
    }

    const dataModel = new Data(
      `data-${Date.now()}`,
      payload.contentName,
      payload.contentType,
      result.srcInfo
    );

    return {
      success: true,
      model: dataModel,
      message: `${payload.contentName} Data Added Successfully!`,
    };
  }
  /**
   * Processes service submission (WMS/WMTS).
   * NOTE: This could also be refactored into its own processor in the future.
   * @private
   */

  static _processServiceSubmission(payload) {
    if (!payload.baseUrl) {
      return {
        success: false,
        error: "Please enter a Base URL for the service.",
      };
    }
    const parsedArgs = ArgumentParser.parseArgsText(
      payload.argsInput,
      payload.contentType
    );
    const validationResult = ValidationHelper.validateServiceArgs(
      payload.contentType,
      parsedArgs
    );
    if (!validationResult.isValid) {
      return { success: false, error: validationResult.error };
    }
    const parsedLegendOptions = ArgumentParser.parseLegendText(
      payload.legendOptionsInput
    );
    const serviceModel = new Service(
      `service-${Date.now()}`,
      payload.contentName,
      payload.contentType,
      payload.baseUrl,
      parsedArgs,
      parsedLegendOptions
    );
    return {
      success: true,
      model: serviceModel,
      message: "Service Added Successfully!",
    };
  }
}
