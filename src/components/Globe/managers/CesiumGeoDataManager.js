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
        this.currentTerrainProviderId = null; // Track the currently active terrain layer ID
    }

    /**
     * Adds a geospatial layer to the Cesium globe based on its type.
     * @param {object} layerEntry - The full Data or Service model.
     * @param {number} [imageryIndex] - Optional. For imagery layers, the exact index at which to insert the layer.
     * @returns {Promise<Cesium.ImageryLayer|Cesium.DataSource|Cesium.Cesium3DTileset|Cesium.Entity|null>} The Cesium layer object, or null if failed.
     */
    async addLayer(layerEntry, imageryIndex) {
        if (this.cesiumLayersMap.has(layerEntry.id)) {
            console.warn(`CesiumGeoDataManager: Layer with ID ${layerEntry.id} already known. Skipping re-add.`);
            const existingLayer = this.cesiumLayersMap.get(layerEntry.id);
            if (existingLayer) {
                // Handle different layer types for visibility toggling
                if (existingLayer instanceof Cesium.Entity && existingLayer.model) {
                    existingLayer.model.show = layerEntry.isVisible;
                } else if (existingLayer instanceof Cesium.ImageryLayer || existingLayer instanceof Cesium.Cesium3DTileset || existingLayer instanceof Cesium.DataSource) {
                    existingLayer.show = layerEntry.isVisible;
                }
                // For terrain, visibility is controlled by setting it as the current provider.
                // If the existing layer is terrain, and it's being "added" again, it means
                // it's the intended terrain, so we re-apply it.
                if (layerEntry.type === 'terrain' && layerEntry.isVisible && this.viewer.terrainProvider !== existingLayer) {
                     this.viewer.terrainProvider = existingLayer;
                     this.currentTerrainProviderId = layerEntry.id;
                     console.log(`CesiumGeoDataManager: Re-applied terrain layer: ${layerEntry.name}`);
                }
            }
            return existingLayer;
        }

        let cesiumLayer = null;
        let modelUri = null; // To hold the URL for the model, whether from direct URL or Blob URL

        try {
            if (layerEntry.type === 'geojson' && (layerEntry.srcInfo?.jsonContent || layerEntry.url)) {
                const source = layerEntry.srcInfo?.jsonContent || layerEntry.url;
                const ds = await Cesium.GeoJsonDataSource.load(source, {
                    stroke: Cesium.Color.HOTPINK,
                    fill: Cesium.Color.PINK.withAlpha(0.5),
                    strokeWidth: 3,
                    clampToGround: true
                });

                for (const entity of ds.entities.values) {
                    if (entity.billboard) {
                        entity.billboard = undefined;
                    }
                    if (entity.point === undefined) {
                        entity.point = {
                            pixelSize: 10,
                            color: Cesium.Color.RED,
                            outlineColor: Cesium.Color.WHITE,
                            outlineWidth: 2
                        };
                    }
                    if (entity.polygon) {
                        entity.polygon.heightReference = Cesium.HeightReference.CLAMP_TO_GROUND;
                    }
                    if (entity.polyline) {
                        entity.polyline.clampToGround = true;
                    }
                }

                ds.name = layerEntry.name;
                ds.show = layerEntry.isVisible;
                this.viewer.dataSources.add(ds);
                cesiumLayer = ds;
                console.log(`CesiumGeoDataManager: Added GeoJSON layer: ${layerEntry.name}. Visible: ${ds.show}. Markers replaced with pointers.`);
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
            }
            else if (layerEntry.type === 'czml' && (layerEntry.srcInfo?.jsonContent || layerEntry.url)) {
                const source = layerEntry.srcInfo?.jsonContent || layerEntry.url;
                const ds = await Cesium.CzmlDataSource.load(source);
                ds.name = layerEntry.name;
                ds.show = layerEntry.isVisible;
                this.viewer.dataSources.add(ds);
                cesiumLayer = ds;
                console.log(`CesiumGeoDataManager: Added CZML layer: ${layerEntry.name}. Visible: ${ds.show}`);
            }
            else if (layerEntry.type === '3dtiles' && layerEntry.url) {
                const tileset = await Cesium.Cesium3DTileset.fromUrl(layerEntry.url);
                tileset.name = layerEntry.name;
                tileset.show = layerEntry.isVisible;
                this.viewer.scene.primitives.add(tileset);
                cesiumLayer = tileset;
                console.log(`CesiumGeoDataManager: Added 3D Tileset: ${layerEntry.name}. Visible: ${tileset.show}`);
            }
            else if ((layerEntry.type === 'gltf' || layerEntry.type === 'glb')) {
                if (layerEntry.srcInfo?.fileContent instanceof Blob || layerEntry.srcInfo?.fileContent instanceof ArrayBuffer) {
                    const blob = new Blob([layerEntry.srcInfo.fileContent], { type: layerEntry.type === 'gltf' ? 'model/gltf+json' : 'model/gltf-binary' });
                    modelUri = URL.createObjectURL(blob);
                    console.log(`CesiumGeoDataManager: Creating Blob URL for local 3D model: ${modelUri}`);
                } else if (layerEntry.url) {
                    modelUri = layerEntry.url;
                } else {
                    console.error(`CesiumGeoDataManager: Missing URL or local file content for 3D model ${layerEntry.name}.`);
                    return null;
                }

                if (!layerEntry.position) {
                    console.error(`CesiumGeoDataManager: Position is required for 3D model ${layerEntry.name}.`);
                    if (modelUri && modelUri.startsWith('blob:')) {
                        URL.revokeObjectURL(modelUri);
                    }
                    return null;
                }

                const position = Cesium.Cartesian3.fromDegrees(
                    layerEntry.position.longitude,
                    layerEntry.position.latitude,
                    layerEntry.position.elevation || 0
                );

                const modelEntity = this.viewer.entities.add({
                    name: layerEntry.name,
                    position: position,
                    model: {
                        uri: modelUri,
                        show: layerEntry.isVisible,
                        scale: layerEntry.scale || 1.0,
                        minimumPixelSize: layerEntry.minimumPixelSize || 128,
                    },
                    id: layerEntry.id
                });
                cesiumLayer = modelEntity;
                if (modelUri.startsWith('blob:')) {
                    modelEntity._blobUrl = modelUri;
                }
                console.log(`CesiumGeoDataManager: Added 3D Model (${layerEntry.type}): ${layerEntry.name}. Visible: ${modelEntity.model.show}`);
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
                    tileMatrixLabels: layerEntry.args.tileMatrixLabels,
                    dimensions: layerEntry.args.dimensions,
                    tilingScheme: layerEntry.args.tilingScheme,
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
            }
            // NEW: Add terrain layer handling
            else if (layerEntry.type === 'terrain' && layerEntry.url) {
                const terrainProvider = new Cesium.CesiumTerrainProvider({
                    url: layerEntry.url,
                    credit: new Cesium.Credit(layerEntry.name),
                    // Add other CesiumTerrainProvider options if needed, e.g., requestVertexNormals
                });

                // Assign the terrain provider to the viewer's globe
                this.viewer.terrainProvider = terrainProvider;
                cesiumLayer = terrainProvider; // Store the provider itself
                this.currentTerrainProviderId = layerEntry.id; // Keep track of the active terrain
                console.log(`CesiumGeoDataManager: Set terrain layer: ${layerEntry.name}`);
            }
            else {
                console.warn(`CesiumGeoDataManager: Unsupported layer type or missing data for ${layerEntry.name} (Type: ${layerEntry.type}).`);
                return null;
            }

            if (cesiumLayer) {
                this.cesiumLayersMap.set(layerEntry.id, cesiumLayer);
            }
            return cesiumLayer;

        } catch (error) {
            console.error(`CesiumGeoDataManager: Error adding layer ${layerEntry.name}:`, error);
            if (modelUri && modelUri.startsWith('blob:')) {
                URL.revokeObjectURL(modelUri);
            }
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
            } else if (cesiumLayer instanceof Cesium.Cesium3DTileset) {
                this.viewer.scene.primitives.remove(cesiumLayer);
                console.log(`CesiumGeoDataManager: Removed 3D Tileset with ID: ${layerId}`);
            } else if (cesiumLayer instanceof Cesium.Entity && cesiumLayer.model) {
                if (cesiumLayer._blobUrl && typeof cesiumLayer._blobUrl === 'string' && cesiumLayer._blobUrl.startsWith('blob:')) {
                    URL.revokeObjectURL(cesiumLayer._blobUrl);
                    console.log(`CesiumGeoDataManager: Revoked Blob URL: ${cesiumLayer._blobUrl}`);
                }
                this.viewer.entities.remove(cesiumLayer);
                console.log(`CesiumGeoDataManager: Removed 3D Model (Entity) with ID: ${layerId}`);
            } else if (cesiumLayer instanceof Cesium.CesiumTerrainProvider || cesiumLayer instanceof Cesium.EllipsoidTerrainProvider) {
                // If the terrain being removed is the currently active one, revert to default
                if (this.viewer.terrainProvider === cesiumLayer) {
                    this.viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
                    this.currentTerrainProviderId = null;
                    console.log(`CesiumGeoDataManager: Removed active terrain layer and reverted to default ellipsoid.`);
                } else {
                    console.log(`CesiumGeoDataManager: Terrain layer with ID ${layerId} was not the active terrain, no change.`);
                }
            }
            else {
                console.warn(`CesiumGeoDataManager: Could not remove layer type for ID ${layerId}. Not an ImageryLayer, DataSource, Cesium3DTileset, 3D Model Entity, or TerrainProvider.`);
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
            if (cesiumLayer instanceof Cesium.Entity && cesiumLayer.model) {
                cesiumLayer.model.show = isVisible;
            } else if (cesiumLayer instanceof Cesium.ImageryLayer || cesiumLayer instanceof Cesium.Cesium3DTileset || cesiumLayer instanceof Cesium.DataSource) {
                cesiumLayer.show = isVisible;
            } else if (cesiumLayer instanceof Cesium.CesiumTerrainProvider || cesiumLayer instanceof Cesium.EllipsoidTerrainProvider) {
                // For terrain, "toggling visibility" means setting it as the active terrain
                // or reverting to a flat ellipsoid.
                if (isVisible) {
                    this.viewer.terrainProvider = cesiumLayer;
                    this.currentTerrainProviderId = layerId;
                    console.log(`CesiumGeoDataManager: Switched to terrain layer ${layerId}.`);
                } else {
                    // If the current terrain is being "turned off", revert to ellipsoid
                    if (this.viewer.terrainProvider === cesiumLayer) {
                        this.viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
                        this.currentTerrainProviderId = null;
                        console.log(`CesiumGeoDataManager: Switched terrain to Ellipsoid (flat) as ${layerId} was toggled off.`);
                    } else {
                        console.log(`CesiumGeoDataManager: Terrain layer ${layerId} was already inactive or not the current terrain.`);
                    }
                }
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

        // IMPORTANT: Reset terrain to default ellipsoid before re-adding,
        // to ensure any old terrain providers are removed.
        this.viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
        this.currentTerrainProviderId = null; // Clear tracking
        console.log('CesiumGeoDataManager: Reset terrain to default ellipsoid.');


        // Clear all existing dynamic layers and data sources from Cesium Viewer
        this.viewer.dataSources.removeAll();

        // Custom removal for 3D Tilesets and models added as primitives
        for (let i = this.viewer.scene.primitives.length - 1; i >= 0; i--) {
            const primitive = this.viewer.scene.primitives.get(i);
            if (primitive instanceof Cesium.Cesium3DTileset) {
                this.viewer.scene.primitives.remove(primitive);
            }
        }

        // Remove models added as entities and revoke their Blob URLs if applicable
        const entitiesToRemove = this.viewer.entities.values.filter(entity =>
            entity.model && entity._blobUrl
        );
        for (const entity of entitiesToRemove) {
            if (entity._blobUrl && typeof entity._blobUrl === 'string' && entity._blobUrl.startsWith('blob:')) {
                URL.revokeObjectURL(entity._blobUrl);
                console.log(`CesiumGeoDataManager: Revoked Blob URL during reconciliation: ${entity._blobUrl}`);
            }
            this.viewer.entities.remove(entity);
        }
        // This will clear all remaining entities, including regular graphics and the location marker.
        this.viewer.entities.removeAll();
        this.currentLocationMarkerEntity = null; // Reset the current location marker

        for (let i = this.viewer.imageryLayers.length - 1; i >= 0; i--) {
            const layer = this.viewer.imageryLayers.get(i);
            this.viewer.imageryLayers.remove(layer, true);
        }
        this.cesiumLayersMap.clear(); // Clear internal map as well
        console.log('CesiumGeoDataManager: Cleared all existing dynamic globe layers, data sources, primitives, and entities.');

        // Identify and separate terrain, imagery, and other data layers
        const terrainLayers = layersToReconcile.filter(l => l.type === 'terrain');
        const imageryLayersReversed = layersToReconcile.filter(l => ['wms', 'wmts'].includes(l.type)).reverse();
        const dataLayers = layersToReconcile.filter(l => ['geojson', 'kml', 'czml', 'gltf', 'glb', '3dtiles'].includes(l.type));

        // NEW: Add terrain layer first (if present and visible)
        // Only one terrain layer can be active at a time. Pick the first visible one.
        const activeTerrainLayer = terrainLayers.find(l => l.isVisible);
        if (activeTerrainLayer) {
            console.log(`CesiumGeoDataManager: Setting active terrain layer: ${activeTerrainLayer.name}`);
            await this.addLayer(activeTerrainLayer);
        } else {
             // If no terrain is explicitly chosen or visible, ensure default ellipsoid
             this.viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
             this.currentTerrainProviderId = null;
             console.log('CesiumGeoDataManager: No active terrain layer found, reverting to ellipsoid.');
        }


        // Re-add imagery layers in the desired Cesium Z-order (bottom-up for imagery).
        for (let i = 0; i < imageryLayersReversed.length; i++) {
            const layerEntry = imageryLayersReversed[i];
            // Only add if visible, otherwise, it won't be shown anyway.
            if (layerEntry.isVisible) {
                console.log(`CesiumGeoDataManager: Adding ${layerEntry.type.toUpperCase()} layer ${layerEntry.name} (UI order: ${layersToReconcile.indexOf(layerEntry)}, Cesium index: ${i})`);
                await this.addLayer(layerEntry, i); // Pass 'i' as the Cesium imagery layer index
            }
        }

        // Re-add other data layers
        for (const layerEntry of dataLayers) {
            // Only add if visible
            if (layerEntry.isVisible) {
                console.log(`CesiumGeoDataManager: Adding ${layerEntry.type.toUpperCase()} layer ${layerEntry.name}`);
                await this.addLayer(layerEntry); // No index needed for data sources, 3D tilesets, models, they're typically on top
            }
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
                console.log(`CesiumGeoDataManager: Zoomed to GeoJSON/KML/CZML layer: ${layerEntry.name}`);
            } else {
                console.warn(`CesiumGeoDataManager: GeoJSON/KML/CZML layer ${layerEntry.name} has no entities to zoom to.`);
                this.viewer.camera.flyHome();
            }
        } else if (cesiumLayer instanceof Cesium.Cesium3DTileset) {
            this.viewer.flyTo(cesiumLayer, { duration: 1.5 });
            console.log(`CesiumGeoDataManager: Zoomed to 3D Tileset: ${layerEntry.name}`);
        } else if (cesiumLayer instanceof Cesium.Entity && cesiumLayer.model) {
            this.viewer.flyTo(cesiumLayer, { duration: 1.5 });
            console.log(`CesiumGeoDataManager: Zoomed to 3D Model: ${layerEntry.name}`);
        } else if (layerEntry.type === 'terrain') { // New: Handle zoom for terrain
            // Terrain layers usually don't have a specific 'extent' to zoom to
            // other than the whole globe. You might want to define a default zoom for them.
            if (layerEntry.bbox) {
                const rect = Cesium.Rectangle.fromDegrees(
                    layerEntry.bbox[0], layerEntry.bbox[1],
                    layerEntry.bbox[2], layerEntry.bbox[3]
                );
                this.viewer.camera.flyTo({ destination: rect, duration: 1.5 });
                console.log(`CesiumGeoDataManager: Zoomed to Terrain Layer extent: ${layerEntry.name}`);
            } else {
                this.viewer.camera.flyHome(); // Fly to default home view
                console.log(`CesiumGeoDataManager: Zoomed to home view for terrain layer: ${layerEntry.name}.`);
            }
        }
        else {
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
                point: {
                    pixelSize: 10,
                    color: Cesium.Color.RED,
                    outlineColor: Cesium.Color.WHITE,
                    outlineWidth: 2,
                },
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
            this.viewer.flyTo(newMarkerEntity, { duration: 1.0 });
        }
    }
}

export default CesiumGeoDataManager;