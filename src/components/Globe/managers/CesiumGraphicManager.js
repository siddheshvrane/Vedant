// src/components/Globe/managers/CesiumGraphicManager.js
import * as Cesium from 'cesium';

class CesiumGraphicManager {
    constructor(viewer) {
        if (!viewer) {
            throw new Error('Cesium Viewer instance is required for CesiumGraphicManager.');
        }
        this.viewer = viewer;
        this.currentLocationMarkerEntity = null; // For the temporary location marker
    }

    /**
     * Renders a graphic (point or polygon) on the globe.
     * @param {object} graphic - The graphic object with identifier, geometry (array of {longitude, latitude, elevation}).
     */
    renderGraphic(graphic) {
        if (!this.viewer || !graphic || !graphic.geometry || graphic.geometry.length === 0) return;

        const points = graphic.geometry.map(coord =>
            Cesium.Cartesian3.fromDegrees(coord.longitude, coord.latitude, coord.elevation || 0)
        );

        if (graphic.geometry.length === 1) {
            this.viewer.entities.add({
                position: points[0],
                point: {
                    pixelSize: 10,
                    color: Cesium.Color.RED,
                    outlineColor: Cesium.Color.WHITE,
                    outlineWidth: 2
                },
                id: graphic.identifier
            });
            console.log(`CesiumGraphicManager: Rendered point graphic: ${graphic.identifier}`);
        } else if (graphic.geometry.length > 1) {
            this.viewer.entities.add({
                polygon: {
                    hierarchy: new Cesium.PolygonHierarchy(points),
                    material: Cesium.Color.BLUE.withAlpha(0.5),
                    outline: true,
                    outlineColor: Cesium.Color.BLACK,
                    outlineWidth: 2,
                    height: 0.1
                },
                id: graphic.identifier
            });
            console.log(`CesiumGraphicManager: Rendered polygon graphic: ${graphic.identifier}`);
        }
    }

    /**
     * Removes a graphic from the globe.
     * @param {string} graphicIdentifier - The identifier of the graphic to remove.
     */
    removeGraphic(graphicIdentifier) {
        if (this.viewer) {
            const entity = this.viewer.entities.getById(graphicIdentifier);
            if (entity) {
                this.viewer.entities.remove(entity);
                console.log(`CesiumGraphicManager: Removed graphic: ${graphicIdentifier}`);
            } else {
                console.warn(`CesiumGraphicManager: Graphic with ID ${graphicIdentifier} not found to remove.`);
            }
        }
    }

    /**
     * Displays a temporary location marker with a label.
     * @param {object} location - The location object with name, identifier, and getCoordinates() method.
     */
    displayLocationMarker(location) {
        if (!this.viewer || !location || typeof location.getCoordinates !== 'function') return;

        if (this.currentLocationMarkerEntity) {
            this.viewer.entities.remove(this.currentLocationMarkerEntity);
            this.currentLocationMarkerEntity = null;
        }

        const coords = location.getCoordinates();
        if (coords) {
            const newMarkerEntity = this.viewer.entities.add({
                position: Cesium.Cartesian3.fromDegrees(coords.longitude, coords.latitude, coords.elevation || 0),
                label: {
                    text: location.name,
                    font: '14pt Poppins, sans-serif',
                    fillColor: Cesium.Color.WHITE,
                    outlineColor: Cesium.Color.BLACK,
                    outlineWidth: 2,
                    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                    pixelOffset: new Cesium.Cartesian2(0, -20)
                },
                id: `location-label-${location.identifier}`
            });
            this.currentLocationMarkerEntity = newMarkerEntity;
            console.log(`CesiumGraphicManager: Displayed location marker for: ${location.name}`);
        }
    }
}

export default CesiumGraphicManager;