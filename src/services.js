// src/services.js
import { Subject } from 'rxjs'; // Make sure you have RxJS installed: npm install rxjs

/**
 * MapService: Manages map view updates, graphic rendering, and globe redirection.
 * Corresponds to MapService in the class diagram[cite: 49, 50].
 */
class MapServiceClass {
    // Observables that components can subscribe to
    updateView$ = new Subject(); // For MapService: Update View [cite: 49]
    redirectGlobe$ = new Subject(); // For MapService: Redirect Globe (e.g., for Compass) [cite: 50]
    orientToNorth$ = new Subject(); // For MapService: Orient to North [cite: 53]
    renderGraphic$ = new Subject(); // For MapService: Render Graphic [cite: 54]
    removeGraphic$ = new Subject(); // For MapService: Remove Graphic [cite: 56]
    zoomToCoordinates$ = new Subject(); // For internal helper, but exposed for other components to trigger Globe's method [cite: 46]
    displayLocationMarker$ = new Subject(); // For internal helper, exposed for other components to trigger Globe's method [cite: 47]


    // Methods to trigger events
    updateView(updateData) {
        console.log('MapService: Triggering Update View with:', updateData);
        this.updateView$.next(updateData);
    }

    redirectGlobe(viewData) {
        console.log('MapService: Triggering Redirect Globe with:', viewData);
        this.redirectGlobe$.next(viewData);
    }

    orientToNorth() {
        console.log('MapService: Triggering Orient to North');
        this.orientToNorth$.next();
    }

    renderGraphic(graphic) {
        console.log('MapService: Triggering Render Graphic with:', graphic);
        this.renderGraphic$.next(graphic);
    }

    removeGraphic(graphicIdentifier) {
        console.log('MapService: Triggering Remove Graphic for:', graphicIdentifier);
        this.removeGraphic$.next(graphicIdentifier);
    }

    zoomToCoordinates(coordinates) {
        console.log('MapService: Triggering Zoom To Coordinates with:', coordinates);
        this.zoomToCoordinates$.next(coordinates);
    }

    displayLocationMarker(location) {
        console.log('MapService: Triggering Display Location Marker with:', location);
        this.displayLocationMarker$.next(location);
    }
}

// Export a singleton instance of the service
export const MapService = new MapServiceClass();

// You'll add other services (UserInterfaceService, SearchService, etc.) here as you refactor.