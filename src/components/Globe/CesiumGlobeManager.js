// src/components/Globe/CesiumGlobeManager.js
// No direct Cesium import here, as sub-managers handle it
import CesiumCoreManager from './managers/CesiumCoreManager';
import CesiumGeoDataManager from './managers/CesiumGeoDataManager';
import { MapService } from '../../services/MapService'; // Import MapService

class CesiumGlobeManager {
    constructor(containerId, options = {}) {
        // Initialize CesiumCoreManager
        this.coreManager = new CesiumCoreManager(containerId, options);
        this.viewer = null; // Will be populated after coreManager.initViewer()

        // CesiumGeoDataManager will be initialized with the viewer instance
        this.geoDataManager = null;

        this.subscriptions = []; // To manage RxJS subscriptions
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

        // Subscribe to MapService events
        this.setupSubscriptions();

        console.log('CesiumGlobeManager: All sub-managers initialized.');
        return this.viewer;
    }

    /**
     * Sets up subscriptions to MapService subjects.
     */
    setupSubscriptions() {
        this.subscriptions.push(
            MapService.globeClockTimeChanged$.subscribe(time => {
                this.setGlobeClockTime(time);
            })
        );

        // Existing subscriptions (if any, ensure they are also pushed to this.subscriptions)
        this.subscriptions.push(
            MapService.visualizationModeChanged$.subscribe(mode => {
                this.setGlobeVisualizationMode(mode);
            })
        );
        this.subscriptions.push(
            MapService.addLayerToGlobe$.subscribe(layerEntry => {
                this.addCesiumLayer(layerEntry);
            })
        );
        this.subscriptions.push(
            MapService.removeLayerFromGlobe$.subscribe(layerId => {
                this.removeCesiumLayer(layerId);
            })
        );
        this.subscriptions.push(
            MapService.toggleLayerVisibilityOnGlobe$.subscribe(({ layerId, isVisible }) => {
                this.toggleCesiumLayerVisibility(layerId, isVisible);
            })
        );
        this.subscriptions.push(
            MapService.reconcileGlobeLayers$.subscribe(layersToReconcile => {
                this.reconcileGlobeLayers(layersToReconcile);
            })
        );
        this.subscriptions.push(
            MapService.zoomToLayerOnGlobe$.subscribe(layerEntry => {
                this.zoomToLayer(layerEntry);
            })
        );
        this.subscriptions.push(
            MapService.zoomToCoordinates$.subscribe(coordinates => {
                this.zoomToCoordinates(coordinates);
            })
        );
        this.subscriptions.push(
            MapService.renderGraphic$.subscribe(graphic => {
                this.renderGraphic(graphic);
            })
        );
        this.subscriptions.push(
            MapService.removeGraphic$.subscribe(graphicIdentifier => {
                this.removeGraphic(graphicIdentifier);
            })
        );
        this.subscriptions.push(
            MapService.displayLocationMarker$.subscribe(location => {
                this.displayLocationMarker(location);
            })
        );
        this.subscriptions.push(
            MapService.orientToNorth$.subscribe(() => {
                this.orientToNorth();
            })
        );
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

    /**
     * Delegates setting the globe's clock time to CesiumCoreManager.
     * @param {object} time - An object containing hour, minute, and ampm properties.
     */
    setGlobeClockTime(time) {
        this.coreManager.setGlobeClockTime(time);
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
     * Destroys the Cesium Viewer and cleans up all managers and subscriptions.
     */
    destroy() {
        // Unsubscribe from all RxJS subscriptions
        this.subscriptions.forEach(sub => sub.unsubscribe());
        this.subscriptions = [];

        // Destroy the core manager which handles viewer destruction
        this.coreManager.destroyViewer();
        this.viewer = null; // Clear viewer reference
        this.geoDataManager = null; // Clear geo data manager reference
        console.log('CesiumGlobeManager: All managers destroyed.');
    }
}

export default CesiumGlobeManager;