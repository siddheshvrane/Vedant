// src/components/Globe/managers/CesiumGeoDataManager.js
import * as Cesium from 'cesium';
import { INDIA_BBOX } from './CesiumCoreManager'; // Import INDIA_BBOX from CesiumCoreManager

class CesiumGeoDataManager {
    constructor(viewer) {
        if (!viewer) {
            throw new Error('Cesium Viewer instance is required for CesiumGeoDataManager.');
        }
        this.viewer = viewer;
        // Internal map to store Cesium layer objects by their ID
        this.cesiumLayersMap = new Map();
        this.currentLocationMarkerEntity = null; // For the temporary location marker (moved from old CesiumGlobeManager)
    }

    /**
     * Adds a geospatial layer to the Cesium globe based on its type.
     * @param {object} layerEntry - The full Data or Service model.
     * @param {number} [imageryIndex] - Optional. For imagery layers, the exact index at which to insert the layer.
     * @returns {Promise<Cesium.ImageryLayer|Cesium.DataSource|null>} The Cesium layer object, or null if failed.
     */
    async addLayer(layerEntry, imageryIndex) {
        if (this.cesiumLayersMap.has(layerEntry.id)) {
            console.warn(`CesiumGeoDataManager: Layer with ID ${layerEntry.id} already known. Skipping re-add.`);
            const existingLayer = this.cesiumLayersMap.get(layerEntry.id);
            if (existingLayer) {
                existingLayer.show = layerEntry.isVisible;
            }
            return existingLayer;
        }

        let cesiumLayer = null;

        try {
            if (layerEntry.type === 'geojson' && (layerEntry.srcInfo?.jsonContent || layerEntry.url)) {
                const source = layerEntry.srcInfo?.jsonContent || layerEntry.url;
                const ds = await Cesium.GeoJsonDataSource.load(source, {
                    stroke: Cesium.Color.HOTPINK,
                    fill: Cesium.Color.PINK.withAlpha(0.5),
                    strokeWidth: 3,
                    markerSymbol: '?',
                    clampToGround: true
                });
                ds.name = layerEntry.name;
                ds.show = layerEntry.isVisible;
                this.viewer.dataSources.add(ds);
                cesiumLayer = ds;
                console.log(`CesiumGeoDataManager: Added GeoJSON layer: ${layerEntry.name}. Visible: ${ds.show}`);
            } else if (layerEntry.type === 'kml' && (layerEntry.srcInfo?.kmlContent || layerEntry.url)) {
                const source = layerEntry.srcInfo?.kmlContent || layerEntry.url;
                const ds = await Cesium.KmlDataSource.load(source, {
                    camera: this.viewer.camera,
                    canvas: this.viewer.canvas,
                    clampToGround: true
                });
                ds.name = layerEntry.name;
                ds.show = layerEntry.isVisible;
                this.viewer.dataSources.add(ds);
                cesiumLayer = ds;
                console.log(`CesiumGeoDataManager: Added KML layer: ${layerEntry.name}. Visible: ${ds.show}`);
            } else if (layerEntry.type === 'shapefile' && (layerEntry.srcInfo?.jsonContent || layerEntry.url)) { // MODIFIED: Added check for jsonContent for Shapefile
                // For Shapefile, Cesium.GeoJsonDataSource can often load it if it's a zipped shapefile (.zip)
                // containing .shp, .shx, .dbf, etc. or if it's a single .geojson derived from a shapefile.
                // Assuming the URL points to a zipped shapefile or a GeoJSON converted from one.
                const source = layerEntry.srcInfo?.jsonContent || layerEntry.url; // MODIFIED: Use source variable
                const ds = await Cesium.GeoJsonDataSource.load(source, { // MODIFIED: Pass source
                    stroke: Cesium.Color.ORANGE,
                    fill: Cesium.Color.ORANGE.withAlpha(0.5),
                    strokeWidth: 3,
                    clampToGround: true
                });
                ds.name = layerEntry.name;
                ds.show = layerEntry.isVisible;
                this.viewer.dataSources.add(ds);
                cesiumLayer = ds;
                console.log(`CesiumGeoDataManager: Added Shapefile (as GeoJSON) layer: ${layerEntry.name}. Visible: ${ds.show}`);
            }
            else if (layerEntry.type === 'wms' && layerEntry.baseUrl && layerEntry.args) {
                const wmsParameters = {
                    service: 'WMS',
                    version: layerEntry.args.version || '1.1.1',
                    request: 'GetMap',
                    format: layerEntry.args.format || 'image/png',
                    transparent: layerEntry.args.transparent !== undefined ? layerEntry.args.transparent : true,
                    layers: layerEntry.args.layers || layerEntry.name,
                    srs: layerEntry.args.srs || 'EPSG:4326',
                    tiled: layerEntry.args.tiled !== undefined ? layerEntry.args.tiled : true,
                    width: 256,
                    height: 256,
                    ...layerEntry.args
                };

                const imageryProvider = new Cesium.WebMapServiceImageryProvider({
                    url: layerEntry.baseUrl,
                    layers: wmsParameters.layers,
                    parameters: wmsParameters,
                    credit: new Cesium.Credit(layerEntry.name)
                });

                cesiumLayer = this.viewer.imageryLayers.addImageryProvider(imageryProvider, imageryIndex);
                cesiumLayer.id = layerEntry.id;
                cesiumLayer.name = layerEntry.name;
                cesiumLayer.show = layerEntry.isVisible;

                console.log(`CesiumGeoDataManager: Added WMS layer: ${layerEntry.name} at index ${imageryIndex}. Visible: ${cesiumLayer.show}`);
            } else if (layerEntry.type === 'wmts' && layerEntry.baseUrl && layerEntry.args) {
                const wmtsParameters = {
                    service: 'WMTS',
                    version: layerEntry.args.version || '1.0.0',
                    request: 'GetTile',
                    format: layerEntry.args.format || 'image/jpeg',
                    layer: layerEntry.args.layer || layerEntry.name,
                    style: layerEntry.args.style || '',
                    tileMatrixSetID: layerEntry.args.tileMatrixSetID || 'EPSG:4326',
                    tileMatrixLabels: layerEntry.args.tileMatrixLabels, // Optional, can be an array of strings
                    dimensions: layerEntry.args.dimensions, // Optional, can be an object
                    tilingScheme: layerEntry.args.tilingScheme, // Optional, Cesium.GeographicTilingScheme or Cesium.WebMercatorTilingScheme
                    credit: new Cesium.Credit(layerEntry.name),
                    minimumLevel: layerEntry.args.minimumLevel || 0,
                    maximumLevel: layerEntry.args.maximumLevel,
                    ...layerEntry.args
                };

                const imageryProvider = new Cesium.WebMapTileServiceImageryProvider({
                    url: layerEntry.baseUrl,
                    layer: wmtsParameters.layer,
                    style: wmtsParameters.style,
                    format: wmtsParameters.format,
                    tileMatrixSetID: wmtsParameters.tileMatrixSetID,
                    tileMatrixLabels: wmtsParameters.tileMatrixLabels,
                    tilingScheme: wmtsParameters.tilingScheme,
                    minimumLevel: wmtsParameters.minimumLevel,
                    maximumLevel: wmtsParameters.maximumLevel,
                    credit: wmtsParameters.credit,
                    dimensions: wmtsParameters.dimensions
                });

                cesiumLayer = this.viewer.imageryLayers.addImageryProvider(imageryProvider, imageryIndex);
                cesiumLayer.id = layerEntry.id;
                cesiumLayer.name = layerEntry.name;
                cesiumLayer.show = layerEntry.isVisible;

                console.log(`CesiumGeoDataManager: Added WMTS layer: ${layerEntry.name} at index ${imageryIndex}. Visible: ${cesiumLayer.show}`);
            } else {
                console.warn(`CesiumGeoDataManager: Unsupported layer type or missing data for ${layerEntry.name} (Type: ${layerEntry.type}).`);
                return null;
            }

            if (cesiumLayer) {
                this.cesiumLayersMap.set(layerEntry.id, cesiumLayer);
            }
            return cesiumLayer;

        } catch (error) {
            console.error(`CesiumGeoDataManager: Error adding layer ${layerEntry.name}:`, error);
            return null;
        }
    }

    /**
     * Removes a geospatial layer from the Cesium globe.
     * @param {string} layerId - The ID of the layer to remove.
     */
    removeLayer(layerId) {
        const cesiumLayer = this.cesiumLayersMap.get(layerId);
        if (cesiumLayer) {
            if (cesiumLayer instanceof Cesium.ImageryLayer) {
                this.viewer.imageryLayers.remove(cesiumLayer, true);
                console.log(`CesiumGeoDataManager: Removed ImageryLayer with ID: ${layerId}`);
            } else if (cesiumLayer instanceof Cesium.DataSource) {
                this.viewer.dataSources.remove(cesiumLayer, true);
                console.log(`CesiumGeoDataManager: Removed DataSource with ID: ${layerId}`);
            } else {
                console.warn(`CesiumGeoDataManager: Could not remove layer type for ID ${layerId}. Not an ImageryLayer or DataSource.`);
            }
            this.cesiumLayersMap.delete(layerId);
        } else {
            console.warn(`CesiumGeoDataManager: Layer with ID ${layerId} not found on globe to remove.`);
        }
    }

    /**
     * Toggles the visibility of a geospatial layer on the Cesium globe.
     * @param {string} layerId - The ID of the layer.
     * @param {boolean} isVisible - The desired visibility state.
     */
    toggleLayerVisibility(layerId, isVisible) {
        const cesiumLayer = this.cesiumLayersMap.get(layerId);
        if (cesiumLayer) {
            cesiumLayer.show = isVisible;
            console.log(`CesiumGeoDataManager: Toggled visibility for layer ${layerId} to ${isVisible}`);
        } else {
            console.warn(`CesiumGeoDataManager: Layer with ID ${layerId} not found to toggle visibility.`);
        }
    }

    /**
     * Clears all custom (non-base) layers and then re-adds/updates layers
     * based on the provided ordered list.
     * @param {Array<Object>} layersToReconcile - An ordered array of full layer entry objects.
     */
    async reconcileLayers(layersToReconcile) {
        if (!this.viewer) {
            console.warn('CesiumGeoDataManager: Viewer not initialized, cannot reconcile layers.');
            return;
        }

        console.log('CesiumGeoDataManager: Starting layer reconciliation...');
        console.log('Desired UI order (Top to Bottom):', layersToReconcile.map(l => l.name));

        // Clear all existing dynamic layers and data sources from Cesium Viewer
        this.viewer.dataSources.removeAll();
        for (let i = this.viewer.imageryLayers.length - 1; i >= 0; i--) {
            const layer = this.viewer.imageryLayers.get(i);
            this.viewer.imageryLayers.remove(layer, true);
        }
        this.cesiumLayersMap.clear(); // Clear internal map as well
        console.log('CesiumGeoDataManager: Cleared all existing dynamic globe layers and data sources.');

        // Re-add layers in the desired Cesium Z-order (bottom-up for imagery).
        const imageryLayersReversed = layersToReconcile.filter(l => ['wms', 'wmts'].includes(l.type)).reverse();
        const dataSources = layersToReconcile.filter(l => ['geojson', 'kml', 'shapefile'].includes(l.type));

        for (let i = 0; i < imageryLayersReversed.length; i++) {
            const layerEntry = imageryLayersReversed[i];
            console.log(`CesiumGeoDataManager: Adding ${layerEntry.type.toUpperCase()} layer ${layerEntry.name} (UI order: ${layersToReconcile.indexOf(layerEntry)}, Cesium index: ${i})`);
            await this.addLayer(layerEntry, i); // Pass 'i' as the Cesium imagery layer index
        }

        for (const layerEntry of dataSources) {
            console.log(`CesiumGeoDataManager: Adding ${layerEntry.type.toUpperCase()} layer ${layerEntry.name}`);
            await this.addLayer(layerEntry); // No index needed for data sources, they're typically on top
        }

        console.log('CesiumGeoDataManager: Layer reconciliation complete.');
    }

    /**
     * Zooms the globe to the extent of a specific layer.
     * @param {object} layerEntry - The full layer entry object (from LayerService).
     */
    async zoomToLayer(layerEntry) {
        if (!this.viewer) {
            console.warn('CesiumGeoDataManager: Viewer not initialized, cannot zoom to layer.');
            return;
        }

        let cesiumLayer = this.cesiumLayersMap.get(layerEntry.id);

        if (cesiumLayer instanceof Promise) {
            try {
                cesiumLayer = await cesiumLayer;
                this.cesiumLayersMap.set(layerEntry.id, cesiumLayer);
            } catch (error) {
                console.error(`CesiumGeoDataManager: Failed to resolve layer promise for zoom: ${layerEntry.id}`, error);
                return;
            }
        }

        if (!cesiumLayer) {
            console.warn(`CesiumGeoDataManager: Layer ${layerEntry.id} not found or not yet available for zoom.`);
            return;
        }

        if (cesiumLayer instanceof Cesium.ImageryLayer) {
            if (layerEntry.bbox) {
                const rect = Cesium.Rectangle.fromDegrees(
                    layerEntry.bbox[0], layerEntry.bbox[1],
                    layerEntry.bbox[2], layerEntry.bbox[3]
                );
                this.viewer.camera.flyTo({ destination: rect, duration: 1.5 });
                console.log(`CesiumGeoDataManager: Zoomed to ImageryLayer extent: ${layerEntry.name}`);
            } else if (layerEntry.id === 'vedas-satellite-imagery') {
                this.viewer.camera.flyTo({
                    destination: INDIA_BBOX, // Now imported from CesiumCoreManager
                    duration: 2.0
                });
                console.log(`CesiumGeoDataManager: Zoomed to general extent for Vedas Satellite Imagery.`);
            } else {
                console.warn(`CesiumGeoDataManager: Cannot precisely zoom to ImageryLayer ${layerEntry.name}. No extent information.`);
                this.viewer.camera.flyHome();
            }
        } else if (cesiumLayer instanceof Cesium.DataSource) {
            if (cesiumLayer.entities.values.length > 0) {
                this.viewer.flyTo(cesiumLayer.entities, { duration: 1.5 });
                console.log(`CesiumGeoDataManager: Zoomed to GeoJSON/KML/Shapefile layer: ${layerEntry.name}`);
            } else {
                console.warn(`CesiumGeoDataManager: GeoJSON/KML/Shapefile layer ${layerEntry.name} has no entities to zoom to.`);
                this.viewer.camera.flyHome();
            }
        } else {
            console.warn(`CesiumGeoDataManager: Unsupported layer type for zooming: ${layerEntry.type}`);
            this.viewer.camera.flyHome();
        }
    }


    // --- Graphic Management Methods (from old CesiumGlobeManager) ---

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
        } else if (graphic.geometry.length > 1) {
            this.viewer.entities.add({
                polygon: {
                    hierarchy: new Cesium.PolygonHierarchy(points),
                    material: Cesium.Color.BLUE.withAlpha(0.5),
                    outline: true,
                    outlineColor: Cesium.Color.BLACK,
                    outlineWidth: 2,
                },
                id: graphic.identifier
            });
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
            this.currentLocationMarkerEntity = newMarkerEntity; // Store reference to remove later
        }
    }
}

export default CesiumGeoDataManager;