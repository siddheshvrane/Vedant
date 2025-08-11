import Data from '../../../../datamodels/Data.js';
import Service from '../../../../datamodels/Service.js';
import { FileProcessor } from './utils/FileProcessor.js';
import { ArgumentParser } from './utils/ArgumentParser.js';
import { ValidationHelper } from './utils/ValidationHelper.js';

/**
 * GeoSpatialProcessor: Handles the business logic for processing geo-spatial submissions.
 * This class orchestrates file processing, validation, and model creation.
 */
export class GeoSpatialProcessor {
    /**
     * Processes a geo-spatial submission and returns the appropriate model
     * @param {object} payload - The form submission payload
     * @param {File|null} file - The uploaded file, if any
     * @returns {Promise<object>} Result object with success status and model/error
     */
    static async processSubmission(payload, file) {
        try {
            if (payload.selectedOption === 'data') {
                return await this._processDataSubmission(payload, file);
            } else {
                return await this._processServiceSubmission(payload);
            }
        } catch (error) {
            console.error('GeoSpatialProcessor: Error processing submission:', error);
            return {
                success: false,
                error: `Failed to process submission: ${error.message || error}`
            };
        }
    }

    /**
     * Processes data submission (GeoJSON, KML, CZML, 3D Models, 3D Tiles)
     * @param {object} payload - The form submission payload
     * @param {File|null} file - The uploaded file, if any
     * @returns {Promise<object>} Result object
     * @private
     */
    static async _processDataSubmission(payload, file) {
        let srcInfo = {};

        // Handle file-based data types
        if (['geojson', 'kml', 'czml'].includes(payload.contentType)) {
            const fileResult = await this._processFileBasedData(payload, file);
            if (!fileResult.success) {
                return fileResult;
            }
            srcInfo = fileResult.srcInfo;
        }
        // Handle 3D Model specifically
        else if (payload.contentType === '3dmodel') {
            const modelResult = await this._process3DModel(payload, file);
            if (!modelResult.success) {
                return modelResult;
            }
            srcInfo = modelResult.srcInfo;
        }
        // Handle 3D Tiles
        else if (payload.contentType === '3dtile') {
            const tileResult = this._process3DTiles(payload);
            if (!tileResult.success) {
                return tileResult;
            }
            srcInfo = tileResult.srcInfo;
        }

        const dataModel = new Data(
            `data-${Date.now()}`,
            payload.contentName,
            payload.contentType,
            srcInfo
        );

        return {
            success: true,
            model: dataModel,
            message: `${payload.contentName || payload.contentType.toUpperCase()} Data Added Successfully!`
        };
    }

    /**
     * Processes service submission (WMS/WMTS)
     * @param {object} payload - The form submission payload
     * @returns {object} Result object
     * @private
     */
    static _processServiceSubmission(payload) {
        // Validate base URL
        if (!payload.baseUrl) {
            return {
                success: false,
                error: 'Please enter a Base URL for the service.'
            };
        }

        // Parse arguments
        const parsedArgs = ArgumentParser.parseArgsText(payload.argsInput, payload.contentType);

        // Validate required arguments
        const validationResult = ValidationHelper.validateServiceArgs(payload.contentType, parsedArgs);
        if (!validationResult.isValid) {
            return {
                success: false,
                error: validationResult.error
            };
        }

        // Parse legend options
        const parsedLegendOptions = ArgumentParser.parseLegendText(payload.legendOptionsInput);

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
            message: 'Service Added Successfully!'
        };
    }

    /**
     * Processes file-based data types (GeoJSON, KML, CZML)
     * @param {object} payload - The form submission payload
     * @param {File|null} file - The uploaded file
     * @returns {Promise<object>} Result object
     * @private
     */
    static async _processFileBasedData(payload, file) {
        if (!file) {
            return {
                success: false,
                error: `Please select a file for ${payload.contentType.toUpperCase()} data.`
            };
        }

        try {
            const fileContent = await FileProcessor.readFileAsText(file);
            const srcInfo = {};

            if (payload.contentType === 'geojson') {
                srcInfo.jsonContent = JSON.parse(fileContent);
                console.log('GeoSpatialProcessor: Loaded GeoJSON content as JSON.');
            } else if (payload.contentType === 'kml') {
                srcInfo.kmlContent = fileContent;
                console.log('GeoSpatialProcessor: Loaded KML content as text.');
            } else if (payload.contentType === 'czml') {
                srcInfo.czmlContent = JSON.parse(fileContent);
                console.log('GeoSpatialProcessor: Loaded CZML content as JSON.');
            }

            return { success: true, srcInfo };
        } catch (error) {
            console.error(`GeoSpatialProcessor: Error processing ${payload.contentType.toUpperCase()} file:`, error);
            return {
                success: false,
                error: `Failed to process ${payload.contentType.toUpperCase()} file: ${error.message || error}. Please check file content or format.`
            };
        }
    }

    /**
     * Processes 3D Model data
     * @param {object} payload - The form submission payload
     * @param {File|null} file - The uploaded file
     * @returns {Promise<object>} Result object
     * @private
     */
    static async _process3DModel(payload, file) {
        if (!file && !payload.modelOptions?.url) {
            return {
                success: false,
                error: 'Please provide a 3D Model file or URL with coordinates.'
            };
        }

        const srcInfo = {};

        if (file) {
            // File upload scenario
            console.log(`GeoSpatialProcessor: Received 3D Model file: ${file.name}`);

            // Validate file type
            const fileValidation = ValidationHelper.validate3DModelFile(file);
            if (!fileValidation.isValid) {
                return {
                    success: false,
                    error: fileValidation.error
                };
            }

            // Validate model options if provided
            if (payload.modelOptions) {
                const modelValidation = ValidationHelper.validateModelOptions(payload.modelOptions);
                if (!modelValidation.isValid) {
                    return {
                        success: false,
                        error: modelValidation.error
                    };
                }
                Object.assign(srcInfo, payload.modelOptions);
            }

            // Store the file object directly
            srcInfo.fileContent = file;
            console.log('GeoSpatialProcessor: Stored 3D Model file in srcInfo.fileContent.');

        } else if (payload.modelOptions?.url) {
            // URL-based scenario
            const urlValidation = ValidationHelper.validateUrl(payload.modelOptions.url);
            if (!urlValidation.isValid) {
                return {
                    success: false,
                    error: `Invalid model URL: ${urlValidation.error}`
                };
            }

            const modelValidation = ValidationHelper.validateModelOptions(payload.modelOptions);
            if (!modelValidation.isValid) {
                return {
                    success: false,
                    error: modelValidation.error
                };
            }

            srcInfo.url = payload.modelOptions.url;
            srcInfo.longitude = payload.modelOptions.longitude;
            srcInfo.latitude = payload.modelOptions.latitude;
            srcInfo.elevation = payload.modelOptions.elevation || 0;
            srcInfo.scale = payload.modelOptions.scale;
            srcInfo.minimumPixelSize = payload.modelOptions.minimumPixelSize;
            srcInfo.maximumScale = payload.modelOptions.maximumScale;
            console.log(`GeoSpatialProcessor: Processing 3D Model from URL: ${srcInfo.url}`);
        } else {
            return {
                success: false,
                error: 'Invalid 3D Model submission. Neither a file nor a valid URL was provided.'
            };
        }

        return { success: true, srcInfo };
    }

    /**
     * Processes 3D Tiles data
     * @param {object} payload - The form submission payload
     * @returns {object} Result object
     * @private
     */
    static _process3DTiles(payload) {
        if (!payload.baseUrl) {
            return {
                success: false,
                error: 'Please enter a URL for the 3D Tile service.'
            };
        }

        const urlValidation = ValidationHelper.validateUrl(payload.baseUrl);
        if (!urlValidation.isValid) {
            return {
                success: false,
                error: `Invalid 3D Tile URL: ${urlValidation.error}`
            };
        }

        const srcInfo = {
            url: payload.baseUrl
        };

        console.log('GeoSpatialProcessor: Processing 3D Tile data from URL.');
        return { success: true, srcInfo };
    }
}