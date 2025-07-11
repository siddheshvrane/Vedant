// src/components/Globe/CesiumGlobeManager.js
// No direct Cesium import here, as sub-managers handle it
import CesiumCoreManager from './managers/CesiumCoreManager';
import CesiumGeoDataManager from './managers/CesiumGeoDataManager';

class CesiumGlobeManager {
    constructor(containerId, options = {}) {
        // Initialize CesiumCoreManager
        this.coreManager = new CesiumCoreManager(containerId, options);
        this.viewer = null; // Will be populated after coreManager.initViewer()

        // CesiumGeoDataManager will be initialized with the viewer instance
        this.geoDataManager = null;
    }

    /**
     * Initializes the Cesium Viewer and all sub-managers.
     * @returns {Cesium.Viewer} The initialized Cesium Viewer instance.
     */
    init() {
        if (this.viewer) {
            console.warn('CesiumGlobeManager: Viewer already initialized.');
            return this.viewer;
        }

        // Initialize the core manager which creates the Cesium Viewer
        this.viewer = this.coreManager.initViewer();

        // Initialize the geo data manager with the created viewer
        this.geoDataManager = new CesiumGeoDataManager(this.viewer);

        console.log('CesiumGlobeManager: All sub-managers initialized.');
        return this.viewer;
    }

    // --- Delegate methods to respective consolidated managers ---

    // Core Management (Viewer, Camera, Scene Info)
    addCameraChangeListener(callback) {
        this.coreManager.addCameraChangeListener(callback);
    }

    removeCameraChangeListener(callback) {
        this.coreManager.removeCameraChangeListener(callback);
    }

    zoomIn() {
        this.coreManager.zoomIn();
    }

    zoomOut() {
        this.coreManager.zoomOut();
    }

    zoomToCoordinates(coordinates) {
        this.coreManager.zoomToCoordinates(coordinates);
    }

    orientToNorth() {
        this.coreManager.orientToNorth();
    }

    getSceneInformation() {
        return this.coreManager.getSceneInformation();
    }

    setGlobeVisualizationMode(mode) {
        this.coreManager.setGlobeVisualizationMode(mode);
    }

    // Geo Data Management (Layers, Graphics)
    async addCesiumLayer(layerEntry, imageryIndex) {
        return this.geoDataManager.addLayer(layerEntry, imageryIndex);
    }

    removeCesiumLayer(layerId) {
        this.geoDataManager.removeLayer(layerId);
    }

    toggleCesiumLayerVisibility(layerId, isVisible) {
        this.geoDataManager.toggleLayerVisibility(layerId, isVisible);
    }

    async reconcileGlobeLayers(layersToReconcile) {
        await this.geoDataManager.reconcileLayers(layersToReconcile);
    }

    async zoomToLayer(layerEntry) {
        await this.geoDataManager.zoomToLayer(layerEntry);
    }

    renderGraphic(graphic) {
        this.geoDataManager.renderGraphic(graphic);
    }

    removeGraphic(graphicIdentifier) {
        this.geoDataManager.removeGraphic(graphicIdentifier);
    }

    displayLocationMarker(location) {
        this.geoDataManager.displayLocationMarker(location);
    }

    /**
     * Destroys the Cesium Viewer and cleans up all managers.
     */
    destroy() {
        // Destroy the core manager which handles viewer destruction
        this.coreManager.destroyViewer();
        this.viewer = null; // Clear viewer reference
        this.geoDataManager = null; // Clear geo data manager reference
        console.log('CesiumGlobeManager: All managers destroyed.');
    }
}

export default CesiumGlobeManager;