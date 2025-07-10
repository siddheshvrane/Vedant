// src/services/MapService.js
import { Subject, BehaviorSubject } from 'rxjs';
import * as Cesium from 'cesium';

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
    zoomToCoordinates$ = new Subject(); // Still useful for generic coordinate zooms
    displayLocationMarker$ = new Subject();

    initGlobe$ = new Subject();
    globeInitialized$ = new Subject();
    globeViewer$ = new BehaviorSubject(null); // Holds the Cesium.Viewer instance

    visualizationModeChanged$ = new BehaviorSubject('3D');

    // --- Subjects for Layer Management on the Globe (for CesiumGlobeManager to listen) ---
    // These are individual operations.
    addLayerToGlobe$ = new Subject();
    removeLayerFromGlobe$ = new Subject();
    toggleLayerVisibilityOnGlobe$ = new Subject();

    // NEW: Subject for full globe layer reconciliation (clear all custom and re-add in order)
    reconcileGlobeLayers$ = new Subject();

    // NEW: Subject for zooming to a specific layer
    zoomToLayerOnGlobe$ = new Subject();


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
            viewer.scene.mode = targetCesiumMode;
        } else {
            console.warn("MapService: Cesium Viewer not available when attempting to set visualization mode.");
        }
    }

    // --- Methods for Layer Management on Globe ---
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
     * Dispatches a command to CesiumGlobeManager to clear all custom layers
     * and then add a new list of layers in the specified order.
     * This is used for initial sync or reordering.
     * @param {Array<Object>} layersToReconcile - An ordered array of full layer entry objects
     * (including id, type, isVisible, and all source info). The order here is UI-defined (top to bottom).
     */
    reconcileGlobeLayers(layersToReconcile) {
        this.reconcileGlobeLayers$.next(layersToReconcile);
    }

    /**
     * Dispatches a command to CesiumGlobeManager to zoom to a specific layer's extent.
     * @param {object} layerEntry - The full layer entry object (including type and source info
     * like `bbox` for GeoJSON or `coordinates` for WMS if available, etc.).
     */
    zoomToLayer(layerEntry) {
        this.zoomToLayerOnGlobe$.next(layerEntry);
    }
}
export const MapService = new MapServiceClass();