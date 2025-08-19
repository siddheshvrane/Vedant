// src/components/Globe/CesiumGlobeManager.js
import CesiumCoreManager from './managers/CesiumCoreManager.js';
import CesiumGeoDataManager from './managers/CesiumGeoDataManager.js';
import CesiumGraphicManager from './managers/CesiumGraphicManager.js';
import LayerManager from '../Menu/SubSidebars/LayerManager/LayerManager.js';
import { MapService } from '../../services/MapService.js';

/**
 * CesiumGlobeManager: Central coordinator for all Cesium-related operations.
 * This class orchestrates interactions between different specialized managers
 * and handles communication with MapService.
 */
class CesiumGlobeManager {
    constructor(containerId) {
        this.containerId = containerId;
        
        // Initialize specialized managers
        this.coreManager = new CesiumCoreManager(containerId);
        this.geoDataManager = null; // Initialized after viewer creation
        this.graphicManager = null; // Initialized after viewer creation
        this.layerManager = new LayerManager(); // Initialize layer management
        
        // Setup MapService subscriptions for communication
        this.setupMapServiceSubscriptions();
        
        console.log('CesiumGlobeManager: Initialized with specialized managers');
    }

    /**
     * Sets up subscriptions to MapService communication events
     */
    setupMapServiceSubscriptions() {
        try {
            // Check if MapService and its observables exist before subscribing
            if (!MapService) {
                console.error('CesiumGlobeManager: MapService is not available');
                return;
            }

            // Layer management events
            if (MapService.reconcileGlobeLayers$) {
                MapService.reconcileGlobeLayers$.subscribe(layersToReconcile => {
                    if (layersToReconcile && this.geoDataManager) {
                        this.geoDataManager.reconcileLayers(layersToReconcile);
                    }
                });
            } else {
                console.warn('CesiumGlobeManager: MapService.reconcileGlobeLayers$ is not available');
            }

            if (MapService.toggleLayerVisibilityOnGlobe$) {
                MapService.toggleLayerVisibilityOnGlobe$.subscribe(({ layerId, isVisible }) => {
                    if (this.geoDataManager) {
                        this.geoDataManager.toggleLayerVisibility(layerId, isVisible);
                    }
                });
            } else {
                console.warn('CesiumGlobeManager: MapService.toggleLayerVisibilityOnGlobe$ is not available');
            }

            if (MapService.zoomToLayer$) {
                MapService.zoomToLayer$.subscribe(layerEntry => {
                    if (layerEntry && this.geoDataManager) {
                        this.geoDataManager.zoomToLayer(layerEntry);
                    }
                });
            } else {
                console.warn('CesiumGlobeManager: MapService.zoomToLayer$ is not available');
            }

            // Visualization mode changes
            if (MapService.setGlobeVisualizationMode$) {
                MapService.setGlobeVisualizationMode$.subscribe(mode => {
                    if (mode) {
                        this.coreManager.setGlobeVisualizationMode(mode);
                    }
                });
            } else {
                console.warn('CesiumGlobeManager: MapService.setGlobeVisualizationMode$ is not available');
            }

            // Time control changes
            if (MapService.setGlobeClockTime$) {
                MapService.setGlobeClockTime$.subscribe(time => {
                    if (time) {
                        this.coreManager.setGlobeClockTime(time);
                    }
                });
            } else {
                console.warn('CesiumGlobeManager: MapService.setGlobeClockTime$ is not available');
            }

            // Coordinate zoom requests
            if (MapService.zoomToCoordinates$) {
                MapService.zoomToCoordinates$.subscribe(coordinates => {
                    if (coordinates) {
                        this.coreManager.zoomToCoordinates(coordinates);
                    }
                });
            } else {
                console.warn('CesiumGlobeManager: MapService.zoomToCoordinates$ is not available');
            }

            // Graphic rendering
            if (MapService.renderGraphic$) {
                MapService.renderGraphic$.subscribe(graphic => {
                    if (graphic && this.graphicManager) {
                        this.graphicManager.renderGraphic(graphic);
                    }
                });
            } else {
                console.warn('CesiumGlobeManager: MapService.renderGraphic$ is not available');
            }

            if (MapService.removeGraphic$) {
                MapService.removeGraphic$.subscribe(graphicId => {
                    if (graphicId && this.graphicManager) {
                        this.graphicManager.removeGraphic(graphicId);
                    }
                });
            } else {
                console.warn('CesiumGlobeManager: MapService.removeGraphic$ is not available');
            }

            if (MapService.displayLocationMarker$) {
                MapService.displayLocationMarker$.subscribe(location => {
                    if (location && this.graphicManager) {
                        this.graphicManager.displayLocationMarker(location);
                    }
                });
            } else {
                console.warn('CesiumGlobeManager: MapService.displayLocationMarker$ is not available');
            }

            console.log('CesiumGlobeManager: Subscribed to available MapService communication events');
        } catch (error) {
            console.error('CesiumGlobeManager: Error setting up MapService subscriptions:', error);
        }
    }

    /**
     * Initializes the Cesium viewer and all dependent managers
     * @returns {Cesium.Viewer} The initialized viewer instance
     */
    init() {
        const viewer = this.coreManager.initViewer();
        
        if (viewer) {
            // Initialize managers that depend on the viewer
            this.geoDataManager = new CesiumGeoDataManager(viewer);
            this.graphicManager = new CesiumGraphicManager(viewer);
            
            // ADDED: Register the core manager with MapService for tool access
            MapService.setCoreManager(this.coreManager);
            
            console.log('CesiumGlobeManager: All managers initialized successfully');
        }
        
        return viewer;
    }

    /**
     * Destroys all managers and cleans up resources
     */
    destroy() {
        // ADDED: Clear core manager reference from MapService
        MapService.setCoreManager(null);
        
        // Clean up layer manager
        if (this.layerManager) {
            this.layerManager.destroy();
            this.layerManager = null;
        }
        
        // Clean up core manager (this will destroy the viewer)
        if (this.coreManager) {
            this.coreManager.destroyViewer();
        }
        
        // Nullify other managers (they don't need explicit cleanup)
        this.geoDataManager = null;
        this.graphicManager = null;
        
        console.log('CesiumGlobeManager: All managers destroyed and cleaned up');
    }

    // --- Direct access methods for specialized functionality ---
    // These methods provide direct access to manager capabilities when needed

    // Core Manager Methods
    getViewer() {
        return this.coreManager.getViewer();
    }

    // ADDED: Direct access to the core manager for tools that need it
    getCoreManager() {
        return this.coreManager;
    }

    addCameraChangeListener(callback) {
        return this.coreManager.addCameraChangeListener(callback);
    }

    removeCameraChangeListener(callback) {
        return this.coreManager.removeCameraChangeListener(callback);
    }

    zoomIn() {
        return this.coreManager.zoomIn();
    }

    zoomOut() {
        return this.coreManager.zoomOut();
    }

    zoomToCoordinates(coordinates) {
        return this.coreManager.zoomToCoordinates(coordinates);
    }

    orientToNorth() {
        return this.coreManager.orientToNorth();
    }

    getSceneInformation() {
        return this.coreManager.getSceneInformation();
    }

    // Advanced Camera Control
    setCameraView(viewOptions) {
        return this.coreManager.setCameraView(viewOptions);
    }

    getCameraState() {
        return this.coreManager.getCameraState();
    }

    moveCamera(movement) {
        return this.coreManager.moveCamera(movement);
    }

    rotateCamera(direction, angle) {
        return this.coreManager.rotateCamera(direction, angle);
    }

    setDefaultCameraControlsEnabled(enabled) {
        return this.coreManager.setDefaultCameraControlsEnabled(enabled);
    }

    cancelCameraFlight() {
        return this.coreManager.cancelCameraFlight();
    }

    // Flight Animation Methods
    createFlightAnimation(pathPositions, config, onProgress, onComplete) {
        return this.coreManager.createFlightAnimation(pathPositions, config, onProgress, onComplete);
    }

    createMarkerFlightAnimation(markers, config, onProgress, onComplete) {
        return this.coreManager.createMarkerFlightAnimation(markers, config, onProgress, onComplete);
    }

    cancelFlightAnimation(animationId) {
        return this.coreManager.cancelFlightAnimation(animationId);
    }

    cancelAllFlightAnimations() {
        return this.coreManager.cancelAllFlightAnimations();
    }

    getActiveFlightAnimations() {
        return this.coreManager.getActiveFlightAnimations();
    }

    // Terrain Sampling
    async sampleTerrainHeights(positions, heightOffset) {
        return this.coreManager.sampleTerrainHeights(positions, heightOffset);
    }

    // Visualization and Time Control
    setGlobeVisualizationMode(mode) {
        return this.coreManager.setGlobeVisualizationMode(mode);
    }

    getCurrentVisualizationMode() {
        return this.coreManager.getCurrentVisualizationMode();
    }

    setGlobeClockTime(time) {
        return this.coreManager.setGlobeClockTime(time);
    }

    getCurrentGlobeClockTime() {
        return this.coreManager.getCurrentGlobeClockTime();
    }

    // GeoData Manager Methods (for direct layer operations if needed)
    async addCesiumLayer(layerEntry, imageryIndex) {
        if (this.geoDataManager) {
            return this.geoDataManager.addLayer(layerEntry, imageryIndex);
        }
        return null;
    }

    removeCesiumLayer(layerId) {
        if (this.geoDataManager) {
            this.geoDataManager.removeLayer(layerId);
        }
    }

    toggleCesiumLayerVisibility(layerId, isVisible) {
        if (this.geoDataManager) {
            this.geoDataManager.toggleLayerVisibility(layerId, isVisible);
        }
    }

    async reconcileGlobeLayers(layersToReconcile) {
        if (this.geoDataManager) {
            return this.geoDataManager.reconcileLayers(layersToReconcile);
        }
    }

    zoomToLayer(layerEntry) {
        if (this.geoDataManager) {
            this.geoDataManager.zoomToLayer(layerEntry);
        }
    }

    // Graphic Manager Methods
    renderGraphic(graphic) {
        if (this.graphicManager) {
            this.graphicManager.renderGraphic(graphic);
        }
    }

    removeGraphic(graphicIdentifier) {
        if (this.graphicManager) {
            this.graphicManager.removeGraphic(graphicIdentifier);
        }
    }

    displayLocationMarker(location) {
        if (this.graphicManager) {
            this.graphicManager.displayLocationMarker(location);
        }
    }

    // Layer Manager Access (for direct layer data access if needed)
    getLayerData(layerId) {
        if (this.layerManager) {
            return this.layerManager.getLayerData(layerId);
        }
        return null;
    }

    getAllLayerData() {
        if (this.layerManager) {
            return this.layerManager.getAllLayerData();
        }
        return new Map();
    }
}

export default CesiumGlobeManager;