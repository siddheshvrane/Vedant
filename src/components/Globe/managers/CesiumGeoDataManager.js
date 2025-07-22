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
     * For '3dmodel', layerEntry.srcInfo should contain:
     * {
     * gltfData: File | Blob, // The actual GLTF/GLB file data (optional, if model is URL-based)
     * url: string, // URL to the GLTF/GLB file (required if gltfData is not provided)
     * longitude: number,
     * latitude: number,
     * elevation: number,
     * scale: number,
     * minimumPixelSize: number,
     * maximumScale: number
     * }
     * @param {number} [imageryIndex] - Optional. For imagery layers, the exact index at which to insert the layer.
     * @returns {Promise<Cesium.ImageryLayer|Cesium.DataSource|Cesium.Cesium3DTileset|Cesium.Entity|null>} The Cesium layer object, or null if failed.
     */
    async addLayer(layerEntry, imageryIndex) {
        if (this.cesiumLayersMap.has(layerEntry.id)) {
            console.warn(`CesiumGeoDataManager: Layer with ID ${layerEntry.id} already known. Skipping re-add.`);
            const existingLayer = this.cesiumLayersMap.get(layerEntry.id);
            if (existingLayer) {
                // Handle visibility for different Cesium object types
                if (existingLayer instanceof Cesium.ImageryLayer || existingLayer instanceof Cesium.DataSource || existingLayer instanceof Cesium.Cesium3DTileset) {
                    existingLayer.show = layerEntry.isVisible;
                } else if (existingLayer instanceof Cesium.Entity) {
                    existingLayer.show = layerEntry.isVisible;
                }
            }
            return existingLayer;
        }

        let cesiumLayer = null;
        let blobUrlForCleanup = null; // To hold the Blob URL temporarily for immediate cleanup on error

        try {
            if (layerEntry.type === 'geojson' && layerEntry.srcInfo?.jsonContent) {
                const ds = await Cesium.GeoJsonDataSource.load(layerEntry.srcInfo.jsonContent, {
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
            } else if (layerEntry.type === 'kml' && layerEntry.srcInfo?.kmlContent) {
                const ds = await Cesium.KmlDataSource.load(layerEntry.srcInfo.kmlContent, {
                    camera: this.viewer.camera,
                    canvas: this.viewer.canvas,
                    clampToGround: true
                });
                ds.name = layerEntry.name;
                ds.show = layerEntry.isVisible;
                this.viewer.dataSources.add(ds);
                cesiumLayer = ds;
                console.log(`CesiumGeoDataManager: Added KML layer: ${layerEntry.name}. Visible: ${ds.show}`);
            } else if (layerEntry.type === 'czml' && layerEntry.srcInfo?.czmlContent) {
                const ds = await Cesium.CzmlDataSource.load(layerEntry.srcInfo.czmlContent);
                ds.name = layerEntry.name;
                ds.show = layerEntry.isVisible;
                this.viewer.dataSources.add(ds);
                cesiumLayer = ds;
                console.log(`CesiumGeoDataManager: Added CZML layer: ${layerEntry.name}. Visible: ${ds.show}`);
            } else if (layerEntry.type === '3dtile' && layerEntry.srcInfo?.url) {
                const tileset = await Cesium.Cesium3DTileset.fromUrl(layerEntry.srcInfo.url);
                this.viewer.scene.primitives.add(tileset);
                tileset.show = layerEntry.isVisible;
                // Optionally, adjust tileset properties if needed, e.g., height offset
                // tileset.with = new Cesium.Cartesian3(0, 0, -10.0); // Example: adjust height
                cesiumLayer = tileset;
                console.log(`CesiumGeoDataManager: Added 3D Tile layer: ${layerEntry.name}. Visible: ${tileset.show}`);
            } else if (layerEntry.type === '3dmodel' && layerEntry.srcInfo) {
                let modelUri = layerEntry.srcInfo.url; // Prefer URL if provided

                if (layerEntry.srcInfo.gltfData instanceof File || layerEntry.srcInfo.gltfData instanceof Blob) {
                    // If file data is provided, create a Blob URL
                    blobUrlForCleanup = URL.createObjectURL(layerEntry.srcInfo.gltfData);
                    modelUri = blobUrlForCleanup;
                    console.log(`CesiumGeoDataManager: Created Blob URL for 3D Model: ${modelUri}`);
                } else if (!modelUri) {
                    console.warn(`CesiumGeoDataManager: 3D Model layer ${layerEntry.name} requires either gltfData (File/Blob) or a 'url' in srcInfo.`);
                    return null;
                }

                const position = Cesium.Cartesian3.fromDegrees(
                    // These are the coordinates you must provide for the model's placement
                    (layerEntry.srcInfo.longitude || INDIA_BBOX.west + (INDIA_BBOX.east - INDIA_BBOX.west) / 2),
                    (layerEntry.srcInfo.latitude || INDIA_BBOX.south + (INDIA_BBOX.north - INDIA_BBOX.south) / 2),
                    layerEntry.srcInfo.elevation || 0
                );

                const modelEntity = this.viewer.entities.add({
                    id: layerEntry.id,
                    name: layerEntry.name,
                    position: position,
                    model: {
                        uri: modelUri,
                        scale: layerEntry.srcInfo.scale || 1.0,
                        minimumPixelSize: layerEntry.srcInfo.minimumPixelSize || 128,
                        maximumScale: layerEntry.srcInfo.maximumScale || 20000,
                        show: layerEntry.isVisible // Set initial visibility
                    }
                });
                cesiumLayer = modelEntity;

                // IMPORTANT: Store the blob URL directly on the Cesium entity for later revocation
                if (blobUrlForCleanup) {
                    cesiumLayer._blobUrl = blobUrlForCleanup;
                    // Reset blobUrlForCleanup as it's now managed by the entity
                    blobUrlForCleanup = null;
                }
                console.log(`CesiumGeoDataManager: Added 3D Model layer: ${layerEntry.name}. Visible: ${modelEntity.show}`);
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
        } finally {
            // Important: If a Blob URL was created but no Cesium layer object was successfully returned/stored,
            // revoke the Blob URL to prevent memory leaks.
            if (blobUrlForCleanup) {
                URL.revokeObjectURL(blobUrlForCleanup);
                console.warn(`CesiumGeoDataManager: Revoked transient Blob URL due to failed layer addition for ${layerEntry.name}`);
            }
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
            } else if (cesiumLayer instanceof Cesium.Cesium3DTileset) {
                this.viewer.scene.primitives.remove(cesiumLayer);
                console.log(`CesiumGeoDataManager: Removed 3D Tileset with ID: ${layerId}`);
            } else if (cesiumLayer instanceof Cesium.Entity) {
                // For 3D Models added as entities
                this.viewer.entities.remove(cesiumLayer);
                // IMPORTANT: Revoke the Blob URL when the model entity is removed
                if (cesiumLayer._blobUrl) {
                    URL.revokeObjectURL(cesiumLayer._blobUrl);
                    console.log(`CesiumGeoDataManager: Revoked Blob URL for 3D Model with ID: ${layerId}`);
                }
                console.log(`CesiumGeoDataManager: Removed Entity (3D Model) with ID: ${layerId}`);
            } else {
                console.warn(`CesiumGeoDataManager: Could not remove layer type for ID ${layerId}. Not a recognized Cesium layer type.`);
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
            if (cesiumLayer instanceof Cesium.ImageryLayer || cesiumLayer instanceof Cesium.DataSource || cesiumLayer instanceof Cesium.Cesium3DTileset) {
                cesiumLayer.show = isVisible;
            } else if (cesiumLayer instanceof Cesium.Entity) {
                // For 3D Models added as entities, toggle their 'show' property
                cesiumLayer.show = isVisible;
            }
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

        // Important: Before clearing, collect all blob URLs from existing 3D model entities to revoke them
        const blobUrlsToRevoke = [];
        this.viewer.entities.values.forEach(entity => {
            if (entity.model && entity._blobUrl) { // Check if it's a model entity and has our custom _blobUrl property
                blobUrlsToRevoke.push(entity._blobUrl);
            }
        });

        // Clear all existing dynamic layers and data sources and primitives from Cesium Viewer
        this.viewer.dataSources.removeAll();
        this.viewer.entities.removeAll(); // Clear entities, including 3D Models
        for (let i = this.viewer.imageryLayers.length - 1; i >= 0; i--) {
            const layer = this.viewer.imageryLayers.get(i);
            // This loop iterates through all imagery layers. Be careful not to remove base layers.
            // A more robust solution might involve tagging custom imagery layers or knowing their IDs.
            // For now, assuming all layers *except* the base layer (usually index 0) can be removed.
            // Adjust this logic if you have multiple base layers or specific layers you want to preserve.
            if (i > 0) { // Assuming base layer is at index 0 and should not be removed
                this.viewer.imageryLayers.remove(layer, true);
            }
        }
        // Remove 3D Tilesets from primitives
        for (let i = this.viewer.scene.primitives.length - 1; i >= 0; i--) {
            const primitive = this.viewer.scene.primitives.get(i);
            if (primitive instanceof Cesium.Cesium3DTileset) {
                this.viewer.scene.primitives.remove(primitive);
            }
        }

        this.cesiumLayersMap.clear(); // Clear internal map as well
        console.log('CesiumGeoDataManager: Cleared all existing dynamic globe layers, data sources, entities, and 3D Tilesets.');

        // Revoke the collected blob URLs
        blobUrlsToRevoke.forEach(url => {
            URL.revokeObjectURL(url);
            console.log(`CesiumGeoDataManager: Revoked Blob URL during reconciliation: ${url}`);
        });


        // Re-add layers in the desired Cesium Z-order.
        // Imagery layers need to be added in reverse order to appear correctly.
        const imageryLayersReversed = layersToReconcile.filter(l => ['wms', 'wmts'].includes(l.type)).reverse();
        // Data sources, 3D Tiles, and 3D Models can typically be added in the order they appear in the UI list.
        const dataAndModels = layersToReconcile.filter(l => ['geojson', 'kml', 'czml', '3dtile', '3dmodel'].includes(l.type));


        for (let i = 0; i < imageryLayersReversed.length; i++) {
            const layerEntry = imageryLayersReversed[i];
            console.log(`CesiumGeoDataManager: Adding ${layerEntry.type.toUpperCase()} layer ${layerEntry.name} (UI order: ${layersToReconcile.indexOf(layerEntry)}, Cesium imagery index: ${i})`);
            await this.addLayer(layerEntry, i); // Pass 'i' as the Cesium imagery layer index
        }

        for (const layerEntry of dataAndModels) {
            console.log(`CesiumGeoDataManager: Adding ${layerEntry.type.toUpperCase()} layer ${layerEntry.name}`);
            await this.addLayer(layerEntry); // No specific index needed for data sources, tilesets, or models
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
            // This covers GeoJSON, KML, and CZML
            if (cesiumLayer.entities.values.length > 0) {
                this.viewer.flyTo(cesiumLayer.entities, { duration: 1.5 });
                console.log(`CesiumGeoDataManager: Zoomed to DataSource (GeoJSON/KML/CZML) layer: ${layerEntry.name}`);
            } else {
                console.warn(`CesiumGeoDataManager: DataSource layer ${layerEntry.name} has no entities to zoom to.`);
                this.viewer.camera.flyHome();
            }
        } else if (cesiumLayer instanceof Cesium.Cesium3DTileset) {
            // Zoom to 3D Tileset
            this.viewer.flyTo(cesiumLayer, { duration: 1.5 });
            console.log(`CesiumGeoDataManager: Zoomed to 3D Tileset layer: ${layerEntry.name}`);
        } else if (cesiumLayer instanceof Cesium.Entity && layerEntry.type === '3dmodel') {
            // Zoom to 3D Model entity
            this.viewer.flyTo(cesiumLayer, { duration: 1.5 });
            console.log(`CesiumGeoDataManager: Zoomed to 3D Model layer: ${layerEntry.name}`);
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
                    // Use a slightly lower elevation to ensure it's above terrain when clamped
                    // If you want actual clamping, you might need a different approach or ensure flat polygons.
                    // For typical 2D polygons representing areas, clampToGround is often desired.
                    // This example just sets a fixed elevation for visualization.
                    height: 0.1 // A small height to ensure visibility above terrain if not clamped
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