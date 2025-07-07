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
            navigationInstructionsInitiallyVisible: this.viewerOptions.navigationInstructionsInitiallyVisible,
            creditContainer: this.viewerOptions.creditContainer,
            fullscreenButton: this.viewerOptions.fullscreenButton,
            
            imageryProvider: false, 
            
            sceneMode: this.viewerOptions.sceneMode,
            terrainExaggeration: this.viewerOptions.terrainExaggeration,
            
            terrain: new Cesium.Terrain(Cesium.CesiumTerrainProvider.fromUrl('https://vedas.sac.gov.in/elevation/cdem_10m_2016/'))
        });

        this._addImageryLayer();
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

    _addImageryLayer() {
        if (!this.viewer) {
            return;
        }
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
                // For 2D mode, activate Columbus View
                this.viewer.scene.mode = Cesium.SceneMode.COLUMBUS_VIEW;
                this.viewer.scene.screenSpaceCameraController.enableTilt = false; // Disable tilting in Columbus View
                break;
            case '3D':
                // For 2.5D (3D Globe), activate 3D mode
                this.viewer.scene.mode = Cesium.SceneMode.SCENE3D;
                this.viewer.scene.screenSpaceCameraController.enableTilt = true; // Enable tilting back for 3D
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
        }
    }
}

export default CesiumGlobeManager;