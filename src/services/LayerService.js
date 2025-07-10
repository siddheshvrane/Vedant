// src/services/LayerService.js
import { BehaviorSubject } from 'rxjs';
import { MapService } from './MapService.js'; // Import MapService

/**
 * LayerService: Manages the collection of layers and their states.
 * Coordinates with MapService for map-related layer actions.
 */
class LayerServiceClass {
    // Initialize with only the Vedas Satellite Imagery
    layers$ = new BehaviorSubject([
        { 
            id: 'vedas-satellite-imagery', // Unique ID for Vedas imagery
            name: 'Vedas Satellite Imagery', 
            isVisible: true, 
            type: 'wms', 
            source: 'service' 
        },
    ]);

    // Internal storage for original data/service models
    #layerDataMap = new Map(); // Stores Data/Service models by ID
    #cesiumViewer = null; // Holds the Cesium viewer instance

    // Subscription to manage internal layer updates for the globe
    #layersSubscription = null;

    constructor() {
        // Prepare the initial layer data for #layerDataMap
        // This simulates receiving the full Data/Service model for the Vedas imagery
        const initialVedasLayer = {
            id: 'vedas-satellite-imagery',
            name: 'Vedas Satellite Imagery',
            isVisible: true,
            type: 'wms',
            source: 'service',
            baseUrl: 'https://bhuvan-ras1.nrsc.gov.in/tilecache/tilecache.py', // Actual URL
            args: { // WMS specific arguments
                layers: 'bhuvan_img',
                version: '1.1.1',
                format: 'image/jpeg',
                transparent: true,
                tiled: true,
                srs: 'EPSG:4326'
            }
        };
        this.#layerDataMap.set(initialVedasLayer.id, initialVedasLayer);


        // Subscribe to globe viewer changes from MapService
        MapService.globeViewer$.subscribe(viewer => {
            this.#cesiumViewer = viewer;
            if (viewer) {
                console.log('LayerService: Cesium Viewer is available. Initializing globe layers.');
                // Re-sync all current layers with the globe.
                // This will add 'Vedas Satellite Imagery' to Cesium via addCesiumLayer
                this.syncGlobeLayers(); 
            } else {
                console.log('LayerService: Cesium Viewer is no longer available.');
                // Potentially clear all layers from Cesium if viewer is destroyed/nullified
            }
        });

        // Subscribe to our own layers$ to react to list changes
        this.#layersSubscription = this.layers$.subscribe(updatedLayers => {
            // This observable now drives the UI AND can be used to re-sync the globe
            // We'll call syncGlobeLayers() specifically when needed, not on every change
            // as individual methods (add/remove/toggle) will trigger their own globe updates.
            // This subscription is more for general monitoring or for complex re-syncs.
        });
    }

    getLayers() {
        return this.layers$.getValue();
    }

    /**
     * Adds a new data or service entry to the layers list.
     * The new entry will be placed at the top (beginning) of the list (LIFO/Stack behavior).
     * @param {object} entry - The Data or Service object to add (must have id and name),
     * this `entry` should be the full Data or Service model.
     */
    addGeoSpatialEntry(entry) {
        if (!entry || !entry.id || !entry.name) {
            console.error('LayerService: Invalid entry provided for adding layer.', entry);
            return;
        }

        const currentLayers = this.getLayers();
        if (currentLayers.some(layer => layer.id === entry.id)) {
            console.warn(`LayerService: Layer with ID ${entry.id} already exists. Not adding.`);
            return;
        }

        const newLayer = {
            id: entry.id,
            name: entry.name,
            isVisible: true, // New layers are visible by default
            type: entry.type, // e.g., 'geojson', 'wms', 'kml', 'gltf'
            source: entry.constructor.name === 'Data' ? 'data' : 'service', // Differentiate Data vs Service models
        };

        // Store the full entry model for Cesium handling later
        this.#layerDataMap.set(entry.id, entry);

        const updatedLayers = [newLayer, ...currentLayers]; 
        this.layers$.next(updatedLayers);
        console.log(`LayerService: Added new layer to top: ${newLayer.name}`);

        // Add to Cesium Globe if viewer is ready and layer is visible
        if (this.#cesiumViewer && newLayer.isVisible) {
            this.addCesiumLayer(entry); // Pass the full entry model
        }
    }

    /**
     * Attempts to add a layer to the Cesium Globe.
     * This method needs to understand different layer types (GeoJSON, WMS, etc.).
     * @param {object} layerEntry - The full Data or Service model.
     */
    addCesiumLayer(layerEntry) {
        if (!this.#cesiumViewer) {
            console.warn('LayerService: Cesium Viewer not available, cannot add layer to globe.');
            return;
        }
        if (!layerEntry.id) {
            console.error('LayerService: Cannot add Cesium layer, missing ID:', layerEntry);
            return;
        }

        // We use MapService to interact with CesiumGlobeManager
        // MapService will then call the appropriate method on globeManager
        MapService.addLayerToGlobe(layerEntry);
        console.log(`LayerService: Requested addition of ${layerEntry.name} to Cesium globe.`);
    }

    /**
     * Removes a layer from the Cesium Globe.
     * @param {string} layerId - The ID of the layer to remove.
     */
    removeCesiumLayer(layerId) {
        if (!this.#cesiumViewer) {
            console.warn('LayerService: Cesium Viewer not available, cannot remove layer from globe.');
            return;
        }
        MapService.removeLayerFromGlobe(layerId);
        console.log(`LayerService: Requested removal of layer ${layerId} from Cesium globe.`);
    }

    /**
     * Toggles visibility of a layer on the Cesium Globe.
     * @param {string} layerId - The ID of the layer.
     * @param {boolean} isVisible - The desired visibility state.
     */
    toggleCesiumLayerVisibility(layerId, isVisible) {
        if (!this.#cesiumViewer) {
            console.warn('LayerService: Cesium Viewer not available, cannot toggle layer visibility.');
            return;
        }
        MapService.toggleLayerVisibilityOnGlobe(layerId, isVisible);
        console.log(`LayerService: Requested toggle visibility for layer ${layerId} to ${isVisible}.`);
    }

    /**
     * Reconciles the list of layers in LayerService with the layers displayed on the Cesium Globe.
     * This is useful for initial setup or after major state changes.
     * In this basic implementation, we'll just add all visible layers.
     * A more sophisticated sync would compare existing layers and update accordingly.
     */
    syncGlobeLayers() {
        if (!this.#cesiumViewer) {
            console.warn('LayerService: Cannot sync globe layers, Cesium Viewer not available.');
            return;
        }

        // Clear existing custom layers from globe (excluding base imagery/terrain handled by CesiumGlobeManager itself)
        MapService.clearCustomGlobeLayers(); // Needs to be implemented in MapService/CesiumGlobeManager

        const currentLayers = this.getLayers();
        currentLayers.forEach(uiLayer => {
            if (uiLayer.isVisible) {
                const fullLayerData = this.#layerDataMap.get(uiLayer.id);
                if (fullLayerData) {
                    // Important: The Vedas Satellite Imagery is already added as a base layer
                    // by CesiumGlobeManager's init method. We only add it here if it's
                    // intended to be a *managed* layer, meaning it can be toggled/removed.
                    // If it's a fixed base layer, you might skip adding it here to avoid duplicates
                    // or handle it specially in CesiumGlobeManager.
                    // For now, we'll assume it's a managed layer.
                    this.addCesiumLayer(fullLayerData);
                } else {
                    console.warn(`LayerService: Full data for layer ${uiLayer.id} not found during sync. Cannot add to globe.`);
                }
            }
        });
        console.log('LayerService: Globe layers synchronized with UI state.');
    }

    // --- Existing methods, now with calls to update Cesium via MapService ---

    zoomToLayer(layerId) {
        const layer = this.#layerDataMap.get(layerId); // Get full data for zoom
        if (layer) {
            console.log(`LayerService: Requesting zoom to layer: ${layer.name}`);
            // You'll need to define a proper bounding box or entity for zoom for each layer type
            // For now, let's assume a generic zoom, or enhance this based on layer type
            MapService.zoomToLayer(layer);
        } else {
            console.warn(`LayerService: Layer ${layerId} not found for zoom.`);
        }
    }

    toggleLayerVisibility(layerId, isVisible) {
        const currentLayers = this.getLayers();
        const layerIndex = currentLayers.findIndex(l => l.id === layerId);
        if (layerIndex !== -1) {
            const layersCopy = [...currentLayers];
            layersCopy[layerIndex] = { ...layersCopy[layerIndex], isVisible: isVisible };
            
            this.layers$.next(layersCopy);
            console.log(`LayerService: Toggling visibility for UI layer ${layersCopy[layerIndex].name}: ${isVisible}`);
            
            // --- NEW: Update Cesium layer visibility ---
            this.toggleCesiumLayerVisibility(layerId, isVisible);
        }
    }

    editLayer(layerId) {
        const layer = this.#layerDataMap.get(layerId);
        if (layer) {
            console.log(`LayerService: Requesting edit for layer: ${layer.name}`);
            // TODO: Implement actual layer editing UI/logic
        }
    }

    removeLayer(layerId) {
        const layerName = this.getLayers().find(l => l.id === layerId)?.name || 'unknown layer';
        const updatedLayers = this.getLayers().filter(layer => layer.id !== layerId);
        this.layers$.next(updatedLayers);
        this.#layerDataMap.delete(layerId); // Also remove from our internal map
        
        console.log(`LayerService: Removed UI layer: ${layerName} (ID: ${layerId})`);
        
        // --- NEW: Remove from Cesium Globe ---
        this.removeCesiumLayer(layerId);
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
            const layersCopy = [...currentLayers]; // Work on a copy
            const [movedLayer] = layersCopy.splice(index, 1);
            layersCopy.splice(newIndex, 0, movedLayer);
            this.layers$.next(layersCopy); // Emit the new copy
            console.log(`LayerService: UI Layer ${layerId} moved from ${index} to ${newIndex}`);
            
            // --- IMPORTANT: This requires Cesium layers to also be reordered. ---
            // For now, let's trigger a full re-sync for simplicity, which will re-add them in order.
            this.syncGlobeLayers(); 
        }
    }
}
export const LayerService = new LayerServiceClass();