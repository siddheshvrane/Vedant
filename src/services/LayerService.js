// src/services/LayerService.js
import { BehaviorSubject } from 'rxjs';

/**
 * LayerService: Pure communication service for layer management.
 * Only handles RxJS communication between components - no business logic.
 */
class LayerServiceClass {
    // Observable streams for communication
    layers$ = new BehaviorSubject([]);
    
    // Action streams for component communication
    addLayer$ = new BehaviorSubject(null);
    removeLayer$ = new BehaviorSubject(null);
    toggleVisibility$ = new BehaviorSubject(null);
    moveLayer$ = new BehaviorSubject(null);
    zoomToLayer$ = new BehaviorSubject(null);
    editLayer$ = new BehaviorSubject(null);
    syncLayers$ = new BehaviorSubject(null);

    constructor() {
        console.log('LayerService: Pure communication service initialized');
    }

    // --- Read-only getters ---
    getLayers() {
        return this.layers$.getValue();
    }

    // --- Communication methods - emit actions for managers to handle ---
    
    /**
     * Emits an add layer action for managers to handle
     * @param {object} entry - The Data or Service object to add
     */
    requestAddGeoSpatialEntry(entry) {
        console.log(`LayerService: Requesting to add layer: ${entry?.name}`);
        this.addLayer$.next(entry);
    }

    /**
     * Emits a remove layer action for managers to handle
     * @param {string} layerId - The ID of the layer to remove
     */
    requestRemoveLayer(layerId) {
        console.log(`LayerService: Requesting to remove layer: ${layerId}`);
        this.removeLayer$.next(layerId);
    }

    /**
     * Emits a toggle visibility action for managers to handle
     * @param {string} layerId - The ID of the layer
     * @param {boolean} isVisible - The desired visibility state
     */
    requestToggleLayerVisibility(layerId, isVisible) {
        console.log(`LayerService: Requesting to toggle layer ${layerId} visibility: ${isVisible}`);
        this.toggleVisibility$.next({ layerId, isVisible });
    }

    /**
     * Emits a move layer action for managers to handle
     * @param {string} layerId - The ID of the layer to move
     * @param {string} direction - Direction to move ('up' or 'down')
     */
    requestMoveLayer(layerId, direction) {
        console.log(`LayerService: Requesting to move layer ${layerId} ${direction}`);
        this.moveLayer$.next({ layerId, direction });
    }

    /**
     * Emits a zoom to layer action for managers to handle
     * @param {string} layerId - The ID of the layer to zoom to
     */
    requestZoomToLayer(layerId) {
        console.log(`LayerService: Requesting to zoom to layer: ${layerId}`);
        this.zoomToLayer$.next(layerId);
    }

    /**
     * Emits an edit layer action for managers to handle
     * @param {string} layerId - The ID of the layer to edit
     */
    requestEditLayer(layerId) {
        console.log(`LayerService: Requesting to edit layer: ${layerId}`);
        this.editLayer$.next(layerId);
    }

    /**
     * Emits a sync layers action for managers to handle
     */
    requestSyncLayers() {
        console.log('LayerService: Requesting layer synchronization');
        this.syncLayers$.next(true);
    }

    // --- State update methods - called by managers ---
    
    /**
     * Updates the layers list - called by LayerManager
     * @param {Array} layers - Updated layers array
     */
    updateLayers(layers) {
        this.layers$.next(layers);
        console.log(`LayerService: Updated layers list (${layers.length} layers)`);
    }

    /**
     * Updates a specific layer's visibility - called by LayerManager
     * @param {string} layerId - Layer ID
     * @param {boolean} isVisible - Visibility state
     */
    updateLayerVisibility(layerId, isVisible) {
        const currentLayers = this.getLayers();
        const layerIndex = currentLayers.findIndex(l => l.id === layerId);
        if (layerIndex !== -1) {
            const layersCopy = [...currentLayers];
            layersCopy[layerIndex] = { ...layersCopy[layerIndex], isVisible: isVisible };
            this.layers$.next(layersCopy);
            console.log(`LayerService: Updated layer ${layerId} visibility to ${isVisible}`);
        }
    }

    // --- Legacy method aliases for backward compatibility ---
    // These will be deprecated once all components are updated
    
    addGeoSpatialEntry(entry) {
        console.warn('LayerService: addGeoSpatialEntry is deprecated, use requestAddGeoSpatialEntry');
        this.requestAddGeoSpatialEntry(entry);
    }

    removeLayer(layerId) {
        console.warn('LayerService: removeLayer is deprecated, use requestRemoveLayer');
        this.requestRemoveLayer(layerId);
    }

    toggleLayerVisibility(layerId, isVisible) {
        console.warn('LayerService: toggleLayerVisibility is deprecated, use requestToggleLayerVisibility');
        this.requestToggleLayerVisibility(layerId, isVisible);
    }

    moveLayer(layerId, direction) {
        console.warn('LayerService: moveLayer is deprecated, use requestMoveLayer');
        this.requestMoveLayer(layerId, direction);
    }

    zoomToLayer(layerId) {
        console.warn('LayerService: zoomToLayer is deprecated, use requestZoomToLayer');
        this.requestZoomToLayer(layerId);
    }

    editLayer(layerId) {
        console.warn('LayerService: editLayer is deprecated, use requestEditLayer');
        this.requestEditLayer(layerId);
    }

    syncGlobeLayers() {
        console.warn('LayerService: syncGlobeLayers is deprecated, use requestSyncLayers');
        this.requestSyncLayers();
    }
}

export const LayerService = new LayerServiceClass();