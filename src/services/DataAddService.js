// src/services/DataAddService.js
import { Subject } from 'rxjs';
import Data from '../datamodels/Data.js';
import Service from '../datamodels/Service.js';
import { PopupService } from './PopupService.js';
import { LayerService } from './LayerService.js';

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
     * Parses plain text arguments into a structured object for WMS/WMTS,
     * adapting keys based on the service type.
     * @param {string} argsText - The raw text string from the arguments textarea.
     * @param {string} contentType - The type of service ('wms' or 'wmts').
     * @returns {object} - The parsed arguments object.
     */
    #parseArgsText(argsText, contentType) {
        const args = {};

        // Add default common arguments, these can be overridden by user input
        args.transparent = true;
        args.tiled = true; // For WMTS, tiling is inherent, but 'tiled: true' is a valid option.

        // Crucial: Add a default style for WMTS if not provided by the user.
        // Many WMTS services require a style parameter.
        if (contentType === 'wmts') {
            args.style = 'default'; // Common default. Check service capabilities for correct style.
        }

        const lines = argsText.split('\n');
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;

            const match = trimmedLine.match(/^(\w+)\s*[:-]\s*(.*)$/);
            if (match && match.length === 3) {
                let key = match[1].toLowerCase();
                let value = match[2].trim().replace(/^"|"$/g, ''); // Remove surrounding quotes

                switch (key) {
                    case 'url':
                        // Base URL is handled by a separate input field, so ignore it here
                        console.warn('DataAddService: "URL" found in arguments text. It should be entered in the dedicated "Base URL" field.');
                        break;
                    case 'version':
                        args.version = value;
                        break;
                    case 'format':
                        args.format = value;
                        break;
                    case 'transparent':
                        args.transparent = (value.toLowerCase() === 'true');
                        break;
                    case 'tiled':
                        args.tiled = (value.toLowerCase() === 'true');
                        break;
                    case 'style':
                        // User-provided style overrides the default
                        args.style = value;
                        break;
                    case 'tilematrixset':
                    case 'matrixset': // Alias for tileMatrixSet for flexible user input
                        if (contentType === 'wmts') {
                            args.tileMatrixSetID = value; // Cesium WMTS specific property name
                        } else { // Assume WMS for other cases
                            args.srs = value; // WMS specific property name (Spatial Reference System)
                        }
                        break;
                    case 'layer':
                        if (contentType === 'wmts') {
                            args.layer = value; // Cesium WMTS specific property name (singular)
                        } else { // Assume WMS
                            args.layers = value; // Cesium WMS specific property name (plural)
                        }
                        break;
                    case 'layerextent': // Common for WMS
                    case 'tilefullextent': // Common for WMTS
                        // These define the layer's bounding box.
                        // They are typically used for camera positioning or as metadata,
                        // not direct imagery provider constructor arguments in Cesium.
                        // We'll store it as 'extent' in args for potential later use by LayerService
                        // (e.g., for zooming to the layer's extent) or for display in popups.
                        args.extent = value;
                        break;
                    default:
                        // For any other general key-value pairs, add them as-is
                        args[key] = value;
                        break;
                }
            } else {
                console.warn(`DataAddService: Could not parse argument line: "${trimmedLine}". Skipping.`);
            }
        }
        return args;
    }

    /**
     * Parses plain text legend options into a structured object.
     * It expects key-value pairs like "key: value" or "key - value".
     * It also handles multi-line descriptions.
     * @param {string} legendText - The raw text string from the legend options textarea.
     * @returns {object} - The parsed legend options object.
     */
    #parseLegendText(legendText) {
        const legendOptions = {};
        const lines = legendText.split('\n');
        let currentKey = null;

        for (let i = 0; i < lines.length; i++) {
            const trimmedLine = lines[i].trim();
            if (!trimmedLine) continue;

            const match = trimmedLine.match(/^(\w+)\s*[:-]\s*(.*)$/);
            if (match && match.length === 3) {
                currentKey = match[1].toLowerCase();
                // Store the value, removing potential surrounding quotes
                legendOptions[currentKey] = match[2].trim().replace(/^"|"$/g, '');
            } else if (currentKey && (currentKey === 'description')) {
                // If it's a continuation of a multi-line description, append to it
                legendOptions[currentKey] += '\n' + trimmedLine;
            } else {
                console.warn(`DataAddService: Could not parse legend line: "${trimmedLine}". Skipping.`);
            }
        }
        return legendOptions;
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
            let srcInfo = {};
            let fileContent;

            // Handle file uploads for GeoJSON, KML, and "Shapefile" (as GeoJSON)
            if (['geojson', 'kml', 'shapefile'].includes(payload.contentType)) {
                if (!file) {
                    this.submissionError$.next(`Please select a file for ${payload.contentType.toUpperCase()} data.`);
                    return;
                }
                try {
                    fileContent = await this.#readFileAsText(file);
                    if (payload.contentType === 'geojson' || payload.contentType === 'shapefile') {
                        // Assuming 'shapefile' content is pre-converted GeoJSON
                        srcInfo.jsonContent = JSON.parse(fileContent);
                        console.log(`DataAddService: Loaded ${payload.contentType.toUpperCase()} content as JSON.`);
                    } else if (payload.contentType === 'kml') {
                        srcInfo.kmlContent = fileContent;
                        console.log('DataAddService: Loaded KML content as text.');
                    }
                } catch (error) {
                    console.error(`DataAddService: Error processing ${payload.contentType.toUpperCase()} file:`, error);
                    this.submissionError$.next(`Failed to process ${payload.contentType.toUpperCase()} file: ${error.message || error}. Please check file content.`);
                    return;
                }
            } else {
                // For 'data' types that don't require a file upload but might have other srcInfo,
                // e.g., if you later add support for directly inputting a URL for a static GeoJSON.
                // Currently, this branch might not be hit if all 'data' types require a file.
                console.log(`DataAddService: Processing ${payload.contentType.toUpperCase()} data without file upload.`);
            }

            const dataModel = new Data(
                `data-${Date.now()}`,
                payload.contentName,
                payload.contentType,
                srcInfo // Pass the populated srcInfo
            );
            this.addData(dataModel);
            this.submissionSuccess$.next(`${payload.contentType.toUpperCase()} Data Added Successfully!`);

        } else { // Handle 'service' option (WMS/WMTS)
            if (!payload.baseUrl) {
                this.submissionError$.next('Please enter a Base URL for the service.');
                return;
            }

            // Pass contentType to the parsing function for type-specific key mapping
            const parsedArgs = this.#parseArgsText(payload.argsInput, payload.contentType);

            // Basic validation for critical arguments based on service type
            if (payload.contentType === 'wmts') {
                if (!parsedArgs.layer || !parsedArgs.tileMatrixSetID) {
                    this.submissionError$.next('For WMTS, "layer" and "tileMatrixSetID" (or "matrixSet") are required in arguments.');
                    return;
                }
            } else if (payload.contentType === 'wms') {
                if (!parsedArgs.layers) {
                    this.submissionError$.next('For WMS, "layers" (or "layer") is required in arguments.');
                    return;
                }
            } else {
                // Fallback for any other future service types if no specific args are parsed
                if (Object.keys(parsedArgs).length === 0) {
                    this.submissionError$.next('Please provide valid arguments for the service.');
                    return;
                }
            }

            const parsedLegendOptions = this.#parseLegendText(payload.legendOptionsInput);
            // Legend options can be empty, so no explicit error if it's an empty object.

            const serviceModel = new Service(
                `service-${Date.now()}`,
                payload.contentName,
                payload.contentType,
                payload.baseUrl,
                parsedArgs, // Pass the parsed object from text
                parsedLegendOptions // Pass the parsed object from text
            );
            this.addService(serviceModel);
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

        // Crucial step: Delegate to LayerService to actually add the Cesium entity/imagery layer
        LayerService.addGeoSpatialEntry(dataModel);

        let srs = 'N/A';
        let extent = 'N/A';

        // Extract SRS and Extent from srcInfo based on data type
        if (dataModel.srcInfo) {
            if (dataModel.type === 'geojson' || dataModel.type === 'shapefile') {
                // For GeoJSON (and assumed Shapefile-as-GeoJSON)
                if (dataModel.srcInfo.jsonContent) {
                    const jsonContent = dataModel.srcInfo.jsonContent;
                    if (jsonContent.crs && jsonContent.crs.properties && jsonContent.crs.properties.name) {
                        srs = jsonContent.crs.properties.name;
                    }
                    if (jsonContent.bbox) {
                        extent = JSON.stringify(jsonContent.bbox);
                    }
                }
            } else if (dataModel.type === 'kml') {
                // KML does not typically have a direct 'crs' or 'bbox' property
                // within the loaded content itself in the same way GeoJSON does.
                // If you want SRS/Extent for KML, you'd need to parse it from the KML
                // or assume WGS84, and calculate extent from its features after loading.
                // For now, it will default to 'N/A' unless explicitly set in srcInfo.
                srs = dataModel.srcInfo.srs || 'WGS84 (Assumed for KML)';
                extent = dataModel.srcInfo.extent || 'N/A'; // If you have a way to derive this
            }
        }
        // Fallback for SRS/Extent if not found above
        if (srs === 'N/A' && dataModel.srcInfo && dataModel.srcInfo.srs) {
            srs = dataModel.srcInfo.srs;
        }
        if (extent === 'N/A' && dataModel.srcInfo && dataModel.srcInfo.extent) {
            extent = dataModel.srcInfo.extent;
        }


        PopupService.show('dataAdded', {
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

        // Crucial step: Delegate to LayerService to actually add the Cesium imagery layer
        LayerService.addGeoSpatialEntry(serviceModel);

        // Determine SRS/Extent for popup based on service type and parsed arguments
        let srsDisplay = 'N/A';
        let extentDisplay = 'N/A';

        if (serviceModel.contentType === 'wmts') {
            srsDisplay = serviceModel.args.tileMatrixSetID || 'N/A'; // WMTS uses tileMatrixSetID
            extentDisplay = serviceModel.args.extent || 'N/A';       // 'extent' holds tileFullExtent
        } else if (serviceModel.contentType === 'wms') {
            srsDisplay = serviceModel.args.srs || 'N/A';             // WMS uses srs
            extentDisplay = serviceModel.args.extent || 'N/A';       // 'extent' holds layerExtent
        }

        PopupService.show('serviceAdded', {
            layerName: serviceModel.name,
            srs: srsDisplay,
            extent: extentDisplay
        });
        this.serviceAdded$.next(serviceModel);
    }
}
export const DataAddService = new DataAddServiceClass();