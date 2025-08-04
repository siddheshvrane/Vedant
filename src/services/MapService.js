// src/services/MapService.js
import { Subject, BehaviorSubject } from 'rxjs';

/**
 * MapService: Pure communication service using RxJS subjects.
 * This service acts as a message broker between components without any business logic.
 * All visualization and processing logic is handled by respective managers.
 */
class MapServiceClass {
    // Core viewer management
    viewer = null;
    globeViewer$ = new BehaviorSubject(null);
    
    // Globe lifecycle
    initGlobe$ = new Subject();
    globeInitialized$ = new Subject();
    
    // View updates and scene changes
    updateView$ = new Subject();
    redirectGlobe$ = new Subject();
    
    // Camera controls
    orientToNorth$ = new Subject();
    zoomToCoordinates$ = new Subject();
    
    // Graphics rendering
    renderGraphic$ = new Subject();
    removeGraphic$ = new Subject();
    displayLocationMarker$ = new Subject();
    
    // Visualization mode (pure communication - no logic)
    visualizationModeChanged$ = new BehaviorSubject('3D');
    
    // Time management (pure communication - no logic)
    globeClockTimeChanged$ = new Subject();
    currentGlobeClockTime$ = new BehaviorSubject(this._getInitialTime());
    
    // Layer management communication
    addLayerToGlobe$ = new Subject();
    removeLayerFromGlobe$ = new Subject();
    toggleLayerVisibilityOnGlobe$ = new Subject();
    reconcileGlobeLayers$ = new Subject();
    zoomToLayerOnGlobe$ = new Subject();

    // --- Pure Communication Methods (No Logic) ---
    
    updateView(updateData) {
        this.updateView$.next(updateData);
    }
    
    redirectGlobe(viewData) {
        this.redirectGlobe$.next(viewData);
    }
    
    orientToNorth() {
        this.orientToNorth$.next();
    }
    
    renderGraphic(graphic) {
        this.renderGraphic$.next(graphic);
    }
    
    removeGraphic(graphicIdentifier) {
        this.removeGraphic$.next(graphicIdentifier);
    }
    
    zoomToCoordinates(coordinates) {
        this.zoomToCoordinates$.next(coordinates);
    }
    
    displayLocationMarker(location) {
        this.displayLocationMarker$.next(location);
    }
    
    triggerGlobeInitialization() {
        this.initGlobe$.next();
    }
    
    notifyGlobeInitialized(isReady) {
        this.globeInitialized$.next(isReady);
    }
    
    /**
     * Sets the Cesium.Viewer instance for communication purposes only.
     * @param {Cesium.Viewer} viewerInstance - The Cesium viewer instance.
     */
    setGlobeViewer(viewerInstance) {
        this.viewer = viewerInstance;
        this.globeViewer$.next(viewerInstance);
    }
    
    getGlobeViewer() {
        return this.viewer;
    }
    
    /**
     * Dispatches visualization mode change (no processing logic).
     * @param {string} mode - The visualization mode ('2D', '3D').
     */
    setVisualizationMode(mode) {
        console.log("MapService: Broadcasting visualization mode change to", mode);
        this.visualizationModeChanged$.next(mode);
    }
    
    /**
     * Dispatches globe clock time change (no processing logic).
     * @param {object} time - An object containing hour, minute, and ampm.
     */
    setGlobeClockTime(time) {
        this.globeClockTimeChanged$.next(time);
        this.currentGlobeClockTime$.next(time);
        console.log("MapService: Broadcasting globe clock time change:", time);
    }
    
    /**
     * Gets the current stored globe clock time.
     * @returns {object} The current time {hour, minute, ampm}.
     */
    getCurrentGlobeClockTime() {
        return this.currentGlobeClockTime$.getValue();
    }
    
    // --- Layer Management Communication Methods ---
    
    addLayerToGlobe(layerEntry) {
        this.addLayerToGlobe$.next(layerEntry);
    }
    
    removeLayerFromGlobe(layerId) {
        this.removeLayerFromGlobe$.next(layerId);
    }
    
    toggleLayerVisibilityOnGlobe(layerId, isVisible) {
        this.toggleLayerVisibilityOnGlobe$.next({ layerId, isVisible });
    }
    
    /**
     * Dispatches layer reconciliation command.
     * @param {Array<Object>} layersToReconcile - Ordered array of layer entry objects.
     */
    reconcileGlobeLayers(layersToReconcile) {
        this.reconcileGlobeLayers$.next(layersToReconcile);
    }
    
    /**
     * Dispatches zoom to layer command.
     * @param {object} layerEntry - The layer entry object.
     */
    zoomToLayer(layerEntry) {
        this.zoomToLayerOnGlobe$.next(layerEntry);
    }

    // --- Private Helper Methods ---
    
    /**
     * Helper to get initial time (pure utility - no external dependencies).
     */
    _getInitialTime() {
        const now = new Date();
        let currentHour = now.getHours();
        const currentMinute = Math.round(now.getMinutes() / 5) * 5;
        let ampm = 'AM';

        if (currentHour >= 12) {
            ampm = 'PM';
            if (currentHour > 12) currentHour -= 12;
        }
        if (currentHour === 0) currentHour = 12; // 12 AM

        return {
            hour: String(currentHour).padStart(2, '0'),
            minute: String(currentMinute).padStart(2, '0'),
            ampm: ampm
        };
    }
}

export const MapService = new MapServiceClass();