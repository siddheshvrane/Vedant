// src/datamodels/Service.js
/**
 * Represents a geospatial service to be added.
 * Matches the 'Service' class in the diagram. 
 */
class Service {
    /**
     * @param {string} id - Unique identifier for the service. [cite: 19]
     * @param {string} name - Name of the service. [cite: 19]
     * @param {string} type - Type of service (e.g., 'WMS', 'WMTS', 'WFS'). [cite: 20]
     * @param {string} baseUrl - Base URL of the service. [cite: 21]
     * @param {object} args - Additional arguments for the service request. [cite: 22]
     * @param {object} legOpts - Legend options for the service. [cite: 23]
     */
    constructor(id, name, type, baseUrl = '', args = {}, legOpts = {}) {
        this.id = id; // oid [cite: 19]
        this.name = name; // Oname [cite: 19]
        this.type = type; // otype [cite: 20]
        this.baseUrl = baseUrl; // obaseUrl [cite: 21]
        this.args = args; // Oargs [cite: 22]
        this.legOpts = legOpts; // olegOpts [cite: 23]
    }
}

export default Service;