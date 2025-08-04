// src/services/LayerService.js
import { BehaviorSubject } from 'rxjs';
import { MapService } from './MapService.js'; // Import MapService

/**
 * LayerService: Manages the collection of layers and their states.
 * Coordinates with MapService for map-related layer actions.
 */
class LayerServiceClass {
    // Initialize with only the Vedas Satellite Imagery as a regular layer
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

    constructor() {
        // Prepare the initial layer data for #layerDataMap
        // Vedas is now just a regular WMS layer
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
                // When viewer becomes available, sync all layers to it.
                // This will now properly add Vedas as well.
                this.syncGlobeLayers();
            } else {
                console.log('LayerService: Cesium Viewer is no longer available.');
            }
        });

        // IMPORTANT: Subscribe to MapService's toggle events if external
        // interactions (not through LayerService) can change layer visibility.
        // This ensures LayerService's internal state (layers$.value) is always in sync.
        MapService.toggleLayerVisibilityOnGlobe$.subscribe(({ layerId, isVisible }) => {
            this.updateLayerVisibilityInService(layerId, isVisible);
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

        // Update the UI list immediately by adding new layer at the beginning
        const updatedLayers = [newLayer, ...currentLayers];
        this.layers$.next(updatedLayers);
        console.log(`LayerService: Added new layer to top: ${newLayer.name}`);

        // Trigger a full synchronization of globe layers to ensure new layer is added
        // and all layers retain correct visibility and Z-order.
        this.syncGlobeLayers();

        // --- NEW LINE ADDED HERE ---
        // After adding the new layer, call the zoom method to redirect the globe's camera.
        this.zoomToLayer(entry.id);
    }

    /**
     * Removes a layer from the internal state and triggers a globe sync.
     * @param {string} layerId - The ID of the layer to remove.
     */
    removeLayer(layerId) {
        const layerName = this.getLayers().find(l => l.id === layerId)?.name || 'unknown layer';
        const updatedLayers = this.getLayers().filter(layer => layer.id !== layerId);
        this.layers$.next(updatedLayers);
        this.#layerDataMap.delete(layerId); // Also remove from our internal map

        console.log(`LayerService: Removed UI layer: ${layerName} (ID: ${layerId})`);

        // Trigger a full synchronization to remove the layer from the globe.
        this.syncGlobeLayers();
    }

    /**
     * Toggles visibility of a layer in the internal state and on the Cesium Globe.
     * @param {string} layerId - The ID of the layer.
     * @param {boolean} isVisible - The desired visibility state.
     */
    toggleLayerVisibility(layerId, isVisible) {
        const currentLayers = this.getLayers();
        const layerIndex = currentLayers.findIndex(l => l.id === layerId);
        if (layerIndex !== -1) {
            const layersCopy = [...currentLayers];
            layersCopy[layerIndex] = { ...layersCopy[layerIndex], isVisible: isVisible };

            this.layers$.next(layersCopy);
            console.log(`LayerService: Toggling visibility for UI layer ${layersCopy[layerIndex].name}: ${isVisible}`);

            // Direct call to MapService to toggle visibility for a single layer.
            // This is efficient and doesn't require a full re-sync for just visibility.
            MapService.toggleLayerVisibilityOnGlobe(layerId, isVisible);
        }
    }

    /**
     * Reconciles the list of layers in LayerService with the layers displayed on the Cesium Globe.
     * This is useful for initial setup, after major state changes (like viewer initialization, add, remove, or reordering).
     */
    syncGlobeLayers() {
        if (!this.#cesiumViewer) {
            console.warn('LayerService: Cannot sync globe layers, Cesium Viewer not available.');
            return;
        }

        const currentLayersInServiceOrder = this.getLayers();
        // For reconciliation, we need the full layer data (including baseUrl, args, srcInfo.jsonContent)
        // merged with the current isVisible state from the UI list.
        const layersToReconcile = currentLayersInServiceOrder.map(uiLayer => {
            const fullData = this.#layerDataMap.get(uiLayer.id);
            // Ensure fullData exists and merge the current isVisible state
            return fullData ? { ...fullData, isVisible: uiLayer.isVisible } : null;
        }).filter(Boolean); // Filter out any nulls if a layer's full data isn't found

        // This crucial call tells MapService to orchestrate the globe update.
        // MapService will then tell CesiumGlobeManager to clear and re-add/update layers.
        MapService.reconcileGlobeLayers(layersToReconcile);
        console.log('LayerService: Globe layers synchronized with UI state based on current order and visibility.');
    }

    // --- Existing methods ---

    /**
     * Tells the MapService to zoom the globe camera to a specific layer's extent.
     * @param {string} layerId - The ID of the layer to zoom to.
     */
    zoomToLayer(layerId) {
        const layer = this.#layerDataMap.get(layerId); // Get full data for zoom
        if (layer) {
            console.log(`LayerService: Requesting zoom to layer: ${layer.name}`);
            MapService.zoomToLayer(layer);
        } else {
            console.warn(`LayerService: Layer ${layerId} not found for zoom.`);
        }
    }

    // Internal method to update LayerService's state if globe-side visibility changes
    updateLayerVisibilityInService(layerId, isVisible) {
        const currentLayers = this.getLayers();
        const layerIndex = currentLayers.findIndex(l => l.id === layerId);
        if (layerIndex !== -1) {
            const layersCopy = [...currentLayers];
            layersCopy[layerIndex] = { ...layersCopy[layerIndex], isVisible: isVisible };
            this.layers$.next(layersCopy);
            console.log(`LayerService: Internal state updated for layer ${layerId} visibility to ${isVisible}.`);
        }
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

            // --- CRITICAL CHANGE: Trigger a full re-sync for the globe's Z-order ---
            // This is necessary because Cesium's imagery/data sources need to be re-ordered.
            this.syncGlobeLayers();
        }
    }
}
export const LayerService = new LayerServiceClass();