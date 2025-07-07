// src/datamodels/Location.js

/**
 * Represents a geographical location with a name and coordinates.
 */
class Location {
    /**
     * @param {string} name - The name of the location (e.g., "Ahmedabad").
     * @param {number} longitude - The longitude of the location.
     * @param {number} latitude - The latitude of the location.
     * @param {number} [elevation=0] - The elevation of the location (optional, defaults to 0).
     * @param {string} [id] - Optional ID from GeoJSON properties.
     * @param {string} [country] - Optional country from GeoJSON properties.
     * @param {string} [description] - Optional description from GeoJSON properties.
     */
    constructor(name, longitude, latitude, elevation = 0, id = null, country = null, description = null) {
        if (typeof name !== 'string' || name.trim() === '') {
            throw new Error('Location name must be a non-empty string.');
        }
        if (typeof longitude !== 'number' || typeof latitude !== 'number') {
            throw new Error('Longitude and Latitude must be numbers.');
        }

        this.id = id; // New: to store GeoJSON 'id'
        this.name = name;
        this.longitude = longitude;
        this.latitude = latitude;
        this.elevation = elevation;
        this.country = country;     // New: to store GeoJSON 'country'
        this.description = description; // New: to store GeoJSON 'description'

        // A unique identifier for Cesium entities, especially useful if 'id' from GeoJSON isn't always unique
        this.identifier = this.id || `${name}-${longitude}-${latitude}`;
    }

    /**
     * Creates a Location instance from a GeoJSON Feature object.
     * @param {Object} feature - A GeoJSON Feature object.
     * @returns {Location} A new Location instance.
     */
    static fromGeoJSONFeature(feature) {
        const { properties, geometry } = feature;
        if (!geometry || geometry.type !== 'Point' || !geometry.coordinates) {
            console.warn('Invalid GeoJSON feature for Location:', feature);
            return null; // Or throw an error
        }
        const [longitude, latitude, elevation = 0] = geometry.coordinates;
        return new Location(
            properties.name,
            longitude,
            latitude,
            elevation,
            properties.id,
            properties.country,
            properties.description
        );
    }

    /**
     * Returns the coordinates in a format suitable for Cesium operations.
     * @returns {{longitude: number, latitude: number, elevation: number}}
     */
    getCoordinates() {
        return {
            longitude: this.longitude,
            latitude: this.latitude,
            elevation: this.elevation
        };
    }

    /**
     * Returns a display string for the location.
     * @returns {string}
     */
    toString() {
        return `${this.name} (${this.latitude.toFixed(4)}, ${this.longitude.toFixed(4)})`;
    }
}

export default Location;