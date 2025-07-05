// src/lib/CesiumGlobeManager.js
import * as Cesium from 'cesium';

/**
 * Manages all direct interactions with the Cesium Viewer instance.
 * This class encapsulates the Cesium API logic, keeping the Vue component cleaner.
 */
class CesiumGlobeManager {
    /**
     * @param {string} containerId - The ID of the DOM element to attach the Cesium Viewer to.
     * @param {object} [options] - Optional Cesium Viewer options.
     */
    constructor(containerId, options = {}) {
        this.viewer = null;
        this.containerId = containerId;

        // Define defaultViewerOptions.
        // IMPORTANT CHANGE: imageryProvider and terrain are NO LONGER defined here.
        // They will be set up directly in the init() method to mimic the old Globe.vue's behavior.
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
            creditContainer: document.createElement('div'), // Hides the Cesium credit badge
            fullscreenButton: false,
            sceneMode: Cesium.SceneMode.SCENE3D,
            terrainExaggeration: 1.0,
            // imageryProvider and terrain are commented out/removed from here
            // as they will be explicitly added/set in the init method.
        };
        this.currentLocationMarkerEntity = null; // Manage marker internally

        // Merge default options with any provided options
        this.viewerOptions = { ...this.defaultViewerOptions, ...options };
    }

    /**
     * Initializes the Cesium Viewer.
     * This method now explicitly sets the terrain and imagery layers,
     * mirroring the successful setup in the old Globe.vue.
     * @returns {Cesium.Viewer} The initialized Cesium Viewer instance.
     */
    init() {
        if (this.viewer) {
            console.warn('CesiumGlobeManager: Viewer already initialized.');
            return this.viewer;
        }

        // --- CRITICAL CHANGE: Initialize Viewer with a default or no imageryProvider,
        //                     and then explicitly add the terrain and imagery layers.
        // This setup mirrors the working 'old Globe.vue'.
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
            navigationInstructionsInitiallyVisible: this.viewerOptions.navigationInstructionsInitiallyVisible,
            creditContainer: this.viewerOptions.creditContainer,
            fullscreenButton: this.viewerOptions.fullscreenButton,
            
            // Explicitly set imageryProvider to false in the viewer constructor
            // so we can add our custom WMS as the *first* layer.
            imageryProvider: false, 
            
            sceneMode: this.viewerOptions.sceneMode,
            terrainExaggeration: this.viewerOptions.terrainExaggeration,
            
            // Explicitly set the terrain provider here, as it was done in the old Globe.vue
            terrain: new Cesium.Terrain(Cesium.CesiumTerrainProvider.fromUrl('https://vedas.sac.gov.in/elevation/cdem_10m_2016/'))
        });
        console.log('CesiumGlobeManager: Viewer created successfully with custom terrain.');


        // Add your custom WMS imagery layer *after* the viewer has been created.
        this._addImageryLayer();
        this.viewer.scene.globe.depthTestAgainstTerrain = false;

        // Set default camera position to India.
        this.viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(78.9629, 20.5937, 20000000), // Long, Lat, Height
            orientation: {
                heading: Cesium.Math.toRadians(0.0),    // Look North
                pitch: Cesium.Math.toRadians(-90.0),    // Look straight down
                roll: Cesium.Math.toRadians(0.0)        // No roll
            },
            duration: 0 // Immediate positioning
        });

        return this.viewer;
    }

    /**
     * Adds a Web Map Service (WMS) imagery provider to the globe.
     * @private
     */
    _addImageryLayer() {
        if (!this.viewer) {
            console.error('CesiumGlobeManager: Viewer not initialized, cannot add imagery layer.');
            return;
        }
        console.log('CesiumGlobeManager: Attempting to add Bhuvan WMS imagery layer.');
        this.viewer.imageryLayers.addImageryProvider(new Cesium.WebMapServiceImageryProvider({
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
        }));
    }

    /**
     * Attaches a camera change listener to the viewer.
     * @param {Function} callback - The callback function to execute on camera change.
     */
    addCameraChangeListener(callback) {
        if (this.viewer) {
            this.viewer.camera.changed.addEventListener(callback);
        }
    }

    /**
     * Removes the camera change listener from the viewer.
     * @param {Function} callback - The callback function to remove.
     */
    removeCameraChangeListener(callback) {
        if (this.viewer) {
            this.viewer.camera.changed.removeEventListener(callback);
        }
    }

    /**
     * Gathers and returns an object with current camera/scene details.
     * @returns {Object} An object containing current view information.
     */
    getSceneInformation() {
        if (!this.viewer) return {};
        const cameraPosition = this.viewer.camera.positionCartographic;
        if (!cameraPosition) {
             console.warn('CesiumGlobeManager: Camera position is not yet defined.');
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

    /**
     * Renders a point or polygon graphic on the globe based on provided geometry.
     * @param {Object} graphic - Contains `identifier` and `geometry` (array of coordinates).
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
     * Removes a graphic from the globe using its unique identifier.
     * @param {string} graphicIdentifier - ID of the graphic to remove.
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
     * Flies the camera to a specified longitude, latitude, and elevation.
     * Uses a default elevation if the provided one is too low.
     * @param {Object} coordinates - Contains `longitude`, `latitude`, and optional `elevation`.
     */
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
     * Displays a named label marker at a given location.
     * Removes any existing `currentLocationMarkerEntity` before adding a new one.
     * @param {Object} location - Object with `name` and `getCoordinates()` method.
     */
    displayLocationMarker(location) {
        if (!this.viewer || !location || !location.getCoordinates) return;

        // Remove existing marker before adding a new one.
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
            // Store reference to the new marker.
            this.currentLocationMarkerEntity = newMarkerEntity;
        }
    }

    /**
     * Orients the camera's heading to North (0 degrees) while preserving current pitch and roll.
     */
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
                    heading: Cesium.Math.toRadians(0.0), // Set heading to North
                    pitch: currentPitch, // Preserve current pitch
                    roll: currentRoll // Preserve current roll
                },
                duration: 1.5
            });
        }
    }

    /**
     * Destroys the Cesium Viewer instance and cleans up resources.
     */
    destroy() {
        if (this.viewer) {
            this.viewer.destroy();
            this.viewer = null;
            this.currentLocationMarkerEntity = null;
        }
    }
}

export default CesiumGlobeManager;