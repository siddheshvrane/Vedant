// src/components/Globe/managers/CesiumGeoDataManager.js
import * as Cesium from 'cesium';
import { createGeoJsonLayer, createKmlLayer, createCzmlLayer, create3DTileLayer, create3DModelLayer, createWmsLayer, createWmtsLayer } from './CesiumLayerFactory';
import { INDIA_BBOX } from './CesiumCoreManager'; // Keep this import as per original file

class CesiumGeoDataManager {
    constructor(viewer) {
        if (!viewer) {
            throw new Error('Cesium Viewer instance is required for CesiumGeoDataManager.');
        }
        this.viewer = viewer;
        // Internal map to store Cesium layer objects by their ID
        this.cesiumLayersMap = new Map();
    }

    /**
     * Adds a geospatial layer to the Cesium globe based on its type.
     * @param {object} layerEntry - The full Data or Service model.
     * @param {number} [imageryIndex] - Optional. For imagery layers, the exact index at which to insert the layer.
     * @returns {Promise<Cesium.ImageryLayer|Cesium.DataSource|Cesium.Cesium3DTileset|Cesium.Entity|null>} The Cesium layer object, or null if failed.
     */
    async addLayer(layerEntry, imageryIndex) {
        if (this.cesiumLayersMap.has(layerEntry.id)) {
            console.warn(`CesiumGeoDataManager: Layer with ID ${layerEntry.id} already known. Skipping re-add.`);
            const existingLayer = this.cesiumLayersMap.get(layerEntry.id);
            if (existingLayer) {
                if (existingLayer instanceof Cesium.ImageryLayer || existingLayer instanceof Cesium.DataSource || existingLayer instanceof Cesium.Cesium3DTileset || existingLayer instanceof Cesium.Entity) {
                    existingLayer.show = layerEntry.isVisible;
                }
            }
            return existingLayer;
        }

        let cesiumLayer = null;
        let blobUrlForCleanup = null;

        try {
            switch (layerEntry.type) {
                case 'geojson':
                    cesiumLayer = await createGeoJsonLayer(this.viewer, layerEntry);
                    break;
                case 'kml':
                    cesiumLayer = await createKmlLayer(this.viewer, layerEntry);
                    break;
                case 'czml':
                    cesiumLayer = await createCzmlLayer(this.viewer, layerEntry);
                    break;
                case '3dtile':
                    cesiumLayer = await create3DTileLayer(this.viewer, layerEntry);
                    break;
                case '3dmodel':
                    const modelResult = await create3DModelLayer(this.viewer, layerEntry, INDIA_BBOX);
                    cesiumLayer = modelResult.layer;
                    blobUrlForCleanup = modelResult.blobUrl;
                    break;
                case 'wms':
                    cesiumLayer = await createWmsLayer(this.viewer, layerEntry, imageryIndex);
                    break;
                case 'wmts':
                    cesiumLayer = await createWmtsLayer(this.viewer, layerEntry, imageryIndex);
                    break;
                default:
                    console.warn(`CesiumGeoDataManager: Unsupported layer type or missing data for ${layerEntry.name} (Type: ${layerEntry.type}).`);
                    return null;
            }

            if (cesiumLayer) {
                this.cesiumLayersMap.set(layerEntry.id, cesiumLayer);
                console.log(`CesiumGeoDataManager: Added ${layerEntry.type.toUpperCase()} layer: ${layerEntry.name}. Visible: ${cesiumLayer.show}`);
                // Store blob URL on the layer object for later revocation if it's a 3D model
                if (blobUrlForCleanup && cesiumLayer instanceof Cesium.Entity) {
                    cesiumLayer._blobUrl = blobUrlForCleanup;
                    blobUrlForCleanup = null; // Mark as handled
                }
            }
            return cesiumLayer;

        } catch (error) {
            console.error(`CesiumGeoDataManager: Error adding layer ${layerEntry.name}:`, error);
            return null;
        } finally {
            if (blobUrlForCleanup) {
                URL.revokeObjectURL(blobUrlForCleanup);
                console.warn(`CesiumGeoDataManager: Revoked transient Blob URL due to failed layer addition for ${layerEntry.name}`);
            }
        }
    }

    /**
     * Removes a geospatial layer from the Cesium globe.
     * @param {string} layerId - The ID of the layer to remove.
     */
    removeLayer(layerId) {
        const cesiumLayer = this.cesiumLayersMap.get(layerId);
        if (cesiumLayer) {
            if (cesiumLayer instanceof Cesium.ImageryLayer) {
                this.viewer.imageryLayers.remove(cesiumLayer, true);
            } else if (cesiumLayer instanceof Cesium.DataSource) {
                this.viewer.dataSources.remove(cesiumLayer, true);
            } else if (cesiumLayer instanceof Cesium.Cesium3DTileset) {
                this.viewer.scene.primitives.remove(cesiumLayer);
            } else if (cesiumLayer instanceof Cesium.Entity) {
                this.viewer.entities.remove(cesiumLayer);
                if (cesiumLayer._blobUrl) {
                    URL.revokeObjectURL(cesiumLayer._blobUrl);
                    console.log(`CesiumGeoDataManager: Revoked Blob URL for 3D Model with ID: ${layerId}`);
                }
            } else {
                console.warn(`CesiumGeoDataManager: Could not remove layer type for ID ${layerId}. Not a recognized Cesium layer type.`);
                return;
            }
            console.log(`CesiumGeoDataManager: Removed layer with ID: ${layerId}`);
            this.cesiumLayersMap.delete(layerId);
        } else {
            console.warn(`CesiumGeoDataManager: Layer with ID ${layerId} not found on globe to remove.`);
        }
    }

    /**
     * Toggles the visibility of a geospatial layer on the Cesium globe.
     * @param {string} layerId - The ID of the layer.
     * @param {boolean} isVisible - The desired visibility state.
     */
    toggleLayerVisibility(layerId, isVisible) {
        const cesiumLayer = this.cesiumLayersMap.get(layerId);
        if (cesiumLayer) {
            if (cesiumLayer instanceof Cesium.ImageryLayer || cesiumLayer instanceof Cesium.DataSource || cesiumLayer instanceof Cesium.Cesium3DTileset || cesiumLayer instanceof Cesium.Entity) {
                cesiumLayer.show = isVisible;
            }
            console.log(`CesiumGeoDataManager: Toggled visibility for layer ${layerId} to ${isVisible}`);
        } else {
            console.warn(`CesiumGeoDataManager: Layer with ID ${layerId} not found to toggle visibility.`);
        }
    }

    /**
     * Clears all custom (non-base) layers and then re-adds/updates layers
     * based on the provided ordered list.
     * @param {Array<Object>} layersToReconcile - An ordered array of full layer entry objects.
     */
    async reconcileLayers(layersToReconcile) {
        if (!this.viewer) {
            console.warn('CesiumGeoDataManager: Viewer not initialized, cannot reconcile layers.');
            return;
        }

        console.log('CesiumGeoDataManager: Starting layer reconciliation...');
        console.log('Desired UI order (Top to Bottom):', layersToReconcile.map(l => l.name));

        const blobUrlsToRevoke = [];
        this.viewer.entities.values.forEach(entity => {
            if (entity.model && entity._blobUrl) {
                blobUrlsToRevoke.push(entity._blobUrl);
            }
        });

        this.viewer.dataSources.removeAll();
        this.viewer.entities.removeAll();
        for (let i = this.viewer.imageryLayers.length - 1; i >= 0; i--) {
            const layer = this.viewer.imageryLayers.get(i);
            if (i > 0) {
                this.viewer.imageryLayers.remove(layer, true);
            }
        }
        for (let i = this.viewer.scene.primitives.length - 1; i >= 0; i--) {
            const primitive = this.viewer.scene.primitives.get(i);
            if (primitive instanceof Cesium.Cesium3DTileset) {
                this.viewer.scene.primitives.remove(primitive);
            }
        }

        this.cesiumLayersMap.clear();
        console.log('CesiumGeoDataManager: Cleared all existing dynamic globe layers, data sources, entities, and 3D Tilesets.');

        blobUrlsToRevoke.forEach(url => {
            URL.revokeObjectURL(url);
            console.log(`CesiumGeoDataManager: Revoked Blob URL during reconciliation: ${url}`);
        });

        const imageryLayersReversed = layersToReconcile.filter(l => ['wms', 'wmts'].includes(l.type)).reverse();
        const dataAndModels = layersToReconcile.filter(l => ['geojson', 'kml', 'czml', '3dtile', '3dmodel'].includes(l.type));

        for (let i = 0; i < imageryLayersReversed.length; i++) {
            const layerEntry = imageryLayersReversed[i];
            console.log(`CesiumGeoDataManager: Adding ${layerEntry.type.toUpperCase()} layer ${layerEntry.name} (UI order: ${layersToReconcile.indexOf(layerEntry)}, Cesium imagery index: ${i})`);
            await this.addLayer(layerEntry, i);
        }

        for (const layerEntry of dataAndModels) {
            console.log(`CesiumGeoDataManager: Adding ${layerEntry.type.toUpperCase()} layer ${layerEntry.name}`);
            await this.addLayer(layerEntry);
        }

        console.log('CesiumGeoDataManager: Layer reconciliation complete.');
    }

    /**
     * Zooms the globe to the extent of a specific layer.
     * @param {object} layerEntry - The full layer entry object (from LayerService).
     */
    async zoomToLayer(layerEntry) {
        if (!this.viewer) {
            console.warn('CesiumGeoDataManager: Viewer not initialized, cannot zoom to layer.');
            return;
        }

        let cesiumLayer = this.cesiumLayersMap.get(layerEntry.id);

        if (cesiumLayer instanceof Promise) {
            try {
                cesiumLayer = await cesiumLayer;
                this.cesiumLayersMap.set(layerEntry.id, cesiumLayer);
            } catch (error) {
                console.error(`CesiumGeoDataManager: Failed to resolve layer promise for zoom: ${layerEntry.id}`, error);
                return;
            }
        }

        if (!cesiumLayer) {
            console.warn(`CesiumGeoDataManager: Layer ${layerEntry.id} not found or not yet available for zoom.`);
            return;
        }

        if (cesiumLayer instanceof Cesium.ImageryLayer) {
            if (layerEntry.bbox) {
                const rect = Cesium.Rectangle.fromDegrees(
                    layerEntry.bbox[0], layerEntry.bbox[1],
                    layerEntry.bbox[2], layerEntry.bbox[3]
                );
                this.viewer.camera.flyTo({ destination: rect, duration: 1.5 });
                console.log(`CesiumGeoDataManager: Zoomed to ImageryLayer extent: ${layerEntry.name}`);
            } else if (layerEntry.id === 'vedas-satellite-imagery') {
                this.viewer.camera.flyTo({
                    destination: INDIA_BBOX,
                    duration: 2.0
                });
                console.log(`CesiumGeoDataManager: Zoomed to general extent for Vedas Satellite Imagery.`);
            } else {
                console.warn(`CesiumGeoDataManager: Cannot precisely zoom to ImageryLayer ${layerEntry.name}. No extent information.`);
                this.viewer.camera.flyHome();
            }
        } else if (cesiumLayer instanceof Cesium.DataSource) {
            if (cesiumLayer.entities.values.length > 0) {
                this.viewer.flyTo(cesiumLayer.entities, { duration: 1.5 });
                console.log(`CesiumGeoDataManager: Zoomed to DataSource (GeoJSON/KML/CZML) layer: ${layerEntry.name}`);
            } else {
                console.warn(`CesiumGeoDataManager: DataSource layer ${layerEntry.name} has no entities to zoom to.`);
                this.viewer.camera.flyHome();
            }
        } else if (cesiumLayer instanceof Cesium.Cesium3DTileset) {
            this.viewer.flyTo(cesiumLayer, { duration: 1.5 });
            console.log(`CesiumGeoDataManager: Zoomed to 3D Tileset layer: ${layerEntry.name}`);
        } else if (cesiumLayer instanceof Cesium.Entity && layerEntry.type === '3dmodel') {
            this.viewer.flyTo(cesiumLayer, { duration: 1.5 });
            console.log(`CesiumGeoDataManager: Zoomed to 3D Model layer: ${layerEntry.name}`);
        } else {
            console.warn(`CesiumGeoDataManager: Unsupported layer type for zooming: ${layerEntry.type}`);
            this.viewer.camera.flyHome();
        }
    }
}

export default CesiumGeoDataManager;