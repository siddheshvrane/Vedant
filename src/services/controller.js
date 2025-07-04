// src/services/controller.js - This file now serves as the main entry point and service container.

// Set CESIUM_BASE_URL to tell Cesium where to find its assets (Workers, Assets, etc.).
// This MUST be set before Cesium itself is imported.
window.CESIUM_BASE_URL = '/Cesium/';

// 1. Core Application Imports
// These imports are typically found in main.js, now included here as this is the entry.
import { createApp } from 'vue';
import App from '../App.vue'; // Path to your main App.vue component
import 'bootstrap/dist/css/bootstrap.min.css'; // Bootstrap CSS

// Cesium Imports and Configuration
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

// Set Cesium defaultAccessToken (replace 'YOUR_CESIUM_ION_ACCESS_TOKEN' with your actual token)
// You can get one from https://ion.cesium.com/
Cesium.Ion.defaultAccessToken = 'YOUR_CESIUM_ION_ACCESS_TOKEN'; // <<< IMPORTANT: Update this!

// Make Cesium globally available (if your existing components or external libraries expect it)
window.Cesium = Cesium;

// 2. RxJS Subject Import (needed by the services)
import { Subject } from 'rxjs';

// 3. Service Definitions
// These classes define the logic and communication channels for different parts of your application.

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

    // Subjects for Globe initialization status and viewer instance
    initGlobe$ = new Subject(); // Emits to tell Globe.vue to initialize Cesium
    globeInitialized$ = new Subject(); // Globe.vue emits true/false after init attempt
    globeViewer$ = new Subject(); // Globe.vue emits the Cesium viewer instance

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

    // Methods to trigger and receive globe status
    triggerGlobeInitialization() {
        this.initGlobe$.next();
        console.log('MapService: Triggering Globe initialization.');
    }
    notifyGlobeInitialized(isReady) {
        this.globeInitialized$.next(isReady);
        console.log('MapService: Globe initialized status:', isReady);
    }
    setGlobeViewer(viewerInstance) {
        this.globeViewer$.next(viewerInstance);
        console.log('MapService: Cesium Viewer instance set.');
    }
}
// Export an instance of MapServiceClass as MapService
export const MapService = new MapServiceClass();


/**
 * UserInterfaceService: Manages global UI state, such as sidebar visibility and active features.
 */
class UserInterfaceServiceClass {
    openSidebarPanel$ = new Subject();
    closeSidebar$ = new Subject();
    activateFeature$ = new Subject();
    handleCloseSubMenu$ = new Subject();

    isSidebarOpen$ = new Subject();
    projectLogoReady$ = new Subject(); // ProjectLogo.vue emits this when its animation is done

    openInitialMenu() {
        this.openSidebarPanel$.next();
        this.isSidebarOpen$.next(true);
        console.log('UserInterfaceService: Opening initial menu.');
    }

    closeAll() {
        this.closeSidebar$.next();
        this.isSidebarOpen$.next(false);
        console.log('UserInterfaceService: Closing all panels and returning to globe.');
    }

    handleMenuItemClick(item) {
        console.log('UserInterfaceService: Menu item clicked:', item);
        this.activateFeature$.next(item);
    }

    handleCloseSubMenu() {
        this.openInitialMenu();
        console.log('UserInterfaceService: Sub-menu closed, returning to main menu.');
    }

    // Method for ProjectLogo to signal readiness
    notifyProjectLogoReady() {
        this.projectLogoReady$.next();
        console.log('UserInterfaceService: ProjectLogo ready signal emitted.');
    }

    toggleSidebar(isOpen) {
        this.isSidebarOpen$.next(isOpen);
        console.log('UserInterfaceService: Toggled sidebar to:', isOpen);
    }
}
// Export an instance of UserInterfaceServiceClass as UserInterfaceService
export const UserInterfaceService = new UserInterfaceServiceClass();


/**
 * MenuItemService: Manages the retrieval and distribution of menu items.
 */
class MenuItemServiceClass {
    menuItemsLoaded$ = new Subject();

    retrieveAll() {
        const items = [
            { id: 'addData', label: 'Add Data', icon: 'far fa-plus', component: 'AddDataSidebar', width: '350px' },
            { id: 'layerManager', label: 'Layer Manager', icon: 'fas fa-layer-group', component: 'LayerManagerSidebar', width: '350px' },
            { id: 'visualization', label: 'Visualization', icon: 'far fa-eye', component: 'VisualizationSidebar', width: '350px' },
            { id: 'tools', label: 'Tools', icon: 'fas fa-tools', component: 'ToolsSidebar', width: '350px' },
            { id: 'plugins', label: 'Plugins', icon: 'fas fa-plug', component: 'PluginManagerSidebar', width: '350px' },
        ];
        this.menuItemsLoaded$.next(items);
        console.log('MenuItemService: Menu items retrieved and loaded.');
    }
}
// Export an instance of MenuItemServiceClass as MenuItemService
export const MenuItemService = new MenuItemServiceClass();

/**
 * AppInitializerClass: Orchestrates the overall application loading flow.
 * In this merged file, it's defined and an instance is created/initialized below.
 * It's NOT exported, as it's used internally within this main entry file.
 */
class AppInitializerClass {
    constructor() {
        this.projectLogoReadySubscription = null;
        this.globeInitializedSubscription = null;
        this.globeViewerSubscription = null;
    }

    initialize() {
        // Step 1: Listen for ProjectLogo to signal its completion.
        this.projectLogoReadySubscription = UserInterfaceService.projectLogoReady$.subscribe(() => {
            console.log('AppInitializer: ProjectLogo ready, triggering Globe initialization.');
            MapService.triggerGlobeInitialization();
        });

        // Step 2: Listen for Globe initialization status.
        this.globeInitializedSubscription = MapService.globeInitialized$.subscribe(isReady => {
            if (isReady) {
                console.log('AppInitializer: Globe is ready. The menu icon should now be visible and waiting for a click.');
                // *** REMOVED: UserInterfaceService.openInitialMenu(); ***
                // The sidebar will now remain hidden by default until user interaction.
            } else {
                console.error('AppInitializer: Globe failed to initialize.');
            }
        });

        // Step 3: Listen for the Cesium viewer instance from Globe.vue
        this.globeViewerSubscription = MapService.globeViewer$.subscribe(viewer => {
            if (viewer) {
                console.log('AppInitializer: Cesium Viewer instance received.');
            } else {
                console.log('AppInitializer: Cesium Viewer instance is null (failed init or destroyed).');
            }
        });
    }

    // Call this if AppInitializer needs to be cleaned up (e.g., in a complex unmount scenario)
    destroy() {
        if (this.projectLogoReadySubscription) this.projectLogoReadySubscription.unsubscribe();
        if (this.globeInitializedSubscription) this.globeInitializedSubscription.unsubscribe();
        if (this.globeViewerSubscription) this.globeViewerSubscription.unsubscribe();
    }
}

// 4. Application Bootstrapping
// Create the Vue application instance and mount it to the '#app' element in your index.html
createApp(App).mount('#app');

// 5. Initialize the App Flow Controller
// Create an instance of AppInitializerClass and start its initialization process.
// This will set up the main subscriptions for your app's loading flow.
const appInitializer = new AppInitializerClass();
appInitializer.initialize();