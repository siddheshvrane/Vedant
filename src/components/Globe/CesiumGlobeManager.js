// src/managers/CesiumGlobeManager.js
import * as Cesium from 'cesium';

class CesiumGlobeManager {
    constructor(containerId, options = {}) {
        this.viewer = null;
        this.containerId = containerId;
        this.defaultViewerOptions = {
            animation: false,
            baseLayerPicker: false,
            geocoder: false,
            homeButton: false,
            infoBox: false,
            sceneModePicker: false,
            selectionIndicator: false,
            timeline: false,
            navigationHelpButton: false,
            navigationInstructionsInitiallyVisible: false,
            creditContainer: document.createElement('div'),
            fullscreenButton: false,
            sceneMode: Cesium.SceneMode.SCENE3D,
            terrainExaggeration: 1.0,
        };
        this.currentLocationMarkerEntity = null;
        this.viewerOptions = { ...this.defaultViewerOptions, ...options };

        // Internal map to store Cesium layer objects by their ID
        // This will now hold ImageryLayer instances AND DataSource instances.
        this.cesiumLayersMap = new Map();
    }

    init() {
        if (this.viewer) {
            return this.viewer;
        }

        this.viewer = new Cesium.Viewer(this.containerId, {
            animation: this.viewerOptions.animation,
            baseLayerPicker: this.viewerOptions.baseLayerPicker,
            geocoder: this.viewerOptions.geocoder,
            homeButton: this.viewerOptions.homeButton,
            infoBox: this.viewerOptions.infoBox,
            sceneModePicker: this.viewerOptions.sceneModePicker,
            selectionIndicator: this.viewerOptions.selectionIndicator,
            timeline: this.viewerOptions.timeline,
            navigationHelpButton: this.viewerOptions.navigationHelpButton,
            navigationInstructionsInitiallyVisible: false,
            creditContainer: this.viewerOptions.creditContainer,
            fullscreenButton: this.viewerOptions.fullscreenButton,

            imageryProvider: false, // CRUCIAL: Start with no default imagery, we add our own through reconcileGlobeLayers
            sceneMode: this.viewerOptions.sceneMode,
            terrainExaggeration: this.viewerOptions.terrainExaggeration,
            terrain: new Cesium.Terrain(Cesium.CesiumTerrainProvider.fromUrl('https://vedas.sac.gov.in/elevation/cdem_10m_2016/'))
        });

        // Ensure depth test is off for terrain, so data on terrain is not clipped by it
        this.viewer.scene.globe.depthTestAgainstTerrain = false;

        this.viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(78.9629, 20.5937, 20000000),
            orientation: {
                heading: Cesium.Math.toRadians(0.0),
                pitch: Cesium.Math.toRadians(-90.0),
                roll: Cesium.Math.toRadians(0.0)
            },
            duration: 0
        });

        console.log('CesiumGlobeManager: Viewer initialized.');
        return this.viewer;
    }

    /**
     * Adds a geospatial layer to the Cesium globe based on its type.
     * This method is primarily called by reconcileGlobeLayers to add layers in a specific order.
     * @param {object} layerEntry - The full Data or Service model.
     * Must include 'id', 'type', 'name', 'isVisible', and source info (baseUrl/args or srcInfo.jsonContent).
     * @param {number} [imageryIndex] - Optional. For imagery layers, the exact index at which to insert the layer.
     * This is crucial for Z-ordering.
     * @returns {Cesium.ImageryLayer|Cesium.DataSource|null} The Cesium layer object, or null if failed.
     */
    async addCesiumLayer(layerEntry, imageryIndex) {
        if (!this.viewer) {
            console.warn('CesiumGlobeManager: Viewer not initialized, cannot add layer:', layerEntry.name);
            return null;
        }

        // IMPORTANT: During reconciliation, we assume layers are cleared and re-added.
        // The check for existing layers here is mostly for edge cases or non-reconciled adds.
        if (this.cesiumLayersMap.has(layerEntry.id)) {
            console.warn(`CesiumGlobeManager: Layer with ID ${layerEntry.id} already known. Skipping re-add.`);
            const existingLayer = this.cesiumLayersMap.get(layerEntry.id);
            if (existingLayer) {
                 // Ensure visibility is up-to-date even if not re-added
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
                    clampToGround: true // Usually good for GeoJSON on terrain
                });
                ds.name = layerEntry.name;
                ds.show = layerEntry.isVisible;
                this.viewer.dataSources.add(ds);
                cesiumLayer = ds;
                console.log(`CesiumGlobeManager: Added GeoJSON layer: ${layerEntry.name}. Visible: ${ds.show}`);
            } else if (layerEntry.type === 'wms' && layerEntry.baseUrl && layerEntry.args) {
                const wmsParameters = {
                    service: 'WMS',
                    version: layerEntry.args.version || '1.1.1',
                    request: 'GetMap',
                    format: layerEntry.args.format || 'image/png',
                    transparent: layerEntry.args.transparent !== undefined ? layerEntry.args.transparent : true,
                    layers: layerEntry.args.layers || layerEntry.name, // Fallback to name if layers param is missing
                    srs: layerEntry.args.srs || 'EPSG:4326', // Use CRS for WMS 1.3.0
                    tiled: layerEntry.args.tiled !== undefined ? layerEntry.args.tiled : true,
                    width: 256,
                    height: 256,
                    ...layerEntry.args // Spread any additional args
                };

                const imageryProvider = new Cesium.WebMapServiceImageryProvider({
                    url: layerEntry.baseUrl,
                    layers: wmsParameters.layers,
                    parameters: wmsParameters,
                    credit: new Cesium.Credit(layerEntry.name) // Add a credit for the layer
                });

                // Add at the specified index for correct Z-ordering
                cesiumLayer = this.viewer.imageryLayers.addImageryProvider(imageryProvider, imageryIndex);
                cesiumLayer.id = layerEntry.id; // Assign the custom ID for easy lookup
                cesiumLayer.name = layerEntry.name; // Assign name for easier debugging
                cesiumLayer.show = layerEntry.isVisible;

                console.log(`CesiumGlobeManager: Added WMS layer: ${layerEntry.name} at index ${imageryIndex}. Visible: ${cesiumLayer.show}`);
            } else {
                console.warn(`CesiumGlobeManager: Unsupported layer type or missing data for ${layerEntry.name} (Type: ${layerEntry.type}).`);
                return null;
            }

            if (cesiumLayer) {
                this.cesiumLayersMap.set(layerEntry.id, cesiumLayer);
            }
            return cesiumLayer;

        } catch (error) {
            console.error(`CesiumGlobeManager: Error adding layer ${layerEntry.name}:`, error);
            return null;
        }
    }

    /**
     * Removes a geospatial layer from the Cesium globe.
     * @param {string} layerId - The ID of the layer to remove.
     */
    removeCesiumLayer(layerId) {
        if (!this.viewer) return;

        const cesiumLayer = this.cesiumLayersMap.get(layerId);
        if (cesiumLayer) {
            // Remove from Cesium based on type
            if (cesiumLayer instanceof Cesium.ImageryLayer) {
                this.viewer.imageryLayers.remove(cesiumLayer, true); // true to destroy provider
                console.log(`CesiumGlobeManager: Removed ImageryLayer with ID: ${layerId}`);
            } else if (cesiumLayer instanceof Cesium.DataSource) {
                this.viewer.dataSources.remove(cesiumLayer, true); // true to destroy
                console.log(`CesiumGlobeManager: Removed DataSource with ID: ${layerId}`);
            } else {
                console.warn(`CesiumGlobeManager: Could not remove layer type for ID ${layerId}. Not an ImageryLayer or DataSource.`);
            }
            this.cesiumLayersMap.delete(layerId); // Remove from internal map after successful Cesium removal
        } else {
            console.warn(`CesiumGlobeManager: Layer with ID ${layerId} not found on globe to remove.`);
        }
    }

    /**
     * Toggles the visibility of a geospatial layer on the Cesium globe.
     * @param {string} layerId - The ID of the layer.
     * @param {boolean} isVisible - The desired visibility state.
     */
    toggleCesiumLayerVisibility(layerId, isVisible) {
        if (!this.viewer) return;

        const cesiumLayer = this.cesiumLayersMap.get(layerId);
        if (cesiumLayer) {
            cesiumLayer.show = isVisible;
            console.log(`CesiumGlobeManager: Toggled visibility for layer ${layerId} to ${isVisible}`);
        } else {
            console.warn(`CesiumGlobeManager: Layer with ID ${layerId} not found to toggle visibility.`);
        }
    }

    /**
     * Clears all custom (non-base) layers and then re-adds/updates layers
     * based on the provided ordered list. This ensures correct Z-ordering and visibility.
     * @param {Array<Object>} layersToReconcile - An ordered array of full layer entry objects,
     * ordered from UI top (most visible) to UI bottom (least visible).
     */
    async reconcileGlobeLayers(layersToReconcile) {
        if (!this.viewer) {
            console.warn('CesiumGlobeManager: Viewer not initialized, cannot reconcile layers.');
            return;
        }

        console.log('CesiumGlobeManager: Starting layer reconciliation...');
        console.log('Desired UI order (Top to Bottom):', layersToReconcile.map(l => l.name));

        // Step 1: Clear all existing dynamic layers from the Cesium Viewer
        this.viewer.dataSources.removeAll();

        // Clear ALL imagery layers currently in Cesium
        // Iterate backward to avoid issues with changing collection length during removal
        for (let i = this.viewer.imageryLayers.length - 1; i >= 0; i--) {
            const layer = this.viewer.imageryLayers.get(i);
            this.viewer.imageryLayers.remove(layer, true); // true to destroy the imagery provider
        }

        // Clear our internal map completely, as all layers will be re-added
        this.cesiumLayersMap.clear();
        console.log('CesiumGlobeManager: Cleared all existing dynamic globe layers and data sources.');

        // Step 2: Re-add layers in the desired Cesium Z-order (bottom-up).
        // The `layersToReconcile` array is ordered from UI-top to UI-bottom.
        // Cesium's imageryLayers.addImageryProvider() adds to the top of its stack.
        // So, we need to iterate through `layersToReconcile` in reverse order for imagery.

        const imageryLayersReversed = layersToReconcile.filter(l => l.type === 'wms').reverse();
        const dataSources = layersToReconcile.filter(l => l.type === 'geojson'); // Data sources generally render on top of imagery

        // Add imagery layers first, from bottom-most (index 0) to top-most
        for (let i = 0; i < imageryLayersReversed.length; i++) {
            const layerEntry = imageryLayersReversed[i];
            console.log(`CesiumGlobeManager: Adding WMS layer ${layerEntry.name} (UI order: ${layersToReconcile.indexOf(layerEntry)}, Cesium index: ${i})`);
            await this.addCesiumLayer(layerEntry, i); // Pass 'i' as the Cesium imagery layer index
        }

        // Add data sources. They will appear on top of all imagery layers regardless of add order,
        // but their internal order within dataSources collection also matters if they overlap.
        for (const layerEntry of dataSources) {
            console.log(`CesiumGlobeManager: Adding GeoJSON layer ${layerEntry.name}`);
            await this.addCesiumLayer(layerEntry); // No index needed for data sources
        }

        console.log('CesiumGlobeManager: Layer reconciliation complete.');
    }

    // --- Other methods (no changes needed) ---

    addCameraChangeListener(callback) {
        if (this.viewer) {
            this.viewer.camera.changed.addEventListener(callback);
        }
    }

    removeCameraChangeListener(callback) {
        if (this.viewer) {
            this.viewer.camera.changed.removeEventListener(callback);
        }
    }

    getSceneInformation() {
        if (!this.viewer) return {};
        const cameraPosition = this.viewer.camera.positionCartographic;
        if (!cameraPosition) {
            return {
                currentCoordinates: { latitude: 0, longitude: 0, elevation: 0 },
                terrainType: 'N/A',
                satelliteImageryType: 'N/A',
                angle: 0
            };
        }

        let terrainTypeName = 'Unknown';
        if (this.viewer.terrainProvider instanceof Cesium.CesiumTerrainProvider) {
            terrainTypeName = 'cdem_10m_2016';
        } else if (this.viewer.terrainProvider instanceof Cesium.EllipsoidTerrainProvider) {
            terrainTypeName = 'Ellipsoid (no terrain)';
        } else if (this.viewer.terrainProvider) {
            terrainTypeName = this.viewer.terrainProvider.name || 'Custom Terrain';
        }

        let imageryTypeName = 'Unknown';
        if (this.viewer.imageryLayers.length > 0) {
            let firstVisibleLayer = null;
            for(let i = 0; i < this.viewer.imageryLayers.length; i++) {
                const layer = this.viewer.imageryLayers.get(i);
                if (layer.show) {
                    firstVisibleLayer = layer.imageryProvider;
                    break;
                }
            }
            if (!firstVisibleLayer && this.viewer.imageryLayers.length > 0) {
                // Fallback to the first layer if no visible one is found
                firstVisibleLayer = this.viewer.imageryLayers.get(0).imageryProvider;
            }

            if (firstVisibleLayer instanceof Cesium.WebMapServiceImageryProvider) {
                // Use the layer's name property if available, otherwise a generic WMS
                imageryTypeName = firstVisibleLayer.name || 'WMS Layer';
                 // If you want to specifically identify Vedas:
                if (firstVisibleLayer.url.includes('bhuvan-ras1.nrsc.gov.in') && firstVisibleLayer.layers.includes('bhuvan_img')) {
                    imageryTypeName = 'Vedas Satellite Imagery';
                }
            } else if (firstVisibleLayer instanceof Cesium.BingMapsImageryProvider) {
                imageryTypeName = 'Bing Maps';
            } else if (firstVisibleLayer) {
                imageryTypeName = firstVisibleLayer.name || 'Custom Imagery';
            }
        }

        return {
            currentCoordinates: {
                latitude: Cesium.Math.toDegrees(cameraPosition.latitude),
                longitude: Cesium.Math.toDegrees(cameraPosition.longitude),
                elevation: cameraPosition.height
            },
            terrainType: terrainTypeName,
            satelliteImageryType: imageryTypeName,
            angle: Cesium.Math.toDegrees(this.viewer.camera.heading)
        };
    }

    zoomIn() {
        if (this.viewer) {
            this.viewer.camera.zoomIn(this.viewer.camera.positionCartographic.height * 0.5);
        }
    }

    zoomOut() {
        if (this.viewer) {
            this.viewer.camera.zoomOut(this.viewer.camera.positionCartographic.height);
        }
    }

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

    removeGraphic(graphicIdentifier) {
        if (this.viewer) {
            const entity = this.viewer.entities.getById(graphicIdentifier);
            if (entity) {
                this.viewer.entities.remove(entity);
            }
        }
    }

    zoomToCoordinates(coordinates) {
        if (this.viewer && coordinates) {
            const targetElevation = coordinates.elevation && coordinates.elevation > 1000 ? coordinates.elevation : 25000;
            this.viewer.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(coordinates.longitude, coordinates.latitude, targetElevation),
                duration: 2
            });
        }
    }

    /**
     * Zooms the globe to the extent of a specific layer.
     * @param {object} layerEntry - The full layer entry object (from LayerService).
     */
    async zoomToLayer(layerEntry) {
        if (!this.viewer) {
            console.warn('CesiumGlobeManager: Viewer not initialized, cannot zoom to layer.');
            return;
        }

        let cesiumLayer = this.cesiumLayersMap.get(layerEntry.id);

        // If the layer is a promise (still loading), wait for it to resolve
        if (cesiumLayer instanceof Promise) {
            try {
                cesiumLayer = await cesiumLayer; // Await resolution
                this.cesiumLayersMap.set(layerEntry.id, cesiumLayer); // Update map with resolved layer
            } catch (error) {
                console.error(`CesiumGlobeManager: Failed to resolve layer promise for zoom: ${layerEntry.id}`, error);
                return;
            }
        }

        if (!cesiumLayer) {
            console.warn(`CesiumGlobeManager: Layer ${layerEntry.id} not found or not yet available for zoom.`);
            return;
        }

        // Logic to zoom based on layer type
        if (cesiumLayer instanceof Cesium.ImageryLayer) {
            // For ImageryLayers, rely on the layerEntry for extent information if possible.
            // If the layerEntry includes a bounding box or predefined extent, use that.
            if (layerEntry.bbox) {
                // Assuming layerEntry.bbox is [west, south, east, north]
                const rect = Cesium.Rectangle.fromDegrees(
                    layerEntry.bbox[0], layerEntry.bbox[1],
                    layerEntry.bbox[2], layerEntry.bbox[3]
                );
                this.viewer.camera.flyTo({ destination: rect, duration: 1.5 });
                console.log(`CesiumGlobeManager: Zoomed to ImageryLayer extent: ${layerEntry.name}`);
            } else if (layerEntry.id === 'vedas-satellite-imagery') {
                 // Fallback for Vedas if no explicit bbox is in layerEntry
                this.viewer.camera.flyTo({
                    destination: Cesium.Rectangle.fromDegrees(68.11, 6.55, 97.39, 35.50), // Bounding box for India
                    duration: 2.0
                });
                console.log(`CesiumGlobeManager: Zoomed to general extent for Vedas Satellite Imagery.`);
            } else {
                console.warn(`CesiumGlobeManager: Cannot precisely zoom to ImageryLayer ${layerEntry.name}. No extent information.`);
                this.viewer.camera.flyHome();
            }
        } else if (cesiumLayer instanceof Cesium.DataSource) {
            if (cesiumLayer.entities.values.length > 0) {
                // Fly to the extent of the entities within the data source
                this.viewer.flyTo(cesiumLayer.entities, { duration: 1.5 });
                console.log(`CesiumGlobeManager: Zoomed to GeoJSON/CZML layer: ${layerEntry.name}`);
            } else {
                console.warn(`CesiumGlobeManager: GeoJSON/CZML layer ${layerEntry.name} has no entities to zoom to.`);
                this.viewer.camera.flyHome();
            }
        } else {
            console.warn(`CesiumGlobeManager: Unsupported layer type for zooming: ${layerEntry.type}`);
            this.viewer.camera.flyHome();
        }
    }


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
        }
    }

    orientToNorth() {
        if (this.viewer) {
            const currentCameraPosition = this.viewer.camera.positionCartographic;
            const longitude = Cesium.Math.toDegrees(currentCameraPosition.longitude);
            const latitude = Cesium.Math.toDegrees(currentCameraPosition.latitude);
            const height = currentCameraPosition.height;

            const currentPitch = this.viewer.camera.pitch;
            const currentRoll = this.viewer.camera.roll;

            this.viewer.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, height),
                orientation: {
                    heading: Cesium.Math.toRadians(0.0),
                    pitch: currentPitch,
                    roll: currentRoll
                },
                duration: 1.5
            });
        }
    }

    setGlobeVisualizationMode(mode) {
        if (!this.viewer) {
            console.warn('CesiumGlobeManager: Viewer not initialized, cannot set visualization mode.');
            return;
        }

        switch (mode) {
            case '2D':
                this.viewer.scene.mode = Cesium.SceneMode.COLUMBUS_VIEW;
                this.viewer.scene.screenSpaceCameraController.enableTilt = false;
                break;
            case '3D':
                this.viewer.scene.mode = Cesium.SceneMode.SCENE3D;
                this.viewer.scene.screenSpaceCameraController.enableTilt = true;
                break;
            default:
                console.warn(`CesiumGlobeManager: Unknown visualization mode: ${mode}.`);
                break;
        }
    }

    destroy() {
        if (this.viewer) {
            this.viewer.destroy();
            this.viewer = null;
            this.currentLocationMarkerEntity = null;
            this.cesiumLayersMap.clear();
        }
    }
}

export default CesiumGlobeManager;