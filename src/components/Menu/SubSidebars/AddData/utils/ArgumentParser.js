/**
 * ArgumentParser: Handles parsing of text input for service arguments and legend options.
 * This utility class provides methods to parse key-value pairs from textarea inputs.
 */
export class ArgumentParser {
    /**
     * Parses plain text arguments into a structured object for WMS/WMTS,
     * adapting keys based on the service type.
     * @param {string} argsText - The raw text string from the arguments textarea
     * @param {string} contentType - The type of service ('wms' or 'wmts')
     * @returns {object} - The parsed arguments object
     */
    static parseArgsText(argsText, contentType) {
        const args = {};

        // Add default common arguments, these can be overridden by user input
        args.transparent = true;
        args.tiled = true; // For WMTS, tiling is inherent, but 'tiled: true' is a valid option.

        // Crucial: Add a default style for WMTS if not provided by the user.
        // Many WMTS services require a style parameter.
        if (contentType === 'wmts') {
            args.style = 'default'; // Common default. Check service capabilities for correct style.
        }

        if (!argsText || typeof argsText !== 'string') {
            return args;
        }

        const lines = argsText.split('\n');
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;

            const parsedKeyValue = this._parseKeyValueLine(trimmedLine);
            if (!parsedKeyValue) {
                console.warn(`ArgumentParser: Could not parse argument line: "${trimmedLine}". Skipping.`);
                continue;
            }

            const { key, value } = parsedKeyValue;
            this._processArgumentKeyValue(key, value, args, contentType);
        }

        return args;
    }

    /**
     * Parses plain text legend options into a structured object.
     * It expects key-value pairs like "key: value" or "key - value".
     * It also handles multi-line descriptions.
     * @param {string} legendText - The raw text string from the legend options textarea
     * @returns {object} - The parsed legend options object
     */
    static parseLegendText(legendText) {
        const legendOptions = {};
        
        if (!legendText || typeof legendText !== 'string') {
            return legendOptions;
        }

        const lines = legendText.split('\n');
        let currentKey = null;

        for (let i = 0; i < lines.length; i++) {
            const trimmedLine = lines[i].trim();
            if (!trimmedLine) continue;

            const parsedKeyValue = this._parseKeyValueLine(trimmedLine);
            if (parsedKeyValue) {
                currentKey = parsedKeyValue.key.toLowerCase();
                // Store the value, removing potential surrounding quotes
                legendOptions[currentKey] = parsedKeyValue.value;
            } else if (currentKey && currentKey === 'description') {
                // If it's a continuation of a multi-line description, append to it
                legendOptions[currentKey] += '\n' + trimmedLine;
            } else {
                console.warn(`ArgumentParser: Could not parse legend line: "${trimmedLine}". Skipping.`);
            }
        }

        return legendOptions;
    }

    /**
     * Parses a single line for key-value pairs
     * @param {string} line - The line to parse
     * @returns {object|null} - Object with key and value, or null if parsing fails
     * @private
     */
    static _parseKeyValueLine(line) {
        const match = line.match(/^(\w+)\s*[:-]\s*(.*)$/);
        if (match && match.length === 3) {
            return {
                key: match[1].toLowerCase(),
                value: match[2].trim().replace(/^"|"$/g, '') // Remove surrounding quotes
            };
        }
        return null;
    }

    /**
     * Processes a parsed key-value pair based on service type
     * @param {string} key - The argument key
     * @param {string} value - The argument value
     * @param {object} args - The arguments object to modify
     * @param {string} contentType - The service type ('wms' or 'wmts')
     * @private
     */
    static _processArgumentKeyValue(key, value, args, contentType) {
        switch (key) {
            case 'url':
                // Base URL is handled by a separate input field, so ignore it here
                console.warn('ArgumentParser: "URL" found in arguments text. It should be entered in the dedicated "Base URL" field.');
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
    }

    /**
     * Validates parsed arguments for completeness
     * @param {object} args - The parsed arguments
     * @param {string} contentType - The service type
     * @returns {object} - Validation result with isValid and missing properties
     */
    static validateParsedArgs(args, contentType) {
        const missing = [];

        if (contentType === 'wmts') {
            if (!args.layer) missing.push('layer');
            if (!args.tileMatrixSetID) missing.push('tileMatrixSetID (or matrixSet)');
        } else if (contentType === 'wms') {
            if (!args.layers) missing.push('layers (or layer)');
        }

        return {
            isValid: missing.length === 0,
            missing: missing
        };
    }
}