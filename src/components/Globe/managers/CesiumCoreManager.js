// src/components/Globe/managers/CesiumCoreManager.js 
import * as Cesium from 'cesium'; 

// Constants moved from CesiumConstants.js and defaultViewerOptions from old CesiumGlobeManager 
const DEFAULT_VIEWER_OPTIONS = { 
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

const DEFAULT_INITIAL_CAMERA_POSITION = { 
    destination: Cesium.Cartesian3.fromDegrees(78.9629, 20.5937, 20000000), 
    orientation: { 
        heading: Cesium.Math.toRadians(0.0), 
        pitch: Cesium.Math.toRadians(-90.0), 
        roll: Cesium.Math.toRadians(0.0) 
    }, 
    duration: 0 
}; 

// Export INDIA_BBOX so CesiumGeoDataManager can import it directly 
export const INDIA_BBOX = Cesium.Rectangle.fromDegrees(68.11, 6.55, 97.39, 35.50); 


class CesiumCoreManager { 
    constructor(containerId, options = {}) { 
        this.containerId = containerId; 
        this.viewer = null; 
        this.viewerOptions = { ...DEFAULT_VIEWER_OPTIONS, ...options }; 
    } 

    /** 
     * Initializes the Cesium Viewer. 
     * @returns {Cesium.Viewer} The initialized Cesium Viewer instance. 
     */ 
    initViewer() { 
        if (this.viewer) { 
            console.warn('CesiumCoreManager: Viewer already initialized.'); 
            return this.viewer; 
        } 

        this.viewer = new Cesium.Viewer(this.containerId, { 
            ...this.viewerOptions, // Use merged options 
            imageryProvider: false, // CRUCIAL: Start with no default imagery, let GeoDataManager handle it 
            terrain: new Cesium.Terrain(Cesium.CesiumTerrainProvider.fromUrl('https://vedas.sac.gov.in/elevation/cdem_10m_2016/')) 
        }); 

        // --- REMOVE THE BELOW BLOCK --- 
        // The CesiumGeoDataManager is already handling the addition of "Vedas Satellite Imagery". 
        // Adding it here again causes conflicts and the 'addEventListener' error. 
        /* 
        setTimeout(() => { 
            if (this.viewer && !this.viewer.isDestroyed()) { 
                const vedasImageryProvider = new Cesium.WebMapServiceImageryProvider({ 
                    url: 'https://bhuvan-ras1.nrsc.gov.in/bhuvan/wms', 
                    layers: 'bhuvan_img', 
                    parameters: { 
                        service: 'WMS', 
                        version: '1.1.1', 
                        format: 'image/jpeg', 
                        transparent: true, 
                        tiled: true, 
                    }, 
                    name: 'Vedas Satellite Imagery' 
                }); 
                this.viewer.imageryLayers.add(vedasImageryProvider); 
                console.log('CesiumCoreManager: Vedas imagery layer added.'); 
            } 
        }, 100); 
        */ 
        // --- END OF BLOCK TO REMOVE --- 


        // Ensure depth test is off for terrain, so data on terrain is not clipped by it 
        this.viewer.scene.globe.depthTestAgainstTerrain = false; 

        this.viewer.camera.flyTo(DEFAULT_INITIAL_CAMERA_POSITION); 

        // Enable natural lighting effects 
        this.viewer.scene.globe.enableLighting = true; // Crucial for day/night 
        this.viewer.shadows = true; // Enable shadows from the sun 
        this.viewer.scene.sun.show = true; // Show the sun 
        this.viewer.scene.moon.show = true; // Show the moon 
        this.viewer.scene.skyBox.show = true; // Show the sky box (stars, etc.) 
        this.viewer.scene.skyAtmosphere.show = true; // Show atmosphere 

        console.log('CesiumCoreManager: Viewer initialized with 3D terrain.'); // Updated log message 
        return this.viewer; 
    } 

    /** 
     * Destroys the Cesium Viewer instance. 
     */ 
    destroyViewer() { 
        if (this.viewer) { 
            this.viewer.destroy(); 
            this.viewer = null; 
            console.log('CesiumCoreManager: Viewer destroyed.'); 
        } 
    } 

    /** 
     * Get the viewer instance. 
     * @returns {Cesium.Viewer|null} The Cesium Viewer instance. 
     */ 
    getViewer() { 
        return this.viewer; 
    } 

    // --- Camera Management Methods (from old CesiumGlobeManager) --- 
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

    zoomToCoordinates(coordinates) { 
        if (!this.viewer || !coordinates) return; 
        const targetElevation = coordinates.elevation && coordinates.elevation > 1000 ? coordinates.elevation : 25000; 
        this.viewer.camera.flyTo({ 
            destination: Cesium.Cartesian3.fromDegrees(coordinates.longitude, coordinates.latitude, targetElevation), 
            duration: 2 
        }); 
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

    // --- Scene Information & Mode Methods (from old CesiumGlobeManager) --- 
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
            for (let i = 0; i < this.viewer.imageryLayers.length; i++) { 
                const layer = this.viewer.imageryLayers.get(i); 
                if (layer.show) { 
                    firstVisibleLayer = layer.imageryProvider; 
                    break; 
                } 
            } 
            // If no visible layers, try to get the first available layer as a fallback 
            if (!firstVisibleLayer && this.viewer.imageryLayers.length > 0) { 
                firstVisibleLayer = this.viewer.imageryLayers.get(0).imageryProvider; 
            } 

            if (firstVisibleLayer instanceof Cesium.WebMapServiceImageryProvider) { 
                imageryTypeName = firstVisibleLayer.name || 'WMS Layer'; 
                // Check if it's the specific Vedas imagery (assuming this check is desired) 
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

    setGlobeVisualizationMode(mode) { 
        if (!this.viewer) { 
            console.warn('CesiumCoreManager: Viewer not initialized, cannot set visualization mode.'); 
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
                console.warn(`CesiumCoreManager: Unknown visualization mode: ${mode}.`); 
                break; 
        } 
    } 

    /** 
     * Sets the globe's clock to a specific time, affecting day/night rendering. 
     * @param {object} time - An object containing hour, minute, and ampm properties. 
     */ 
    setGlobeClockTime(time) { 
        if (!this.viewer) { 
            console.warn('CesiumCoreManager: Viewer not initialized, cannot set globe clock time.'); 
            return; 
        } 

        const { hour, minute, ampm } = time; 
        let militaryHour = parseInt(hour, 10); 
        const parsedMinute = parseInt(minute, 10); 

        if (ampm === 'PM' && militaryHour !== 12) { 
            militaryHour += 12; 
        } else if (ampm === 'AM' && militaryHour === 12) { 
            militaryHour = 0; // 12 AM is 00:00 military time 
        } 

        // Get the current date to combine with the new time 
        const now = Cesium.JulianDate.toDate(this.viewer.clock.currentTime); 
        const newDateTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), militaryHour, parsedMinute, 0, 0); 

        // Convert the new Date object to Cesium.JulianDate 
        const newJulianDate = Cesium.JulianDate.fromDate(newDateTime); 

        // Set the Cesium viewer's clock current time 
        this.viewer.clock.currentTime = newJulianDate; 
        console.log(`CesiumCoreManager: Globe clock time set to: ${newDateTime.toLocaleTimeString()}`); 
    } 
} 

export default CesiumCoreManager;
