// src/datamodels/Data.js
/**
 * Represents a piece of geospatial data to be added.
 * Matches the 'Data' class in the diagram. 
 */
class Data {
    /**
     * @param {string} id - Unique identifier for the data. [cite: 14]
     * @param {string} name - Name of the data. [cite: 15]
     * @param {string} type - Type of data (e.g., 'geojson', 'kml', 'tiff'). [cite: 15]
     * @param {object} srcInfo - Source information for the data. [cite: 16]
     */
    constructor(id, name, type, srcInfo = {}) {
        this.id = id; // oid [cite: 14]
        this.name = name; // Oname [cite: 15]
        this.type = type; // otype [cite: 15]
        this.srcInfo = srcInfo; // osreInfo [cite: 16]
    }
}

export default Data;