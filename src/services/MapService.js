import { Subject, BehaviorSubject } from 'rxjs';
import * as Cesium from 'cesium';

/**
 * MapService: Manages map view updates, graphic rendering, and globe redirection.
 * This service now also acts as an intermediary for layer management between LayerService and CesiumGlobeManager.
 */
class MapServiceClass {
    // Make sure the viewer instance is stored here
    viewer = null; // Initialize viewer property

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

    // CORRECTED LINE: Removed the extra 'new' keyword
    visualizationModeChanged$ = new BehaviorSubject('3D'); 
    
    // NEW: BehaviorSubject to hold the current globe clock time
    // Initialize with a default time (e.g., the current time when the service is created)
    globeClockTimeChanged$ = new Subject(); // Keep this for triggering updates
    currentGlobeClockTime$ = new BehaviorSubject(this.initializeCurrentTime()); // NEW: Stores the current time

    // --- Subjects for Layer Management on the Globe (for CesiumGlobeManager to listen) ---
    // These are individual operations.
    addLayerToGlobe$ = new Subject();
    removeLayerFromGlobe$ = new Subject();
    toggleLayerVisibilityOnGlobe$ = new Subject();

    // NEW: Subject for full globe layer reconciliation (clear all custom and re-add in order)
    reconcileGlobeLayers$ = new Subject();

    // NEW: Subject for zooming to a specific layer
    zoomToLayerOnGlobe$ = new Subject();

    // NEW: Helper to get initial time
    initializeCurrentTime() {
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

    /**
     * Dispatches a command to zoom the globe to specific coordinates.
     * This method now supports specifying a `range` for very close zooms.
     *
     * @param {object} options - The zoom options.
     * @param {number} options.latitude - The latitude.
     * @param {number} options.longitude - The longitude.
     * @param {number} [options.elevation=0] - The absolute elevation in meters. Used if `range` is not provided.
     * @param {number} [options.range] - The distance from the target point in meters. Used for close-up views.
     * @param {number} [options.heading=0] - Heading in degrees (0 = North).
     * @param {number} [options.pitch=-90] - Pitch in degrees (-90 = straight down).
     * @param {number} [options.roll=0] - Roll in degrees.
     */
    zoomToCoordinates({ latitude, longitude, elevation = 0, range, heading = 0, pitch = -90, roll = 0 }) {
        this.zoomToCoordinates$.next({ latitude, longitude, elevation, range, heading, pitch, roll });
        // Also directly perform the action if viewer is available
        if (!this.viewer) {
            console.warn('Cesium viewer not initialized when calling zoomToCoordinates directly.');
            return;
        }

        const position = Cesium.Cartesian3.fromDegrees(longitude, latitude, elevation);

        if (range !== undefined && range !== null) {
            // Use flyToBoundingSphere for precise close-up control
            // A small bounding sphere around the point ensures the camera can get very close.
            const boundingSphere = new Cesium.BoundingSphere(position, 1); // Radius 1 meter, adjust if needed

            this.viewer.camera.flyToBoundingSphere(boundingSphere, {
                offset: new Cesium.HeadingPitchRange(
                    Cesium.Math.toRadians(heading),
                    Cesium.Math.toRadians(pitch),
                    range // Use the specified range for distance
                ),
                duration: 1.5, // Animation duration
                complete: () => {
                    console.log(`Zoomed to ${latitude}, ${longitude} with range ${range} meters.`);
                }
            });
        } else {
            // Fallback to simple flyTo with absolute elevation if no range is specified
            this.viewer.camera.flyTo({
                destination: position,
                orientation: {
                    heading: Cesium.Math.toRadians(heading),
                    pitch: Cesium.Math.toRadians(pitch),
                    roll: Cesium.Math.toRadians(roll)
                },
                duration: 1.5, // Animation duration
                complete: () => {
                    console.log(`Zoomed to ${latitude}, ${longitude} with elevation ${elevation} meters.`);
                }
            });
        }
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
     * Sets the Cesium.Viewer instance. This should be called once the viewer is created.
     * @param {Cesium.Viewer} viewerInstance - The Cesium viewer instance.
     */
    setGlobeViewer(viewerInstance) {
        this.viewer = viewerInstance; // Store the viewer instance directly
        this.globeViewer$.next(viewerInstance);
    }

    getGlobeViewer() {
        return this.viewer; // Return the stored viewer instance
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
                    // For 2D, also ensure lighting is off as it doesn't apply
                    viewer.scene.globe.enableLighting = false;
                    viewer.shadows = false;
                    break;
                case '3D':
                    targetCesiumMode = Cesium.SceneMode.SCENE3D;
                    // For 3D, enable lighting
                    viewer.scene.globe.enableLighting = true;
                    viewer.shadows = true;
                    break;
                default:
                    console.warn("MapService: Unknown visualization mode requested:", mode);
                    return;
            }
            viewer.scene.mode = targetCesiumMode;
        } else {
            console.warn("MapService: Cesium Viewer not available when attempting to set visualization mode.");
        }
    }

    /**
     * Dispatches a command to update the globe's clock time.
     * @param {object} time - An object containing hour, minute, and ampm.
     */
    setGlobeClockTime(time) {
        this.globeClockTimeChanged$.next(time);
        this.currentGlobeClockTime$.next(time); // NEW: Update the stored time
        console.log("MapService: Dispatching globe clock time change:", time);
    }

    /**
     * Gets the current stored globe clock time.
     * @returns {object} The current time {hour, minute, ampm}.
     */
    getCurrentGlobeClockTime() {
        return this.currentGlobeClockTime$.getValue();
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