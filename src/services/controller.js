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
            new MenuItem('addData', 'Add Data', 'far fa-plus', 'AddDataSidebar', '350px'),
            // Updated: Increased width for Layer Manager to accommodate more content
            new MenuItem('layerManager', 'Layer Manager', 'fas fa-layer-group', 'LayerManagerSidebar', '450px'), 
            new MenuItem('visualization', 'Visualization', 'far fa-eye', 'VisualizationSidebar', '350px'),
            new MenuItem('tools', 'Tools', 'fas fa-tools', 'BasicToolsSidebar', '350px'), 
            new MenuItem('plugins', 'Plugins', 'fas fa-plug', 'PluginManagerSidebar', '350px'),
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
}
export const PopupService = new PopupServiceClass();

/**
 * DataAddService: Handles the logic for adding new data or services.
 * Matches 'DataAddService: RequestAddData' from diagram. 
 */
class DataAddServiceClass {
    dataAdded$ = new Subject();
    serviceAdded$ = new Subject();
    submissionSuccess$ = new Subject(); // For success messages to UI
    submissionError$ = new Subject();   // For error messages to UI

    /**
     * Internal helper to read file content as text.
     * @param {File} file - The File object to read.
     * @returns {Promise<string>} - A promise that resolves with the file content.
     */
    async #readFileAsText(file) { // Using private class field syntax (#)
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
        });
    }

    /**
     * Internal helper to parse JSON string.
     * @param {string} jsonString - The JSON string to parse.
     * @param {string} fieldName - The name of the field for error reporting.
     * @returns {object|null} - The parsed JSON object or null if parsing fails.
     */
    #parseJson(jsonString, fieldName) { // Using private class field syntax (#)
        if (!jsonString) {
            return {};
        }
        try {
            return JSON.parse(jsonString);
        } catch (e) {
            console.error(`Error parsing ${fieldName} JSON:`, e);
            this.submissionError$.next(`Invalid JSON in ${fieldName}. Please check the syntax.`);
            return null;
        }
    }

    /**
     * Processes the complete geo-spatial content submission from the form.
     * This method handles validation, file reading, and model construction.
     * @param {object} payload - The raw form data payload from GeoSpatialForm.
     * @param {File|null} file - The uploaded File object, if any.
     */
    async processGeoSpatialSubmission(payload, file) {
        // 1. Basic Validation
        if (!payload.contentName) {
            this.submissionError$.next('Please enter a name for the content.');
            return;
        }

        if (payload.selectedOption === 'data') {
            // Data submission
            if (payload.contentType === 'geojson') {
                if (!file) {
                    this.submissionError$.next('Please select a JSON file for GeoJSON data.');
                    return;
                }
                try {
                    const fileContent = await this.#readFileAsText(file);
                    const jsonData = JSON.parse(fileContent);

                    const dataModel = new Data(
                        `data-${Date.now()}`,
                        payload.contentName,
                        payload.contentType,
                        { jsonContent: jsonData }
                    );
                    this.addData(dataModel);
                    this.submissionSuccess$.next('GeoJSON Data Added Successfully!');
                } catch (error) {
                    console.error('DataAddService: Error processing GeoJSON file:', error);
                    this.submissionError$.next(`Failed to process GeoJSON file: ${error.message || error}. Please check file content.`);
                }
            } else {
                // Handle other data types (kml, shapefile) that might not involve files or use different sources
                // For now, they just have name and type
                const dataModel = new Data(
                    `data-${Date.now()}`,
                    payload.contentName,
                    payload.contentType,
                    {} // No specific srcInfo for now if no file/URL
                );
                this.addData(dataModel);
                this.submissionSuccess$.next(`${payload.contentType.toUpperCase()} Data Added Successfully!`);
            }
        } else {
            // Service submission
            if (!payload.baseUrl) {
                this.submissionError$.next('Please enter a Base URL for the service.');
                return;
            }

            const parsedArgs = this.#parseJson(payload.argsInput, 'Args');
            if (parsedArgs === null) return; // Error already emitted by #parseJson

            const parsedLegendOptions = this.#parseJson(payload.legendOptionsInput, 'Legend Options');
            if (parsedLegendOptions === null) return; // Error already emitted by #parseJson

            const serviceModel = new Service(
                `service-${Date.now()}`,
                payload.contentName,
                payload.contentType,
                payload.baseUrl,
                parsedArgs,
                parsedLegendOptions
            );
            this.addService(serviceModel);
            this.submissionSuccess$.next('Service Added Successfully!');
        }
    }


    /**
     * Processes the request to add geospatial data.
     * @param {Data} dataModel - An instance of the Data data model. 
     */
    addData(dataModel) {
        if (!(dataModel instanceof Data)) {
            console.error('DataAddService: Invalid data model provided.', dataModel);
            this.submissionError$.next('Internal Error: Invalid data model.');
            return;
        }
        console.log('DataAddService: Processing data addition for:', dataModel);
        
        let srs = 'N/A';
        let extent = 'N/A';

        // If it's GeoJSON, try to extract SRS/extent from jsonContent if available
        if (dataModel.type === 'geojson' && dataModel.srcInfo && dataModel.srcInfo.jsonContent) {
            const jsonContent = dataModel.srcInfo.jsonContent;
            if (jsonContent.crs && jsonContent.crs.properties && jsonContent.crs.properties.name) {
                srs = jsonContent.crs.properties.name;
            }
            if (jsonContent.bbox) {
                extent = JSON.stringify(jsonContent.bbox);
            }
        }
        if (srs === 'N/A' && dataModel.srcInfo && dataModel.srcInfo.srs) {
            srs = dataModel.srcInfo.srs;
        }
        if (extent === 'N/A' && dataModel.srcInfo && dataModel.srcInfo.extent) {
            extent = dataModel.srcInfo.extent;
        }

        PopupService.show({
            layerName: dataModel.name,
            srs: srs,
            extent: extent
        });
        this.dataAdded$.next(dataModel);
    }

    /**
     * Processes the request to add a geospatial service.
     * @param {Service} serviceModel - An instance of the Service data model. 
     */
    addService(serviceModel) {
        if (!(serviceModel instanceof Service)) {
            console.error('DataAddService: Invalid service model provided.', serviceModel);
            this.submissionError$.next('Internal Error: Invalid service model.');
            return;
        }
        console.log('DataAddService: Processing service addition for:', serviceModel);
        
        PopupService.show({
            layerName: serviceModel.name,
            srs: serviceModel.args.srs || 'N/A',
            extent: serviceModel.args.extent || 'N/A'
        });
        this.serviceAdded$.next(serviceModel);
    }
}
export const DataAddService = new DataAddServiceClass();


/**
 * LayerService: Manages the collection of layers and their states.
 * Coordinates with MapService for map-related layer actions.
 */
class LayerServiceClass {
    layers$ = new BehaviorSubject([
        { id: 'layer1', name: 'Satellite Imagery', isVisible: true },
        { id: 'layer2', name: '3D Model', isVisible: false },
        { id: 'layer3', name: 'Elevation Data', isVisible: true },
        { id: 'layer4', name: 'Road Networks', isVisible: false },
        { id: 'layer5', name: 'Land Use Zones', isVisible: true },
    ]);

    getLayers() {
        return this.layers$.getValue();
    }

    zoomToLayer(layerId) {
        const layer = this.getLayers().find(l => l.id === layerId);
        if (layer) {
            console.log(`LayerService: Requesting zoom to layer: ${layer.name}`);
        }
    }

    toggleLayerVisibility(layerId, isVisible) {
        const currentLayers = this.getLayers();
        const layerIndex = currentLayers.findIndex(l => l.id === layerId);
        if (layerIndex !== -1) {
            currentLayers[layerIndex].isVisible = isVisible;
            this.layers$.next([...currentLayers]);
            console.log(`LayerService: Toggling visibility for layer ${currentLayers[layerIndex].name}: ${isVisible}`);
        }
    }

    editLayer(layerId) {
        const layer = this.getLayers().find(l => l.id === layerId);
        if (layer) {
            console.log(`LayerService: Requesting edit for layer: ${layer.name}`);
        }
    }

    removeLayer(layerId) {
        const layerName = this.getLayers().find(l => l.id === layerId)?.name || 'unknown layer';
        const updatedLayers = this.getLayers().filter(layer => layer.id !== layerId);
        this.layers$.next(updatedLayers);
        console.log(`LayerService: Removed layer: ${layerName} (ID: ${layerId})`);
    }

    moveLayer(layerId, direction) {
        const currentLayers = this.getLayers();
        const index = currentLayers.findIndex(l => l.id === layerId);
        if (index === -1) return;

        let newIndex = index;
        if (direction === 'up') {
            newIndex = Math.max(0, index - 1);
        } else if (direction === 'down') {
            newIndex = Math.min(currentLayers.length - 1, index + 1);
        }

        if (newIndex !== index) {
            const [movedLayer] = currentLayers.splice(index, 1);
            currentLayers.splice(newIndex, 0, movedLayer);
            this.layers$.next([...currentLayers]);
            console.log(`LayerService: Layer ${layerId} moved from ${index} to ${newIndex}`);
        }
    }
}
export const LayerService = new LayerServiceClass();


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