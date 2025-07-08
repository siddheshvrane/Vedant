// controller.js
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
import { Subject, BehaviorSubject } from 'rxjs';

// NEW: Import Data Models
import MenuItem from '../datamodels/MenuItem.js';
import Data from '../datamodels/Data.js'; // Import Data model 
import Service from '../datamodels/Service.js'; // Import Service model 


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
    displayLocationMarker$ = new Subject(); // This subject's payload would likely be a Location object

    // Subjects for Globe initialization status and viewer instance
    initGlobe$ = new Subject(); // Emits to tell Globe.vue to initialize Cesium
    globeInitialized$ = new Subject(); // Globe.vue emits true/false after init attempt
    globeViewer$ = new BehaviorSubject(null); // Globe.vue emits the Cesium viewer instance, using BehaviorSubject for current value

    // Changed this from Subject to BehaviorSubject to hold the current state
    visualizationModeChanged$ = new BehaviorSubject('3D'); // Default to 3D Globe

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

    /**
     * Sets the visualization mode for the Cesium globe.
     * Also updates the internal state.
     * @param {string} mode - The desired visualization mode ('2D', '3D', 'Anaglyph').
     */
    setVisualizationMode(mode) {
        console.log("MapService: Setting visualization mode to", mode);
        this.visualizationModeChanged$.next(mode); // Update the internal state

        const viewer = this.getGlobeViewer(); // Get the current Cesium Viewer instance
        if (viewer) {
            let targetCesiumMode;

            switch (mode) {
                case '2D':
                    targetCesiumMode = Cesium.SceneMode.SCENE2D;
                    break;
                case '3D': // Corresponds to "2.5D (3D Globe)"
                    targetCesiumMode = Cesium.SceneMode.SCENE3D;
                    break;
                case 'Anaglyph':
                    console.warn("MapService: Anaglyph 3D mode is not yet implemented.");
                    return; // Exit if not implemented
                default:
                    console.warn("MapService: Unknown visualization mode requested:", mode);
                    return; // Exit for unknown mode
            }

            // Direct assignment for immediate mode change
            viewer.scene.mode = targetCesiumMode;

        } else {
            console.warn("MapService: Cesium Viewer not available when attempting to set visualization mode.");
        }
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
    activateFeature$ = new Subject(); // Signals Sidebar.vue to activate a feature or sub-menu
    
    isSidebarOpen$ = new BehaviorSubject(false); 
    projectLogoReady$ = new Subject(); // ProjectLogo.vue emits this when its animation is done

    // NEW: Subject for sidebar width updates
    sidebarWidthUpdated$ = new BehaviorSubject('0px'); // Default width when closed

    openInitialMenu() {
        this.openSidebarPanel$.next();
        this.isSidebarOpen$.next(true);
    }

    closeAll() {
        this.closeSidebar$.next();
        this.isSidebarOpen$.next(false);
        this.sidebarWidthUpdated$.next('0px'); // Reset width when sidebar is globally closed
    }

    handleMenuItemClick(item) {
        this.activateFeature$.next(item);
    }

    /**
     * Signals Sidebar.vue to return to the main menu view.
     */
    handleCloseSubMenu() {
        this.activateFeature$.next(null); // Signal Sidebar.vue to reset active sub-menu to null
    }

    // Method for ProjectLogo to signal readiness
    notifyProjectLogoReady() {
        this.projectLogoReady$.next();
    }

    toggleSidebar(isOpen) {
        this.isSidebarOpen$.next(isOpen);
        if (!isOpen) {
            this.sidebarWidthUpdated$.next('0px'); // Reset width when sidebar is explicitly toggled closed
        }
    }

    // NEW: Method to update sidebar width from Sidebar.vue
    updateSidebarWidth(width) {
        this.sidebarWidthUpdated$.next(width);
    }
    setSidebarOpen(isOpen) {
        this.isSidebarOpen$.next(isOpen);
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
            new MenuItem('addData', 'Add Data', 'far fa-plus', 'AddDataSidebar', '400px'),
            // Updated: Increased width for Layer Manager to accommodate more content
            new MenuItem('layerManager', 'Layer Manager', 'fas fa-layer-group', 'LayerManagerSidebar', '400px'), 
            new MenuItem('visualization', 'Visualization', 'far fa-eye', 'VisualizationSidebar', '350px'),
            new MenuItem('tools', 'Tools', 'fas fa-tools', 'BasicToolsSidebar', '350px'), 
            new MenuItem('plugins', 'Plugins', 'fas fa-plug', 'PluginManagerSidebar', '400px'),
        ];
        this.menuItemsLoaded$.next(items);
    }
}
// Export an instance of MenuItemServiceClass as MenuItemService
export const MenuItemService = new MenuItemServiceClass();

/**
 * PopupService: Manages the display and data for the application-wide popup.
 * Integrated here.
 * Matches 'Popup Form' attributes/methods from diagram.
 */
class PopupServiceClass {
    isVisible$ = new BehaviorSubject(false);
    parameters$ = new BehaviorSubject({
        layerName: '',
        srs: '',
        extent: ''
    });

    /**
     * Shows the popup with given parameters.
     * @param {object} params - Object containing layerName, srs, extent.
     */
    show(params) {
        this.parameters$.next(params);
        this.isVisible$.next(true);
    }

    /**
     * Hides the popup.
     */
    hide() {
        this.isVisible$.next(false);
        this.parameters$.next({
            layerName: '',
            srs: '',
            extent: ''
        });
    }
    // Note: getD() and submitForm() from Popup Form diagram are typically handled
    // by the component (e.g., GeoSpatialForm) that collects input, not the display popup itself.
}
export const PopupService = new PopupServiceClass();

/**
 * DataAddService: Handles the logic for adding new data or services.
 * Matches 'DataAddService: RequestAddData' from diagram. 
 */
class DataAddServiceClass {
    // This subject could be used to notify other parts of the app about a successful add,
    // though the PopupService already handles the immediate feedback.
    dataAdded$ = new Subject();
    serviceAdded$ = new Subject();

    /**
     * Processes the request to add geospatial data.
     * @param {Data} dataModel - An instance of the Data data model. 
     */
    addData(dataModel) {
        if (!(dataModel instanceof Data)) {
            console.error('DataAddService: Invalid data model provided.', dataModel);
            return;
        }
        console.log('DataAddService: Processing data addition for:', dataModel);
        // Simulate data processing/API call
        // In a real app, this would involve network requests, then potentially
        // calling MapService.renderGraphic or similar.
        
        // On success, show popup
        PopupService.show({
            layerName: dataModel.name,
            srs: dataModel.srcInfo.srs || 'N/A', // Assuming srs is part of srcInfo
            extent: dataModel.srcInfo.extent || 'N/A' // Assuming extent is part of srcInfo
        });
        this.dataAdded$.next(dataModel); // Notify other subscribers
    }

    /**
     * Processes the request to add a geospatial service.
     * @param {Service} serviceModel - An instance of the Service data model. 
     */
    addService(serviceModel) {
        if (!(serviceModel instanceof Service)) {
            console.error('DataAddService: Invalid service model provided.', serviceModel);
            return;
        }
        console.log('DataAddService: Processing service addition for:', serviceModel);
        // Simulate service processing/API call
        // This might involve validating the service URL, fetching capabilities, etc.
        // Then potentially calling MapService to add a layer based on the service.
        
        // On success, show popup
        PopupService.show({
            layerName: serviceModel.name,
            srs: serviceModel.args.srs || 'N/A', // Assuming srs is part of args for a service
            extent: serviceModel.args.extent || 'N/A' // Assuming extent is part of args
        });
        this.serviceAdded$.next(serviceModel); // Notify other subscribers
    }

    // Methods corresponding to prepareGraphic() and execute() for Service
    // These would be internal to the DataAddService or GraphicProductionService
    // For now, they are conceptual, but would be called during addData/addService if needed.
    // prepareGraphic(dataOrService) { /* ... */ }
    // execute(dataOrService) { /* ... */ }
}
export const DataAddService = new DataAddServiceClass();


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

// 4. Application Bootstrapping
createApp(App).mount('#app');

// 5. Initialize the App Flow Controller
const appInitializer = new AppInitializerClass();
appInitializer.initialize();