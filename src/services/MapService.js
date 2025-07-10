// src/services/MapService.js
import { Subject, BehaviorSubject } from 'rxjs';
import * as Cesium from 'cesium'; // Import Cesium directly where needed

/**
 * MapService: Manages map view updates, graphic rendering, and globe redirection.
 * This service now also acts as an intermediary for layer management between LayerService and CesiumGlobeManager.
 */
class MapServiceClass {
    updateView$ = new Subject();
    redirectGlobe$ = new Subject();
    orientToNorth$ = new Subject();
    renderGraphic$ = new Subject();
    removeGraphic$ = new Subject();
    zoomToCoordinates$ = new Subject();
    displayLocationMarker$ = new Subject();

    initGlobe$ = new Subject();
    globeInitialized$ = new Subject();
    globeViewer$ = new BehaviorSubject(null); // Holds the Cesium.Viewer instance

    visualizationModeChanged$ = new BehaviorSubject('3D');

    // --- New Subjects for Layer Management on the Globe ---
    addLayerToGlobe$ = new Subject();
    removeLayerFromGlobe$ = new Subject();
    toggleLayerVisibilityOnGlobe$ = new Subject();
    clearCustomGlobeLayers$ = new Subject(); // For re-syncing

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
    setGlobeViewer(viewerInstance) {
        this.globeViewer$.next(viewerInstance);
    }
    getGlobeViewer() {
        return this.globeViewer$.getValue();
    }

    setVisualizationMode(mode) {
        console.log("MapService: Setting visualization mode to", mode);
        this.visualizationModeChanged$.next(mode);

        const viewer = this.getGlobeViewer();
        if (viewer) {
            let targetCesiumMode;

            switch (mode) {
                case '2D':
                    targetCesiumMode = Cesium.SceneMode.SCENE2D;
                    break;
                case '3D':
                    targetCesiumMode = Cesium.SceneMode.SCENE3D;
                    break;
                case 'Anaglyph':
                    console.warn("MapService: Anaglyph 3D mode is not yet implemented.");
                    return;
                default:
                    console.warn("MapService: Unknown visualization mode requested:", mode);
                    return;
            }
            viewer.scene.mode = targetCesiumMode; // This directly updates the viewer, but CesiumGlobeManager's method is better
        } else {
            console.warn("MapService: Cesium Viewer not available when attempting to set visualization mode.");
        }
    }

    // --- New Methods for Layer Management on Globe ---
    addLayerToGlobe(layerEntry) {
        this.addLayerToGlobe$.next(layerEntry);
    }

    removeLayerFromGlobe(layerId) {
        this.removeLayerFromGlobe$.next(layerId);
    }

    toggleLayerVisibilityOnGlobe(layerId, isVisible) {
        this.toggleLayerVisibilityOnGlobe$.next({ layerId, isVisible });
    }
    
    clearCustomGlobeLayers() {
        this.clearCustomGlobeLayers$.next();
    }
    
    // Existing zoomToLayer now handles the full layerEntry
    zoomToLayer(layerEntry) {
        // This will be handled by Globe.vue/CesiumGlobeManager
        // You'll need to pass specific geographic info from layerEntry to zoom to it correctly.
        // For GeoJSON, it might be the bounding box; for WMS, it might be a predefined extent.
        this.zoomToCoordinates$.next({ /* coordinates/bbox from layerEntry */ });
        // Or create a dedicated zoomToLayerOnGlobe$ subject if it's more complex
    }
}
export const MapService = new MapServiceClass();