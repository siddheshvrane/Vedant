// src/components/Globe/managers/LayerManager.js
import { LayerService } from '../../../../services/LayerService.js';
import { MapService } from '../../../../services/MapService.js';

/**
 * LayerManager: Handles all layer business logic and coordinates with MapService.
 * Subscribes to LayerService communication events and manages layer state.
 */
class LayerManager {
    constructor() {
        // Internal storage for original data/service models
        this.layerDataMap = new Map();
        this.cesiumViewer = null;
        
        // Initialize with Vedas Satellite Imagery as default layer
        this.initializeDefaultLayers();
        
        // Subscribe to LayerService action streams
        this.setupLayerServiceSubscriptions();
        
        // Subscribe to MapService globe viewer changes
        this.setupMapServiceSubscriptions();
    }

    /**
     * Initializes default layers (Vedas Satellite Imagery)
     */
    initializeDefaultLayers() {
        const initialVedasLayer = {
            id: 'vedas-satellite-imagery',
            name: 'Vedas Satellite Imagery',
            isVisible: true,
            type: 'wms',
            source: 'service',
            baseUrl: 'https://bhuvan-ras1.nrsc.gov.in/tilecache/tilecache.py',
            args: {
                layers: 'bhuvan_img',
                version: '1.1.1',
                format: 'image/jpeg',
                transparent: true,
                tiled: true,
                srs: 'EPSG:4326'
            }
        };

        this.layerDataMap.set(initialVedasLayer.id, initialVedasLayer);
        
        // Update LayerService with initial layers
        LayerService.updateLayers([{
            id: 'vedas-satellite-imagery',
            name: 'Vedas Satellite Imagery',
            isVisible: true,
            type: 'wms',
            source: 'service'
        }]);
        
        console.log('LayerManager: Initialized with default Vedas layer');
    }

    /**
     * Sets up subscriptions to LayerService action streams
     */
    setupLayerServiceSubscriptions() {
        // Add layer requests
        LayerService.addLayer$.subscribe(entry => {
            if (entry) {
                this.handleAddGeoSpatialEntry(entry);
            }
        });

        // Remove layer requests
        LayerService.removeLayer$.subscribe(layerId => {
            if (layerId) {
                this.handleRemoveLayer(layerId);
            }
        });

        // Toggle visibility requests
        LayerService.toggleVisibility$.subscribe(data => {
            if (data) {
                this.handleToggleLayerVisibility(data.layerId, data.isVisible);
            }
        });

        // Move layer requests
        LayerService.moveLayer$.subscribe(data => {
            if (data) {
                this.handleMoveLayer(data.layerId, data.direction);
            }
        });

        // Zoom to layer requests
        LayerService.zoomToLayer$.subscribe(layerId => {
            if (layerId) {
                this.handleZoomToLayer(layerId);
            }
        });

        // Edit layer requests
        LayerService.editLayer$.subscribe(layerId => {
            if (layerId) {
                this.handleEditLayer(layerId);
            }
        });

        // Sync layers requests
        LayerService.syncLayers$.subscribe(shouldSync => {
            if (shouldSync) {
                this.handleSyncGlobeLayers();
            }
        });

        console.log('LayerManager: Subscribed to LayerService action streams');
    }

    /**
     * Sets up subscriptions to MapService events
     */
    setupMapServiceSubscriptions() {
        // Subscribe to globe viewer changes
        MapService.globeViewer$.subscribe(viewer => {
            this.cesiumViewer = viewer;
            if (viewer) {
                console.log('LayerManager: Cesium Viewer is available. Initializing globe layers.');
                this.handleSyncGlobeLayers();
            } else {
                console.log('LayerManager: Cesium Viewer is no longer available.');
            }
        });

        // Subscribe to external visibility toggles (if any)
        MapService.toggleLayerVisibilityOnGlobe$.subscribe(({ layerId, isVisible }) => {
            LayerService.updateLayerVisibility(layerId, isVisible);
        });

        console.log('LayerManager: Subscribed to MapService events');
    }

    // --- Business Logic Handlers ---

    /**
     * Handles adding a new geospatial entry
     * @param {object} entry - The Data or Service object to add
     */
    handleAddGeoSpatialEntry(entry) {
        if (!entry || !entry.id || !entry.name) {
            console.error('LayerManager: Invalid entry provided for adding layer.', entry);
            return;
        }

        const currentLayers = LayerService.getLayers();
        if (currentLayers.some(layer => layer.id === entry.id)) {
            console.warn(`LayerManager: Layer with ID ${entry.id} already exists. Not adding.`);
            return;
        }

        const newLayer = {
            id: entry.id,
            name: entry.name,
            isVisible: true,
            type: entry.type,
            source: entry.constructor?.name === 'Data' ? 'data' : 'service',
        };

        // Store the full entry model for Cesium handling
        this.layerDataMap.set(entry.id, entry);

        // Update LayerService with new layer at the beginning (LIFO)
        const updatedLayers = [newLayer, ...currentLayers];
        LayerService.updateLayers(updatedLayers);
        
        console.log(`LayerManager: Added new layer to top: ${newLayer.name}`);

        // Trigger globe synchronization
        this.handleSyncGlobeLayers();

        // Zoom to the new layer
        this.handleZoomToLayer(entry.id);
    }

    /**
     * Handles removing a layer
     * @param {string} layerId - The ID of the layer to remove
     */
    handleRemoveLayer(layerId) {
        const currentLayers = LayerService.getLayers();
        const layerName = currentLayers.find(l => l.id === layerId)?.name || 'unknown layer';
        
        const updatedLayers = currentLayers.filter(layer => layer.id !== layerId);
        LayerService.updateLayers(updatedLayers);
        
        this.layerDataMap.delete(layerId);
        
        console.log(`LayerManager: Removed layer: ${layerName} (ID: ${layerId})`);
        
        // Trigger globe synchronization
        this.handleSyncGlobeLayers();
    }

    /**
     * Handles toggling layer visibility
     * @param {string} layerId - The ID of the layer
     * @param {boolean} isVisible - The desired visibility state
     */
    handleToggleLayerVisibility(layerId, isVisible) {
        const currentLayers = LayerService.getLayers();
        const layerIndex = currentLayers.findIndex(l => l.id === layerId);
        
        if (layerIndex !== -1) {
            const layersCopy = [...currentLayers];
            layersCopy[layerIndex] = { ...layersCopy[layerIndex], isVisible: isVisible };
            
            LayerService.updateLayers(layersCopy);
            console.log(`LayerManager: Toggling visibility for layer ${layersCopy[layerIndex].name}: ${isVisible}`);
            
            // Direct call to MapService for efficient visibility toggle
            MapService.toggleLayerVisibilityOnGlobe(layerId, isVisible);
        }
    }

    /**
     * Handles moving a layer up or down
     * @param {string} layerId - The ID of the layer to move
     * @param {string} direction - Direction to move ('up' or 'down')
     */
    handleMoveLayer(layerId, direction) {
        const currentLayers = LayerService.getLayers();
        const index = currentLayers.findIndex(l => l.id === layerId);
        
        if (index === -1) return;

        let newIndex = index;
        if (direction === 'up') {
            newIndex = Math.max(0, index - 1);
        } else if (direction === 'down') {
            newIndex = Math.min(currentLayers.length - 1, index + 1);
        }

        if (newIndex !== index) {
            const layersCopy = [...currentLayers];
            const [movedLayer] = layersCopy.splice(index, 1);
            layersCopy.splice(newIndex, 0, movedLayer);
            
            LayerService.updateLayers(layersCopy);
            console.log(`LayerManager: Layer ${layerId} moved from ${index} to ${newIndex}`);
            
            // Trigger full re-sync for correct Z-order
            this.handleSyncGlobeLayers();
        }
    }

    /**
     * Handles zooming to a layer
     * @param {string} layerId - The ID of the layer to zoom to
     */
    handleZoomToLayer(layerId) {
        const layer = this.layerDataMap.get(layerId);
        if (layer) {
            console.log(`LayerManager: Requesting zoom to layer: ${layer.name}`);
            MapService.zoomToLayer(layer);
        } else {
            console.warn(`LayerManager: Layer ${layerId} not found for zoom.`);
        }
    }

    /**
     * Handles editing a layer (placeholder for future implementation)
     * @param {string} layerId - The ID of the layer to edit
     */
    handleEditLayer(layerId) {
        const layer = this.layerDataMap.get(layerId);
        if (layer) {
            console.log(`LayerManager: Edit layer requested for: ${layer.name}`);
            // TODO: Implement layer editing functionality
            // This could involve opening a modal, updating layer properties, etc.
        } else {
            console.warn(`LayerManager: Layer ${layerId} not found for editing.`);
        }
    }

    /**
     * Handles synchronizing globe layers
     */
    handleSyncGlobeLayers() {
        if (!this.cesiumViewer) {
            console.warn('LayerManager: Cannot sync globe layers, Cesium Viewer not available.');
            return;
        }

        const currentLayersInServiceOrder = LayerService.getLayers();
        
        // Merge UI state with full layer data
        const layersToReconcile = currentLayersInServiceOrder.map(uiLayer => {
            const fullData = this.layerDataMap.get(uiLayer.id);
            return fullData ? { ...fullData, isVisible: uiLayer.isVisible } : null;
        }).filter(Boolean);

        // Tell MapService to orchestrate the globe update
        MapService.reconcileGlobeLayers(layersToReconcile);
        console.log('LayerManager: Globe layers synchronized with UI state');
    }

    // --- Public API for direct access if needed ---

    /**
     * Gets the full layer data for a specific layer
     * @param {string} layerId - The layer ID
     * @returns {object|null} The full layer data or null if not found
     */
    getLayerData(layerId) {
        return this.layerDataMap.get(layerId) || null;
    }

    /**
     * Gets all layer data
     * @returns {Map} Map of all layer data
     */
    getAllLayerData() {
        return new Map(this.layerDataMap);
    }

    /**
     * Destroys the LayerManager and cleans up subscriptions
     */
    destroy() {
        this.layerDataMap.clear();
        this.cesiumViewer = null;
        console.log('LayerManager: Destroyed and cleaned up');
    }
}

export default LayerManager;