import * as Cesium from 'cesium';
import { INDIA_BBOX } from './CesiumCoreManager'; // Import INDIA_BBOX from CesiumCoreManager

class CesiumGeoDataManager {
    constructor(viewer) {
        if (!viewer) {
            throw new Error('Cesium Viewer instance is required for CesiumGeoDataManager.');
        }
        this.viewer = viewer;
        this.cesiumLayersMap = new Map();
        this.currentLocationMarkerEntity = null;

        // Ensure terrain is enabled for accurate model placement
        if (!this.viewer.terrainProvider) {
            console.warn("CesiumGeoDataManager: Viewer does not have a terrain provider. Models might not be placed accurately on the ground.");
            // You might want to automatically add one if not present, e.g.:
            // this.viewer.terrainProvider = Cesium.createWorldTerrain();
        }
    }

    /**
     * Adds a geospatial layer to the Cesium globe based on its type.
     * @param {object} layerEntry - The full Data or Service model.
     * @param {number} [imageryIndex] - Optional. For imagery layers, the exact index at which to insert the layer.
     * @returns {Promise<Cesium.ImageryLayer|Cesium.DataSource|Cesium.Cesium3DTileset|Cesium.Entity|null>} The Cesium layer object, or null if failed.
     */
    async addLayer(layerEntry, imageryIndex) {
        if (this.cesiumLayersMap.has(layerEntry.id)) {
            console.warn(`[DEBUG] CesiumGeoDataManager: Layer with ID ${layerEntry.id} already known. Skipping re-add.`);
            const existingLayer = this.cesiumLayersMap.get(layerEntry.id);
            if (existingLayer) {
                if (existingLayer instanceof Cesium.Entity && existingLayer.model) {
                    existingLayer.model.show = layerEntry.isVisible;
                } else {
                    existingLayer.show = layerEntry.isVisible;
                }
            }
            return existingLayer;
        }

        let cesiumLayer = null;
        let modelUri = null; // Declare here so it's accessible for cleanup in catch blocks

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
                console.log(`[DEBUG] CesiumGeoDataManager: Added GeoJSON layer: ${layerEntry.name}. Visible: ${ds.show}. Markers replaced with pointers.`);
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
                console.log(`[DEBUG] CesiumGeoDataManager: Added KML layer: ${layerEntry.name}. Visible: ${ds.show}`);
            }
            else if (layerEntry.type === 'czml' && (layerEntry.srcInfo?.jsonContent || layerEntry.url)) {
                const source = layerEntry.srcInfo?.jsonContent || layerEntry.url;
                const ds = await Cesium.CzmlDataSource.load(source);
                ds.name = layerEntry.name;
                ds.show = layerEntry.isVisible;
                this.viewer.dataSources.add(ds);
                cesiumLayer = ds;
                console.log(`[DEBUG] CesiumGeoDataManager: Added CZML layer: ${layerEntry.name}. Visible: ${ds.show}`);
            }
            else if (layerEntry.type === '3dtiles' && layerEntry.url) {
                try {
                    const tileset = await Cesium.Cesium3DTileset.fromUrl(layerEntry.url);
                    tileset.name = layerEntry.name;
                    tileset.show = layerEntry.isVisible;
                    this.viewer.scene.primitives.add(tileset);
                    cesiumLayer = tileset;
                    console.log(`[DEBUG] CesiumGeoDataManager: Added 3D Tileset: ${layerEntry.name}. Visible: ${tileset.show}`);
                } catch (tilesetError) {
                    console.error(`[ERROR] CesiumGeoDataManager: Failed to load 3D Tileset ${layerEntry.name}:`, tilesetError);
                    return null;
                }
            }
            // Add 3D Model (glTF/GLB) support from URL or local file content
            else if ((layerEntry.type === 'gltf' || layerEntry.type === 'glb' || layerEntry.type === '3dmodel')) {
                console.log(`[DEBUG] CesiumGeoDataManager: Attempting to add 3D Model: ${layerEntry.name}`);

                if (layerEntry.srcInfo?.fileContent instanceof Blob || layerEntry.srcInfo?.fileContent instanceof ArrayBuffer) {
                    const blob = new Blob([layerEntry.srcInfo.fileContent], { type: layerEntry.type === 'gltf' ? 'model/gltf+json' : 'model/gltf-binary' });
                    modelUri = URL.createObjectURL(blob);
                    console.log(`[DEBUG] CesiumGeoDataManager: Creating Blob URL for local 3D model: ${modelUri}`);
                } else if (layerEntry.url) {
                    modelUri = layerEntry.url;
                    console.log(`[DEBUG] CesiumGeoDataManager: Using direct URL for 3D model: ${modelUri}`);
                } else {
                    console.error(`[ERROR] CesiumGeoDataManager: Missing URL or local file content for 3D model ${layerEntry.name}. Cannot add model.`);
                    // No modelUri to revoke yet, as it wasn't created
                    return null;
                }

                // *** FIX STARTS HERE ***
                const longitude = layerEntry.srcInfo?.longitude;
                const latitude = layerEntry.srcInfo?.latitude;
                const elevation = layerEntry.srcInfo?.elevation || 0; // Default elevation to 0 if not provided

                if (typeof longitude !== 'number' || typeof latitude !== 'number') {
                    console.error(`[ERROR] CesiumGeoDataManager: Position (longitude, latitude) is required for 3D model ${layerEntry.name}. Cannot add model.`);
                    if (modelUri && modelUri.startsWith('blob:')) {
                        URL.revokeObjectURL(modelUri); // Revoke if a blob URL was created
                    }
                    return null;
                }

                console.log(`[DEBUG] CesiumGeoDataManager: Model position provided: Lon ${longitude}, Lat ${latitude}, El ${elevation}`);

                let terrainElevation = elevation; // Start with the provided elevation or 0
                try {
                    if (this.viewer.terrainProvider) {
                        console.log(`[DEBUG] CesiumGeoDataManager: Sampling terrain for elevation...`);
                        const cartographicPosition = Cesium.Cartographic.fromDegrees(longitude, latitude, elevation);
                        const updatedCartographicPosition = await Cesium.sampleTerrainMostDetailed(
                            this.viewer.terrainProvider,
                            [cartographicPosition]
                        );
                        // If terrain sampling is successful, use its height. Otherwise, keep the original 'elevation'
                        if (updatedCartographicPosition && updatedCartographicPosition.length > 0 && updatedCartographicPosition[0].height !== undefined) {
                            terrainElevation = updatedCartographicPosition[0].height;
                            console.log(`[DEBUG] CesiumGeoDataManager: Terrain elevation found: ${terrainElevation.toFixed(2)}m`);
                        } else {
                            console.warn(`[WARN] CesiumGeoDataManager: Terrain sampling returned no height. Using provided/default elevation.`);
                        }
                    } else {
                        console.warn(`[WARN] CesiumGeoDataManager: No terrain provider configured. Model will be placed at provided/default elevation relative to ellipsoid.`);
                    }
                } catch (elevationError) {
                    console.error(`[ERROR] CesiumGeoDataManager: Error sampling terrain for ${layerEntry.name}:`, elevationError);
                    // Continue with default/provided elevation if sampling fails
                }

                const position = Cesium.Cartesian3.fromDegrees(longitude, latitude, terrainElevation);

                // Ensure orientation properties are accessed safely with optional chaining
                const heading = layerEntry.srcInfo?.orientation?.heading || 0;
                const pitch = layerEntry.srcInfo?.orientation?.pitch || 0;
                const roll = layerEntry.srcInfo?.orientation?.roll || 0;

                const orientation = Cesium.Transforms.headingPitchRollQuaternion(
                    position,
                    new Cesium.HeadingPitchRoll(
                        Cesium.Math.toRadians(heading),
                        Cesium.Math.toRadians(pitch),
                        Cesium.Math.toRadians(roll)
                    )
                );

                try {
                    console.log(`[DEBUG] CesiumGeoDataManager: Attempting to add model entity to viewer...`);
                    const modelEntity = this.viewer.entities.add({
                        name: layerEntry.name,
                        position: position,
                        orientation: orientation,
                        model: {
                            uri: modelUri,
                            show: layerEntry.isVisible,
                            scale: layerEntry.srcInfo?.scale || 1.0,
                            minimumPixelSize: layerEntry.srcInfo?.minimumPixelSize || 128,
                            maximumScreenSpaceError: layerEntry.srcInfo?.maximumScreenSpaceError || 16, // Common for performance
                            heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND // Crucial for placing on terrain
                        },
                        id: layerEntry.id
                    });
                    cesiumLayer = modelEntity;
                    if (modelUri.startsWith('blob:')) {
                        // Store the blob URL on the entity for later revocation
                        modelEntity._blobUrl = modelUri;
                    }
                    console.log(`[SUCCESS] CesiumGeoDataManager: Added 3D Model (${layerEntry.type}): ${layerEntry.name}. Visible: ${modelEntity.model.show}. Placed on terrain at elevation: ${terrainElevation.toFixed(2)}m`);
                } catch (modelAddError) {
                    console.error(`[ERROR] CesiumGeoDataManager: Failed to add 3D model entity ${layerEntry.name}:`, modelAddError);
                    if (modelUri && modelUri.startsWith('blob:')) {
                        URL.revokeObjectURL(modelUri); // Ensure cleanup on entity add failure
                    }
                    return null; // Return null if adding entity failed
                }
                // *** FIX ENDS HERE ***
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

                console.log(`[DEBUG] CesiumGeoDataManager: Added WMS layer: ${layerEntry.name} at index ${imageryIndex}. Visible: ${cesiumLayer.show}`);
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

                console.log(`[DEBUG] CesiumGeoDataManager: Added WMTS layer: ${layerEntry.name} at index ${imageryIndex}. Visible: ${cesiumLayer.show}`);
            } else {
                console.warn(`[WARN] CesiumGeoDataManager: Unsupported layer type or missing data for ${layerEntry.name} (Type: ${layerEntry.type}).`);
                return null;
            }

            if (cesiumLayer) {
                this.cesiumLayersMap.set(layerEntry.id, cesiumLayer);
                return cesiumLayer;
            } else {
                console.warn(`[WARN] CesiumGeoDataManager: addLayer finished without creating a cesiumLayer for ${layerEntry.name} (Type: ${layerEntry.type}). This might indicate an unhandled condition.`);
                return null;
            }

        } catch (error) {
            console.error(`[CRITICAL ERROR] CesiumGeoDataManager: Uncaught error while attempting to add layer ${layerEntry.name} (Type: ${layerEntry.type}):`, error);
            if (modelUri && modelUri.startsWith('blob:')) {
                URL.revokeObjectURL(modelUri); // Ensure blob URL is revoked on any catch
            }
            return null;
        }
    }

    // --- Layer Management ---
    /**
     * Removes a geospatial layer from the Cesium globe based on its type.
     * @param {string} layerId - The ID of the layer to remove.
     */
    removeLayer(layerId) {
        const cesiumLayer = this.cesiumLayersMap.get(layerId);
        if (cesiumLayer) {
            if (cesiumLayer instanceof Cesium.ImageryLayer) {
                this.viewer.imageryLayers.remove(cesiumLayer, true);
                console.log(`[DEBUG] CesiumGeoDataManager: Removed ImageryLayer with ID: ${layerId}`);
            } else if (cesiumLayer instanceof Cesium.DataSource) {
                this.viewer.dataSources.remove(cesiumLayer, true);
                console.log(`[DEBUG] CesiumGeoDataManager: Removed DataSource with ID: ${layerId}`);
            } else if (cesiumLayer instanceof Cesium.Cesium3DTileset) {
                this.viewer.scene.primitives.remove(cesiumLayer);
                console.log(`[DEBUG] CesiumGeoDataManager: Removed 3D Tileset with ID: ${layerId}`);
            } else if (cesiumLayer instanceof Cesium.Entity && cesiumLayer.model) {
                // If it's a model loaded from a Blob URL, revoke the URL
                if (cesiumLayer._blobUrl && typeof cesiumLayer._blobUrl === 'string' && cesiumLayer._blobUrl.startsWith('blob:')) {
                    URL.revokeObjectURL(cesiumLayer._blobUrl);
                    console.log(`[DEBUG] CesiumGeoDataManager: Revoked Blob URL: ${cesiumLayer._blobUrl}`);
                }
                this.viewer.entities.remove(cesiumLayer);
                console.log(`[DEBUG] CesiumGeoDataManager: Removed 3D Model (Entity) with ID: ${layerId}`);
            }
            else {
                console.warn(`[WARN] CesiumGeoDataManager: Could not remove layer type for ID ${layerId}. Not an ImageryLayer, DataSource, Cesium3DTileset, or 3D Model Entity.`);
            }
            this.cesiumLayersMap.delete(layerId);
        } else {
            console.warn(`[WARN] CesiumGeoDataManager: Layer with ID ${layerId} not found on globe to remove.`);
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
            } else {
                cesiumLayer.show = isVisible;
            }
            console.log(`[DEBUG] CesiumGeoDataManager: Toggled visibility for layer ${layerId} to ${isVisible}`);
        } else {
            console.warn(`[WARN] CesiumGeoDataManager: Layer with ID ${layerId} not found to toggle visibility.`);
        }
    }

    /**
     * Clears all custom (non-base) layers and then re-adds/updates layers
     * based on the provided ordered list.
     * @param {Array<Object>} layersToReconcile - An ordered array of full layer entry objects.
     */
    async reconcileLayers(layersToReconcile) {
        if (!this.viewer) {
            console.warn('[WARN] CesiumGeoDataManager: Viewer not initialized, cannot reconcile layers.');
            return;
        }

        console.log('[DEBUG] CesiumGeoDataManager: Starting layer reconciliation...');
        console.log('[DEBUG] Desired UI order (Top to Bottom):', layersToReconcile.map(l => l.name));

        // Clear all existing data sources
        this.viewer.dataSources.removeAll();

        // Clear all 3D Tilesets
        for (let i = this.viewer.scene.primitives.length - 1; i >= 0; i--) {
            const primitive = this.viewer.scene.primitives.get(i);
            if (primitive instanceof Cesium.Cesium3DTileset) {
                this.viewer.scene.primitives.remove(primitive);
            }
        }

        // Clear all entities (including 3D models and temporary markers)
        // Note: It's generally safer to remove specific entities rather than removeAll if
        // other parts of your application might add entities that should persist.
        // For this context, assuming all entities managed by this class are okay to clear.
        const entitiesToRemove = this.viewer.entities.values.filter(entity =>
            entity.model || entity === this.currentLocationMarkerEntity // Also clear current location marker
        );
        for (const entity of entitiesToRemove) {
            if (entity._blobUrl && typeof entity._blobUrl === 'string' && entity._blobUrl.startsWith('blob:')) {
                URL.revokeObjectURL(entity._blobUrl);
                console.log(`[DEBUG] CesiumGeoDataManager: Revoked Blob URL during reconciliation: ${entity._blobUrl}`);
            }
            this.viewer.entities.remove(entity);
        }
        // If there are other entities not managed by this `cesiumLayersMap` that you
        // *don't* want to clear, you would need more specific filtering here.
        // For now, based on the previous logs, `removeAll()` seems to be the intended behavior for these dynamic layers.
        // this.viewer.entities.removeAll(); // Use this if you want to remove absolutely all entities.
        this.currentLocationMarkerEntity = null; // Ensure the reference is cleared after potential removal


        // Clear all imagery layers (except the base layer, if you have one managed separately)
        // Adjust this loop if you have a persistent base imagery layer you don't want to remove.
        for (let i = this.viewer.imageryLayers.length - 1; i >= 0; i--) {
            const layer = this.viewer.imageryLayers.get(i);
            // Example: Skip removing the default Bing Maps/ESRI base layer if you always want it
            // if (layer.name === 'Bing Maps Aerial' || layer.name === 'Esri World Imagery') {
            //     continue;
            // }
            this.viewer.imageryLayers.remove(layer, true);
        }
        this.cesiumLayersMap.clear(); // Clear your internal map
        console.log('[DEBUG] CesiumGeoDataManager: Cleared all existing dynamic globe layers, data sources, primitives, and entities.');

        // Re-add layers in the desired order
        // Imagery layers are added in reverse UI order to appear correctly (first added is at bottom)
        const imageryLayersReversed = layersToReconcile.filter(l => ['wms', 'wmts'].includes(l.type)).reverse();
        // Data layers (GeoJSON, KML, CZML, 3D Models, 3D Tilesets) are added after imagery
        // Their order relative to each other might not be as critical as imagery, but we maintain UI order.
        const dataLayers = layersToReconcile.filter(l => ['geojson', 'kml', 'czml', 'gltf', 'glb', '3dmodel', '3dtiles'].includes(l.type));


        for (let i = 0; i < imageryLayersReversed.length; i++) {
            const layerEntry = imageryLayersReversed[i];
            console.log(`[DEBUG] CesiumGeoDataManager: Adding ${layerEntry.type.toUpperCase()} layer ${layerEntry.name} (UI order: ${layersToReconcile.indexOf(layerEntry)}, Cesium index: ${i})`);
            await this.addLayer(layerEntry, i);
        }

        for (const layerEntry of dataLayers) {
            console.log(`[DEBUG] CesiumGeoDataManager: Adding ${layerEntry.type.toUpperCase()} layer ${layerEntry.name}`);
            await this.addLayer(layerEntry);
        }

        console.log('[DEBUG] CesiumGeoDataManager: Layer reconciliation complete.');
    }
    /**
     * Zooms the globe to the extent of a specific layer.
     * @param {object} layerEntry - The full layer entry object (from LayerService).
     */
    async zoomToLayer(layerEntry) {
        if (!this.viewer) {
            console.warn('[WARN] CesiumGeoDataManager: Viewer not initialized, cannot zoom to layer.');
            return;
        }

        let cesiumLayer = this.cesiumLayersMap.get(layerEntry.id);

        // If the layer is still a pending promise, await it
        if (cesiumLayer instanceof Promise) {
            try {
                cesiumLayer = await cesiumLayer;
                // Update the map with the resolved layer
                if (cesiumLayer) {
                    this.cesiumLayersMap.set(layerEntry.id, cesiumLayer);
                } else {
                    console.warn(`[WARN] CesiumGeoDataManager: Failed to resolve layer promise for zoom: ${layerEntry.id}. Resolved to null.`);
                    return;
                }
            } catch (error) {
                console.error(`[ERROR] CesiumGeoDataManager: Failed to resolve layer promise for zoom: ${layerEntry.id}`, error);
                return;
            }
        }

        if (!cesiumLayer) {
            console.warn(`[WARN] CesiumGeoDataManager: Layer ${layerEntry.id} not found or not yet available for zoom.`);
            return;
        }

        if (cesiumLayer instanceof Cesium.ImageryLayer) {
            if (layerEntry.bbox) {
                const rect = Cesium.Rectangle.fromDegrees(
                    layerEntry.bbox[0], layerEntry.bbox[1],
                    layerEntry.bbox[2], layerEntry.bbox[3]
                );
                this.viewer.camera.flyTo({ destination: rect, duration: 1.5 });
                console.log(`[DEBUG] CesiumGeoDataManager: Zoomed to ImageryLayer extent: ${layerEntry.name}`);
            } else if (layerEntry.id === 'vedas-satellite-imagery') {
                this.viewer.camera.flyTo({
                    destination: INDIA_BBOX,
                    duration: 2.0
                });
                console.log(`[DEBUG] CesiumGeoDataManager: Zoomed to general extent for Vedas Satellite Imagery.`);
            } else {
                console.warn(`[WARN] CesiumGeoDataManager: Cannot precisely zoom to ImageryLayer ${layerEntry.name}. No extent information.`);
                this.viewer.camera.flyHome();
            }
        } else if (cesiumLayer instanceof Cesium.DataSource) {
            if (cesiumLayer.entities.values.length > 0) {
                this.viewer.flyTo(cesiumLayer.entities, { duration: 1.5 });
                console.log(`[DEBUG] CesiumGeoDataManager: Zoomed to GeoJSON/KML/CZML layer: ${layerEntry.name}`);
            } else {
                console.warn(`[WARN] CesiumGeoDataManager: GeoJSON/KML/CZML layer ${layerEntry.name} has no entities to zoom to.`);
                this.viewer.camera.flyHome();
            }
        } else if (cesiumLayer instanceof Cesium.Cesium3DTileset) {
            this.viewer.flyTo(cesiumLayer, { duration: 1.5 });
            console.log(`[DEBUG] CesiumGeoDataManager: Zoomed to 3D Tileset: ${layerEntry.name}`);
        } else if (cesiumLayer instanceof Cesium.Entity && cesiumLayer.model) {
            this.viewer.flyTo(cesiumLayer, { duration: 1.5 });
            console.log(`[DEBUG] CesiumGeoDataManager: Zoomed to 3D Model: ${layerEntry.name}`);
        }
        else {
            console.warn(`[WARN] CesiumGeoDataManager: Unsupported layer type for zooming: ${layerEntry.type}`);
            this.viewer.camera.flyHome();
        }
    }

    // --- Graphic Management Methods ---

    /**
     * Renders a graphic (point or polygon) on the globe.
     * @param {object} graphic - The graphic object with identifier, geometry (array of {longitude, latitude, elevation}).
     */
    renderGraphic(graphic) {
        if (!this.viewer || !graphic || !graphic.geometry || graphic.geometry.length === 0) {
            console.warn('[WARN] CesiumGeoDataManager: Invalid graphic data provided for rendering.');
            return;
        }

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
            console.log(`[DEBUG] CesiumGeoDataManager: Rendered point graphic with ID: ${graphic.identifier}`);
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
            console.log(`[DEBUG] CesiumGeoDataManager: Rendered polygon graphic with ID: ${graphic.identifier}`);
        } else {
            console.warn(`[WARN] CesiumGeoDataManager: Graphic with ID ${graphic.identifier} has unsupported geometry length.`);
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
                console.log(`[DEBUG] CesiumGeoDataManager: Removed graphic with ID: ${graphicIdentifier}`);
            } else {
                console.warn(`[WARN] CesiumGeoDataManager: Graphic with ID ${graphicIdentifier} not found for removal.`);
            }
        }
    }

    /**
     * Displays a temporary location marker with a label.
     * @param {object} location - The location object with name, identifier, and getCoordinates() method.
     */
    displayLocationMarker(location) {
        if (!this.viewer || !location || typeof location.getCoordinates !== 'function') {
            console.warn('[WARN] CesiumGeoDataManager: Invalid location data provided for marker display.');
            return;
        }

        if (this.currentLocationMarkerEntity) {
            this.viewer.entities.remove(this.currentLocationMarkerEntity);
            this.currentLocationMarkerEntity = null;
            console.log('[DEBUG] CesiumGeoDataManager: Removed existing location marker.');
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
            console.log(`[DEBUG] CesiumGeoDataManager: Displayed location marker for: ${location.name}`);
        } else {
            console.warn(`[WARN] CesiumGeoDataManager: Location ${location.name} has no coordinates to display a marker.`);
        }
    }
}

export default CesiumGeoDataManager;