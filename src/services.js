// src/services.js
import { Subject } from 'rxjs'; // RxJS is used for reactive programming, managing streams of events.

/**
 * MapService: Provides a centralized mechanism for different components to communicate
 * and trigger map-related actions (e.g., updating view, rendering graphics)
 * without direct coupling. It acts as a singleton.
 */
class MapServiceClass {
    // Observables (Subjects) that components can subscribe to, listening for events.
    // When a method (e.g., updateView) calls `.next()` on its corresponding Subject,
    // all subscribed components receive the data.
    updateView$ = new Subject();       // Emits data when the map view properties change.
    redirectGlobe$ = new Subject();    // For general globe redirection commands.
    orientToNorth$ = new Subject();    // Specifically triggers the globe to orient North.
    renderGraphic$ = new Subject();    // Emits a graphic object to be rendered on the map.
    removeGraphic$ = new Subject();    // Emits an identifier to remove a specific graphic.
    zoomToCoordinates$ = new Subject(); // Emits coordinates to trigger a zoom/fly-to action.
    displayLocationMarker$ = new Subject(); // Emits location data to display a marker/label.

    // Methods to push data/events to the corresponding observables.
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
}

// Export a singleton instance of the service so all imports refer to the same object.
export const MapService = new MapServiceClass();

// Additional services (UserInterfaceService, SearchService, etc.) would be defined and exported here.