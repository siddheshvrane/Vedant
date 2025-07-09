// src/services/LayerService.js
import { BehaviorSubject } from 'rxjs';

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