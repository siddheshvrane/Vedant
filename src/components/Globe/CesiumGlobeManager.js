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
        this.cesiumLayersMap = new Map(); 
        
        // Reference to the explicitly added base imagery layer
        this.baseImageryLayer = null; 
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
            
            imageryProvider: false, // Start with no default imagery, we add our own
            
            sceneMode: this.viewerOptions.sceneMode,
            terrainExaggeration: this.viewerOptions.terrainExaggeration,
            
            terrain: new Cesium.Terrain(Cesium.CesiumTerrainProvider.fromUrl('https://vedas.sac.gov.in/elevation/cdem_10m_2016/'))
        });

        // --- IMPORTANT CHANGE HERE: Add the base imagery and store its reference ---
        this._addBaseImageryLayer(); 
        
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

        return this.viewer;
    }

    _addBaseImageryLayer() {
        if (!this.viewer) {
            return;
        }
        const imageryProvider = new Cesium.WebMapServiceImageryProvider({
            url: 'https://bhuvan-ras1.nrsc.gov.in/tilecache/tilecache.py',
            layers: 'bhuvan_img',
            parameters: {
                service: 'WMS',
                version: '1.1.1',
                TILED: true,
                request: 'GetMap',
                format: 'image/jpeg',
                transparent: true,
                width: 256,
                height: 256
            },
            srs: 'EPSG:4326'
        });
        
        // Add the imagery layer and store its reference
        this.baseImageryLayer = this.viewer.imageryLayers.addImageryProvider(imageryProvider);
        
        // --- Store this base layer in the map using the ID from LayerService ---
        // Ensure this ID matches the one in LayerService.js: 'vedas-satellite-imagery'
        this.baseImageryLayer.id = 'vedas-satellite-imagery'; 
        this.cesiumLayersMap.set(this.baseImageryLayer.id, this.baseImageryLayer);
        console.log('CesiumGlobeManager: Base Vedas Satellite Imagery added and registered.');
    }

    /**
     * Adds a geospatial layer to the Cesium globe based on its type.
     * @param {object} layerEntry - The full Data or Service model (e.g., Data or Service instance).
     */
    addCesiumLayer(layerEntry) {
        if (!this.viewer) {
            console.warn('CesiumGlobeManager: Viewer not initialized, cannot add layer:', layerEntry.name);
            return;
        }
        // If the layer is already in our map (e.g., it's the base Vedas layer)
        if (this.cesiumLayersMap.has(layerEntry.id)) {
             // Only log a warning, don't try to re-add the same layer
            console.warn(`CesiumGlobeManager: Layer with ID ${layerEntry.id} is already on globe or being processed.`);
            // Ensure its visibility is correctly set if it was re-added during sync and toggled off previously
            const existingLayer = this.cesiumLayersMap.get(layerEntry.id);
            if (existingLayer && existingLayer.show !== layerEntry.isVisible) {
                existingLayer.show = layerEntry.isVisible; // Update visibility if different
                console.log(`CesiumGlobeManager: Updated visibility for existing layer ${layerEntry.id} to ${layerEntry.isVisible}`);
            }
            return;
        }

        let cesiumLayer = null;

        // Handle GeoJSON data
        if (layerEntry.type === 'geojson' && layerEntry.srcInfo && layerEntry.srcInfo.jsonContent) {
            const dataSource = Cesium.GeoJsonDataSource.load(layerEntry.srcInfo.jsonContent, {
                stroke: Cesium.Color.HOTPINK,
                fill: Cesium.Color.PINK.withAlpha(0.5),
                strokeWidth: 3,
                markerSymbol: '?'
            });
            this.viewer.dataSources.add(dataSource).then(ds => {
                ds.name = layerEntry.name; 
                ds.show = layerEntry.isVisible; 
                this.cesiumLayersMap.set(layerEntry.id, ds);
                console.log(`CesiumGlobeManager: Added GeoJSON layer: ${layerEntry.name}`);
            }).otherwise(error => {
                console.error(`CesiumGlobeManager: Error loading GeoJSON for ${layerEntry.name}:`, error);
            });
            return; 
        } 
        // Handle WMS services (for any *other* WMS layers, not the base Vedas one)
        else if (layerEntry.type === 'wms' && layerEntry.baseUrl && layerEntry.args) {
            // This condition is for adding *new* WMS layers, not the base Vedas layer
            // which is handled by _addBaseImageryLayer.
            // You might want to prevent adding the Vedas base layer again if it comes through here.
            if (layerEntry.id === 'vedas-satellite-imagery') {
                 console.warn('CesiumGlobeManager: Attempted to add base Vedas Satellite Imagery via addCesiumLayer. It is handled as a base layer.');
                 return;
            }

            try {
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
                    parameters: wmsParameters
                });

                cesiumLayer = this.viewer.imageryLayers.addImageryProvider(imageryProvider);
                cesiumLayer.id = layerEntry.id; 
                cesiumLayer.name = layerEntry.name; 
                cesiumLayer.show = layerEntry.isVisible; 
                
                this.cesiumLayersMap.set(layerEntry.id, cesiumLayer);
                console.log(`CesiumGlobeManager: Added WMS layer: ${layerEntry.name}`);
            } catch (error) {
                console.error(`CesiumGlobeManager: Error creating WMS layer for ${layerEntry.name}:`, error);
            }
        }
        else {
            console.warn(`CesiumGlobeManager: Unsupported layer type or missing data for ${layerEntry.name} (Type: ${layerEntry.type}).`);
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
            // Special handling for the base imagery layer if you want to prevent its removal
            if (layerId === 'vedas-satellite-imagery' && this.baseImageryLayer) {
                // Instead of removing, just hide it
                this.baseImageryLayer.show = false;
                console.log(`CesiumGlobeManager: Hiding base Vedas Satellite Imagery for ID: ${layerId}`);
                // Don't delete from map if it's a fixed base layer you just want to toggle
                // If you genuinely want to remove it permanently, then uncomment next line
                // this.cesiumLayersMap.delete(layerId); 
                return;
            }

            // Check if it's an ImageryLayer
            if (cesiumLayer instanceof Cesium.ImageryLayer) {
                this.viewer.imageryLayers.remove(cesiumLayer, true); 
                console.log(`CesiumGlobeManager: Removed ImageryLayer for ID: ${layerId}`);
            }
            // Check if it's a DataSource (like GeoJSON)
            else if (cesiumLayer instanceof Cesium.DataSource) {
                this.viewer.dataSources.remove(cesiumLayer, true); 
                console.log(`CesiumGlobeManager: Removed DataSource for ID: ${layerId}`);
            }
            else {
                console.warn(`CesiumGlobeManager: Could not remove layer type for ID ${layerId}. Not an ImageryLayer or DataSource.`);
            }
            this.cesiumLayersMap.delete(layerId);
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
     * Clears all custom (non-base) layers added by the application from the globe.
     * This is useful when re-syncing layers to maintain order or after major changes.
     */
    clearCustomLayers() {
        if (!this.viewer) return;

        // Clear all data sources (e.g., GeoJSON, KML)
        this.viewer.dataSources.removeAll();
        
        // Clear all imagery layers except the explicitly defined base one
        for (let i = this.viewer.imageryLayers.length - 1; i >= 0; i--) {
            const layer = this.viewer.imageryLayers.get(i);
            // Only remove if it's not the baseImageryLayer we explicitly set
            if (layer !== this.baseImageryLayer) { 
                this.viewer.imageryLayers.remove(layer, true);
            }
        }

        // Only clear custom layers from the map, not the base layer
        for (const [id, layer] of this.cesiumLayersMap.entries()) {
            if (id !== 'vedas-satellite-imagery') {
                this.cesiumLayersMap.delete(id);
            }
        }
        console.log('CesiumGlobeManager: All custom layers cleared from globe.');
    }


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
            const firstLayer = this.viewer.imageryLayers.get(0).imageryProvider;
            if (firstLayer instanceof Cesium.WebMapServiceImageryProvider) {
                imageryTypeName = 'Bhuvan WMS';
            } else if (firstLayer instanceof Cesium.BingMapsImageryProvider) {
                imageryTypeName = 'Bing Maps';
            } else if (firstLayer) {
                imageryTypeName = firstLayer.name || 'Custom Imagery';
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

    displayLocationMarker(location) {
        if (!this.viewer || !location || !location.getCoordinates) return;

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

    /**
     * Sets the Cesium viewer's scene mode based on the provided visualization mode.
     * @param {string} mode - The desired visualization mode ('2D' or '3D').
     */
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
            this.baseImageryLayer = null; // Clear reference
        }
    }
}

export default CesiumGlobeManager;