import { ValidationHelper } from "./ValidationHelper.js";

/**
 * ThreeDModelProcessor: Handles the business logic for processing 3D Model submissions.
 */
export class ThreeDModelProcessor {
  /**
   * Processes 3D Model data from either a file or URL options.
   * @param {object} payload - The form submission payload.
   * @param {File|null} file - The uploaded file, if any.
   * @returns {Promise<object>} Result object with success status and structured srcInfo/error.
   */
  static async process(payload, file) {
    if (!file && !payload.modelOptions?.url) {
      return {
        success: false,
        error: "Please provide a 3D Model file or URL with coordinates.",
      };
    }

    const srcInfo = {};

    if (file) {
      // File upload scenario
      console.log(`ThreeDModelProcessor: Received 3D Model file: ${file.name}`);
      const fileValidation = ValidationHelper.validate3DModelFile(file);
      if (!fileValidation.isValid) {
        return { success: false, error: fileValidation.error };
      }

      if (payload.modelOptions) {
        const modelValidation = ValidationHelper.validateModelOptions(
          payload.modelOptions
        );
        if (!modelValidation.isValid) {
          return { success: false, error: modelValidation.error };
        }
        Object.assign(srcInfo, payload.modelOptions);
      }
      srcInfo.fileContent = file;
    } else {
      // URL-based scenario
      console.log(
        `ThreeDModelProcessor: Processing 3D Model from URL: ${payload.modelOptions.url}`
      );
      const urlValidation = ValidationHelper.validateUrl(
        payload.modelOptions.url
      );
      if (!urlValidation.isValid) {
        return {
          success: false,
          error: `Invalid model URL: ${urlValidation.error}`,
        };
      }

      const modelValidation = ValidationHelper.validateModelOptions(
        payload.modelOptions
      );
      if (!modelValidation.isValid) {
        return { success: false, error: modelValidation.error };
      }
      Object.assign(srcInfo, payload.modelOptions);
    }

    console.log("ThreeDModelProcessor: Successfully processed 3D Model.");
    return { success: true, srcInfo };
  }
}
