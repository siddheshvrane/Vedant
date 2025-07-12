// src/services/DataAddService.js
import { Subject } from 'rxjs';
import Data from '../datamodels/Data.js';
import Service from '../datamodels/Service.js';
import { PopupService } from './PopupService.js'; // Import PopupService
import { LayerService } from './LayerService.js'; // <<< IMPORTANT: New import for LayerService

/**
 * DataAddService: Handles the logic for adding new data or services.
 */
class DataAddServiceClass {
    dataAdded$ = new Subject();
    serviceAdded$ = new Subject();
    submissionSuccess$ = new Subject();
    submissionError$ = new Subject();

    /**
     * Internal helper to read file content as text.
     * @param {File} file - The File object to read.
     * @returns {Promise<string>} - A promise that resolves with the file content.
     */
    async #readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
        });
    }

    /**
     * Internal helper to parse JSON string.
     * @param {string} jsonString - The JSON string to parse.
     * @param {string} fieldName - The name of the field for error reporting.
     * @returns {object|null} - The parsed JSON object or null if parsing fails.
     */
    #parseJson(jsonString, fieldName) {
        if (!jsonString) {
            return {};
        }
        try {
            return JSON.parse(jsonString);
        } catch (e) {
            console.error(`Error parsing ${fieldName} JSON:`, e);
            this.submissionError$.next(`Invalid JSON in ${fieldName}. Please check the syntax.`);
            return null;
        }
    }

    /**
     * Processes the complete geo-spatial content submission from the form.
     * This method handles validation, file reading, and model construction.
     * @param {object} payload - The raw form data payload from GeoSpatialForm.
     * @param {File|null} file - The uploaded File object, if any.
     */
    async processGeoSpatialSubmission(payload, file) {
        if (!payload.contentName) {
            this.submissionError$.next('Please enter a name for the content.');
            return;
        }

        if (payload.selectedOption === 'data') {
            if (payload.contentType === 'geojson') {
                if (!file) {
                    this.submissionError$.next('Please select a JSON file for GeoJSON data.');
                    return;
                }
                try {
                    const fileContent = await this.#readFileAsText(file);
                    const jsonData = JSON.parse(fileContent);

                    const dataModel = new Data(
                        `data-${Date.now()}`,
                        payload.contentName,
                        payload.contentType,
                        { jsonContent: jsonData }
                    );
                    this.addData(dataModel);
                    this.submissionSuccess$.next('GeoJSON Data Added Successfully!');
                } catch (error) {
                    console.error('DataAddService: Error processing GeoJSON file:', error);
                    this.submissionError$.next(`Failed to process GeoJSON file: ${error.message || error}. Please check file content.`);
                }
            } else {
                const dataModel = new Data(
                    `data-${Date.now()}`,
                    payload.contentName,
                    payload.contentType,
                    {}
                );
                this.addData(dataModel);
                this.submissionSuccess$.next(`${payload.contentType.toUpperCase()} Data Added Successfully!`);
            }
        } else { // Handle 'service' option
            if (!payload.baseUrl) {
                this.submissionError$.next('Please enter a Base URL for the service.');
                return;
            }

            const parsedArgs = this.#parseJson(payload.argsInput, 'Args');
            if (parsedArgs === null) return;

            const parsedLegendOptions = this.#parseJson(payload.legendOptionsInput, 'Legend Options');
            if (parsedLegendOptions === null) return;

            const serviceModel = new Service(
                `service-${Date.now()}`,
                payload.contentName,
                payload.contentType,
                payload.baseUrl,
                parsedArgs,
                parsedLegendOptions
            );
            this.addService(serviceModel); // This will now trigger the correct popup call
            this.submissionSuccess$.next('Service Added Successfully!');
        }
    }

    addData(dataModel) {
        if (!(dataModel instanceof Data)) {
            console.error('DataAddService: Invalid data model provided.', dataModel);
            this.submissionError$.next('Internal Error: Invalid data model.');
            return;
        }
        console.log('DataAddService: Processing data addition for:', dataModel);

        // --- NEW: Call LayerService to add the new data ---
        LayerService.addGeoSpatialEntry(dataModel);

        let srs = 'N/A';
        let extent = 'N/A';

        if (dataModel.type === 'geojson' && dataModel.srcInfo && dataModel.srcInfo.jsonContent) {
            const jsonContent = dataModel.srcInfo.jsonContent;
            if (jsonContent.crs && jsonContent.crs.properties && jsonContent.crs.properties.name) {
                srs = jsonContent.crs.properties.name;
            }
            if (jsonContent.bbox) {
                extent = JSON.stringify(jsonContent.bbox);
            }
        }
        if (srs === 'N/A' && dataModel.srcInfo && dataModel.srcInfo.srs) {
            srs = dataModel.srcInfo.srs;
        }
        if (extent === 'N/A' && dataModel.srcInfo && dataModel.srcInfo.extent) {
            extent = dataModel.srcInfo.extent;
        }

        // --- FIX HERE: Pass 'serviceAdded' (or 'dataAdded' if you define one) as the first argument ---
        PopupService.show('serviceAdded', { // Changed to 'serviceAdded' as per requirement, or make a separate 'dataAdded' type
            layerName: dataModel.name,
            srs: srs,
            extent: extent
        });
        this.dataAdded$.next(dataModel);
    }

    addService(serviceModel) {
        if (!(serviceModel instanceof Service)) {
            console.error('DataAddService: Invalid service model provided.', serviceModel);
            this.submissionError$.next('Internal Error: Invalid service model.');
            return;
        }
        console.log('DataAddService: Processing service addition for:', serviceModel);

        // --- NEW: Call LayerService to add the new service ---
        LayerService.addGeoSpatialEntry(serviceModel);

        // --- FIX HERE: Pass 'serviceAdded' as the first argument ---
        PopupService.show('serviceAdded', {
            layerName: serviceModel.name,
            srs: serviceModel.args.srs || 'N/A', // Assuming SRS might be in args
            extent: serviceModel.args.extent || 'N/A' // Assuming Extent might be in args
        });
        this.serviceAdded$.next(serviceModel);
    }
}
export const DataAddService = new DataAddServiceClass();