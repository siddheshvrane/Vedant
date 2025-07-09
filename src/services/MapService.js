// src/services/MapService.js
import { Subject, BehaviorSubject } from 'rxjs';
import * as Cesium from 'cesium'; // Import Cesium directly where needed

/**
 * MapService: Manages map view updates, graphic rendering, and globe redirection.
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
    globeViewer$ = new BehaviorSubject(null);

    visualizationModeChanged$ = new BehaviorSubject('3D');

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
}
export const MapService = new MapServiceClass();