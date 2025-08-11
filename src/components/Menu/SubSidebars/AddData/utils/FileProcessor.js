/**
 * FileProcessor: Handles file reading operations for different file types.
 * This utility class provides methods to read files as text or binary data.
 */
export class FileProcessor {
    /**
     * Reads file content as text with UTF-8 encoding
     * @param {File} file - The File object to read
     * @returns {Promise<string>} - A promise that resolves with the file content
     */
    static async readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            const encoding = 'UTF-8'; // Explicitly set UTF-8 for text files
            
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error(`Failed to read file: ${e.target.error?.message || 'Unknown error'}`));
            
            reader.readAsText(file, encoding);
        });
    }

    /**
     * Reads file content as ArrayBuffer (for binary files like GLB)
     * @param {File} file - The File object to read
     * @returns {Promise<ArrayBuffer>} - A promise that resolves with the file content as ArrayBuffer
     */
    static async readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error(`Failed to read file: ${e.target.error?.message || 'Unknown error'}`));
            
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * Reads file content as data URL
     * @param {File} file - The File object to read
     * @returns {Promise<string>} - A promise that resolves with the file content as data URL
     */
    static async readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error(`Failed to read file: ${e.target.error?.message || 'Unknown error'}`));
            
            reader.readAsDataURL(file);
        });
    }

    /**
     * Gets the file extension from a filename
     * @param {string} filename - The filename to parse
     * @returns {string} - The file extension (lowercase, without dot)
     */
    static getFileExtension(filename) {
        if (!filename || typeof filename !== 'string') {
            return '';
        }
        
        const lastDotIndex = filename.lastIndexOf('.');
        if (lastDotIndex === -1) {
            return '';
        }
        
        return filename.slice(lastDotIndex + 1).toLowerCase();
    }

    /**
     * Validates if a file is a valid text-based geo file
     * @param {File} file - The file to validate
     * @param {string} expectedType - The expected file type (geojson, kml, czml)
     * @returns {object} - Validation result with isValid and error properties
     */
    static validateTextGeoFile(file, expectedType) {
        if (!file) {
            return {
                isValid: false,
                error: 'No file provided'
            };
        }

        const extension = this.getFileExtension(file.name);
        const validExtensions = {
            'geojson': ['geojson', 'json'],
            'kml': ['kml', 'kmz'],
            'czml': ['czml', 'json']
        };

        if (!validExtensions[expectedType]?.includes(extension)) {
            return {
                isValid: false,
                error: `Invalid file type. Expected ${validExtensions[expectedType]?.join(' or ')} file for ${expectedType.toUpperCase()}.`
            };
        }

        // Check file size (e.g., 50MB limit)
        const maxSize = 50 * 1024 * 1024; // 50MB
        if (file.size > maxSize) {
            return {
                isValid: false,
                error: `File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds the 50MB limit.`
            };
        }

        return { isValid: true };
    }

    /**
     * Validates if a file is a valid 3D model file
     * @param {File} file - The file to validate
     * @returns {object} - Validation result with isValid and error properties
     */
    static validate3DModelFile(file) {
        if (!file) {
            return {
                isValid: false,
                error: 'No file provided'
            };
        }

        const extension = this.getFileExtension(file.name);
        const validExtensions = ['gltf', 'glb', 'zip'];

        if (!validExtensions.includes(extension)) {
            return {
                isValid: false,
                error: 'Unsupported 3D model file type. Please upload a .gltf, .glb, or .zip file.'
            };
        }

        // Special warning for GLTF files
        if (extension === 'gltf') {
            return {
                isValid: false,
                error: 'Uploaded .gltf file. If the model has external resources (like .bin or textures), please convert it to a single .glb file for proper loading.'
            };
        }

        // Check file size (e.g., 100MB limit for 3D models)
        const maxSize = 100 * 1024 * 1024; // 100MB
        if (file.size > maxSize) {
            return {
                isValid: false,
                error: `File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds the 100MB limit.`
            };
        }

        return { isValid: true };
    }
}