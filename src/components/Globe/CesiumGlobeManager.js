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

        // Make CesiumCoreManager globally accessible for tools
        window.cesiumCoreManager = this.coreManager;

        // Initialize the geo data manager with the created viewer
        this.geoDataManager = new CesiumGeoDataManager(this.viewer);

        // Subscribe to MapService events (now pure communication)
        this.setupSubscriptions();

        console.log('CesiumGlobeManager: All sub-managers initialized.');
        return this.viewer;
    }

    /**
     * Sets up subscriptions to MapService subjects.
     * MapService now only handles communication, all logic is in respective managers.
     */
    setupSubscriptions() {
        // Visualization mode changes - delegate to CesiumCoreManager  
        this.subscriptions.push(
            MapService.visualizationModeChanged$.subscribe(mode => {
                this.coreManager.setGlobeVisualizationMode(mode);
            })
        );

        // Globe clock time changes - delegate to CesiumCoreManager
        this.subscriptions.push(
            MapService.globeClockTimeChanged$.subscribe(time => {
                this.coreManager.setGlobeClockTime(time);
            })
        );

        // Layer management - delegate to CesiumGeoDataManager
        this.subscriptions.push(
            MapService.addLayerToGlobe$.subscribe(layerEntry => {
                this.geoDataManager.addLayer(layerEntry);
            })
        );
        this.subscriptions.push(
            MapService.removeLayerFromGlobe$.subscribe(layerId => {
                this.geoDataManager.removeLayer(layerId);
            })
        );
        this.subscriptions.push(
            MapService.toggleLayerVisibilityOnGlobe$.subscribe(({ layerId, isVisible }) => {
                this.geoDataManager.toggleLayerVisibility(layerId, isVisible);
            })
        );
        this.subscriptions.push(
            MapService.reconcileGlobeLayers$.subscribe(layersToReconcile => {
                this.geoDataManager.reconcileLayers(layersToReconcile);
            })
        );
        this.subscriptions.push(
            MapService.zoomToLayerOnGlobe$.subscribe(layerEntry => {
                this.geoDataManager.zoomToLayer(layerEntry);
            })
        );

        // Camera and navigation controls - delegate to CesiumCoreManager
        this.subscriptions.push(
            MapService.zoomToCoordinates$.subscribe(coordinates => {
                this.coreManager.zoomToCoordinates(coordinates);
            })
        );
        this.subscriptions.push(
            MapService.orientToNorth$.subscribe(() => {
                this.coreManager.orientToNorth();
            })
        );

        // Graphics rendering - delegate to CesiumGeoDataManager
        this.subscriptions.push(
            MapService.renderGraphic$.subscribe(graphic => {
                this.geoDataManager.renderGraphic(graphic);
            })
        );
        this.subscriptions.push(
            MapService.removeGraphic$.subscribe(graphicIdentifier => {
                this.geoDataManager.removeGraphic(graphicIdentifier);
            })
        );
        this.subscriptions.push(
            MapService.displayLocationMarker$.subscribe(location => {
                this.geoDataManager.displayLocationMarker(location);
            })
        );
    }

    // --- Delegate methods to respective consolidated managers ---

    // Core Management (Viewer, Camera, Scene Info) - Delegate to CesiumCoreManager
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

    /**
     * Sets visualization mode - now delegates to CesiumCoreManager which handles all logic.
     * @param {string} mode - The visualization mode ('2D', '3D').
     */
    setGlobeVisualizationMode(mode) {
        this.coreManager.setGlobeVisualizationMode(mode);
    }

    /**
     * Sets globe clock time - now delegates to CesiumCoreManager which handles all logic.
     * @param {object} time - An object containing hour, minute, and ampm properties.
     */
    setGlobeClockTime(time) {
        this.coreManager.setGlobeClockTime(time);
    }

    /**
     * Gets current visualization mode.
     * @returns {string} Current visualization mode.
     */
    getCurrentVisualizationMode() {
        return this.coreManager.getCurrentVisualizationMode();
    }

    /**
     * Gets current globe clock time.
     * @returns {object} Current time {hour, minute, ampm}.
     */
    getCurrentGlobeClockTime() {
        return this.coreManager.getCurrentGlobeClockTime();
    }

    // --- Camera Control Methods (delegated to CesiumCoreManager) ---

    /**
     * Sets camera position and orientation
     * @param {object} viewOptions - Camera view options
     */
    setCameraView(viewOptions) {
        return this.coreManager.setCameraView(viewOptions);
    }

    /**
     * Gets current camera state
     * @returns {object} Current camera state
     */
    getCameraState() {
        return this.coreManager.getCameraState();
    }

    /**
     * Moves camera by a given movement vector
     * @param {Cesium.Cartesian3} movement - Movement vector
     */
    moveCamera(movement) {
        this.coreManager.moveCamera(movement);
    }

    /**
     * Rotates camera look direction
     * @param {string} direction - Direction to look
     * @param {number} angle - Angle in radians
     */
    rotateCamera(direction, angle) {
        this.coreManager.rotateCamera(direction, angle);
    }

    /**
     * Enables or disables default camera controls
     * @param {boolean} enabled - Whether to enable default controls
     */
    setDefaultCameraControlsEnabled(enabled) {
        this.coreManager.setDefaultCameraControlsEnabled(enabled);
    }

    /**
     * Cancels current camera flight
     */
    cancelCameraFlight() {
        this.coreManager.cancelCameraFlight();
    }

    // --- Flight Animation Methods (delegated to CesiumCoreManager) ---

    /**
     * Creates a smooth flight animation between points
     * @param {Array<Cesium.Cartesian3>} pathPositions - Array of positions
     * @param {object} config - Flight configuration
     * @param {Function} onProgress - Progress callback
     * @param {Function} onComplete - Completion callback
     * @returns {string} Animation ID
     */
    createFlightAnimation(pathPositions, config, onProgress, onComplete) {
        return this.coreManager.createFlightAnimation(pathPositions, config, onProgress, onComplete);
    }

    /**
     * Creates a marker-based flight animation
     * @param {Array<object>} markers - Array of marker objects
     * @param {object} config - Flight configuration
     * @param {Function} onProgress - Progress callback
     * @param {Function} onComplete - Completion callback
     * @returns {string} Animation ID
     */
    createMarkerFlightAnimation(markers, config, onProgress, onComplete) {
        return this.coreManager.createMarkerFlightAnimation(markers, config, onProgress, onComplete);
    }

    /**
     * Cancels a specific flight animation
     * @param {string} animationId - Animation ID to cancel
     */
    cancelFlightAnimation(animationId) {
        this.coreManager.cancelFlightAnimation(animationId);
    }

    /**
     * Cancels all active flight animations
     */
    cancelAllFlightAnimations() {
        this.coreManager.cancelAllFlightAnimations();
    }

    /**
     * Gets active flight animations
     * @returns {Array<string>} Array of active animation IDs
     */
    getActiveFlightAnimations() {
        return this.coreManager.getActiveFlightAnimations();
    }

    /**
     * Samples terrain heights for given positions
     * @param {Array<Cesium.Cartesian3>} positions - Positions to sample
     * @param {number} heightOffset - Height offset above terrain
     * @returns {Promise<Array<Cesium.Cartesian3>>} Terrain-adjusted positions
     */
    async sampleTerrainHeights(positions, heightOffset) {
        return this.coreManager.sampleTerrainHeights(positions, heightOffset);
    }

    // --- Geo Data Management (delegated to CesiumGeoDataManager) ---
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

        // Clear global reference
        if (window.cesiumCoreManager === this.coreManager) {
            window.cesiumCoreManager = null;
        }

        // Destroy the core manager which handles viewer destruction
        this.coreManager.destroyViewer();
        this.viewer = null; // Clear viewer reference
        this.geoDataManager = null; // Clear geo data manager reference
        console.log('CesiumGlobeManager: All managers destroyed.');
    }
}

export default CesiumGlobeManager;