// src/services/AppInitializer.js
import { MapService } from './MapService.js';
import { UserInterfaceService } from './UserInterfaceService.js';

/**
 * AppInitializerClass: Orchestrates the overall application loading flow.
 */
class AppInitializerClass {
    constructor() {
        this.projectLogoReadySubscription = null;
        this.globeInitializedSubscription = null;
        this.globeViewerSubscription = null;
    }

    initialize() {
        this.projectLogoReadySubscription = UserInterfaceService.projectLogoReady$.subscribe(() => {
            MapService.triggerGlobeInitialization();
        });

        this.globeInitializedSubscription = MapService.globeInitialized$.subscribe(isReady => {
            if (isReady) {
                // Globe is ready.
            } else {
                console.error('AppInitializer: Globe failed to initialize.');
            }
        });

        this.globeViewerSubscription = MapService.globeViewer$.subscribe(viewer => {
            if (viewer) {
                // Cesium Viewer instance received.
            } else {
                // Cesium Viewer instance is null (failed init or destroyed).
            }
        });
    }

    destroy() {
        if (this.projectLogoReadySubscription) this.projectLogoReadySubscription.unsubscribe();
        if (this.globeInitializedSubscription) this.globeInitializedSubscription.unsubscribe();
        if (this.globeViewerSubscription) this.globeViewerSubscription.unsubscribe();
    }
}

// Export the class, not an instance, as it might be instantiated once in the main app file.
export { AppInitializerClass };