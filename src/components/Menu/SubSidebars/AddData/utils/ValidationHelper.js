import { FileProcessor } from './FileProcessor.js';

/**
 * ValidationHelper: Provides validation utilities for geo-spatial data and services.
 * This utility class handles validation logic for different content types and their requirements.
 */
export class ValidationHelper {
    /**
     * Validates service arguments based on service type
     * @param {string} contentType - The service type ('wms' or 'wmts')
     * @param {object} parsedArgs - The parsed arguments object
     * @returns {object} - Validation result with isValid and error properties
     */
    static validateServiceArgs(contentType, parsedArgs) {
        if (contentType === 'wmts') {
            if (!parsedArgs.layer || !parsedArgs.tileMatrixSetID) {
                return {
                    isValid: false,
                    error: 'For WMTS, "layer" and "tileMatrixSetID" (or "matrixSet") are required in arguments.'
                };
            }
        } else if (contentType === 'wms') {
            if (!parsedArgs.layers) {
                return {
                    isValid: false,
                    error: 'For WMS, "layers" (or "layer") is required in arguments.'
                };
            }
        } else {
            // Fallback for any other future service types if no specific args are parsed
            if (Object.keys(parsedArgs).length === 0) {
                return {
                    isValid: false,
                    error: 'Please provide valid arguments for the service.'
                };
            }
        }

        return { isValid: true };
    }

    /**
     * Validates 3D model file and provides specific error messages
     * @param {File} file - The 3D model file to validate
     * @returns {object} - Validation result with isValid and error properties
     */
    static validate3DModelFile(file) {
        const fileValidation = FileProcessor.validate3DModelFile(file);
        if (!fileValidation.isValid) {
            return fileValidation;
        }

        const extension = FileProcessor.getFileExtension(file.name);
        
        // Additional specific checks for 3D models
        if (extension === 'gltf') {
            console.warn(`ValidationHelper: Uploaded GLTF (.gltf) file. ` +
                        `NOTE: If this model has external .bin or texture files, they will NOT load unless converted to .glb or served from a web-accessible path.`);
            return {
                isValid: false,
                error: `Uploaded .gltf file. If the model has external resources (like .bin or textures), please convert it to a single .glb file for proper loading.`
            };
        }

        return { isValid: true };
    }

    /**
     * Validates data submission payload
     * @param {object} payload - The submission payload
     * @param {File|null} file - The uploaded file, if any
     * @returns {object} - Validation result with isValid and error properties
     */
    static validateDataSubmission(payload, file) {
        if (!payload.contentName) {
            return {
                isValid: false,
                error: 'Please enter a name for the content.'
            };
        }

        // Validate file-based data types
        if (['geojson', 'kml', 'czml'].includes(payload.contentType)) {
            if (!file) {
                return {
                    isValid: false,
                    error: `Please select a file for ${payload.contentType.toUpperCase()} data.`
                };
            }

            const fileValidation = FileProcessor.validateTextGeoFile(file, payload.contentType);
            if (!fileValidation.isValid) {
                return fileValidation;
            }
        }

        // Validate 3D model
        if (payload.contentType === '3dmodel') {
            if (!file && !payload.modelOptions?.url) {
                return {
                    isValid: false,
                    error: 'Please provide a 3D Model file or URL with coordinates.'
                };
            }

            if (file) {
                const modelValidation = this.validate3DModelFile(file);
                if (!modelValidation.isValid) {
                    return modelValidation;
                }
            }
        }

        // Validate 3D tiles
        if (payload.contentType === '3dtile') {
            if (!payload.baseUrl) {
                return {
                    isValid: false,
                    error: 'Please enter a URL for the 3D Tile service.'
                };
            }

            const urlValidation = this.validateUrl(payload.baseUrl);
            if (!urlValidation.isValid) {
                return {
                    isValid: false,
                    error: `Invalid 3D Tile URL: ${urlValidation.error}`
                };
            }
        }

        return { isValid: true };
    }

    /**
     * Validates service submission payload
     * @param {object} payload - The submission payload
     * @returns {object} - Validation result with isValid and error properties
     */
    static validateServiceSubmission(payload) {
        if (!payload.contentName) {
            return {
                isValid: false,
                error: 'Please enter a name for the service.'
            };
        }

        if (!payload.baseUrl) {
            return {
                isValid: false,
                error: 'Please enter a Base URL for the service.'
            };
        }

        const urlValidation = this.validateUrl(payload.baseUrl);
        if (!urlValidation.isValid) {
            return {
                isValid: false,
                error: `Invalid service URL: ${urlValidation.error}`
            };
        }

        return { isValid: true };
    }

    /**
     * Validates URL format
     * @param {string} url - The URL to validate
     * @returns {object} - Validation result with isValid and error properties
     */
    static validateUrl(url) {
        if (!url || typeof url !== 'string') {
            return {
                isValid: false,
                error: 'URL is required'
            };
        }

        try {
            new URL(url);
            return { isValid: true };
        } catch (error) {
            return {
                isValid: false,
                error: 'Invalid URL format'
            };
        }
    }

    /**
     * Validates coordinate values
     * @param {number} longitude - Longitude value
     * @param {number} latitude - Latitude value
     * @param {number} [elevation] - Optional elevation value
     * @returns {object} - Validation result with isValid and error properties
     */
    static validateCoordinates(longitude, latitude, elevation) {
        if (typeof longitude !== 'number' || isNaN(longitude)) {
            return {
                isValid: false,
                error: 'Longitude must be a valid number'
            };
        }

        if (typeof latitude !== 'number' || isNaN(latitude)) {
            return {
                isValid: false,
                error: 'Latitude must be a valid number'
            };
        }

        if (longitude < -180 || longitude > 180) {
            return {
                isValid: false,
                error: 'Longitude must be between -180 and 180 degrees'
            };
        }

        if (latitude < -90 || latitude > 90) {
            return {
                isValid: false,
                error: 'Latitude must be between -90 and 90 degrees'
            };
        }

        if (elevation !== undefined && (typeof elevation !== 'number' || isNaN(elevation))) {
            return {
                isValid: false,
                error: 'Elevation must be a valid number'
            };
        }

        return { isValid: true };
    }

    /**
     * Validates 3D model options
     * @param {object} modelOptions - The model options object
     * @returns {object} - Validation result with isValid and error properties
     */
    static validateModelOptions(modelOptions) {
        if (!modelOptions) {
            return {
                isValid: false,
                error: 'Model options are required'
            };
        }

        // Validate coordinates
        const coordValidation = this.validateCoordinates(
            modelOptions.longitude,
            modelOptions.latitude,
            modelOptions.elevation
        );
        if (!coordValidation.isValid) {
            return coordValidation;
        }

        // Validate scale
        if (modelOptions.scale !== undefined) {
            if (typeof modelOptions.scale !== 'number' || isNaN(modelOptions.scale) || modelOptions.scale <= 0) {
                return {
                    isValid: false,
                    error: 'Scale must be a positive number'
                };
            }
        }

        // Validate minimum pixel size
        if (modelOptions.minimumPixelSize !== undefined) {
            if (typeof modelOptions.minimumPixelSize !== 'number' || isNaN(modelOptions.minimumPixelSize) || modelOptions.minimumPixelSize < 0) {
                return {
                    isValid: false,
                    error: 'Minimum pixel size must be a non-negative number'
                };
            }
        }

        // Validate maximum scale
        if (modelOptions.maximumScale !== undefined) {
            if (typeof modelOptions.maximumScale !== 'number' || isNaN(modelOptions.maximumScale) || modelOptions.maximumScale <= 0) {
                return {
                    isValid: false,
                    error: 'Maximum scale must be a positive number'
                };
            }
        }

        return { isValid: true };
    }

    /**
     * Validates content name
     * @param {string} contentName - The content name to validate
     * @returns {object} - Validation result with isValid and error properties
     */
    static validateContentName(contentName) {
        if (!contentName || typeof contentName !== 'string') {
            return {
                isValid: false,
                error: 'Content name is required'
            };
        }

        const trimmedName = contentName.trim();
        if (trimmedName.length === 0) {
            return {
                isValid: false,
                error: 'Content name cannot be empty'
            };
        }

        if (trimmedName.length > 100) {
            return {
                isValid: false,
                error: 'Content name must be less than 100 characters'
            };
        }

        // Check for invalid characters
        const invalidChars = /[<>:"/\\|?*]/;
        if (invalidChars.test(trimmedName)) {
            return {
                isValid: false,
                error: 'Content name contains invalid characters'
            };
        }

        return { isValid: true };
    }
}