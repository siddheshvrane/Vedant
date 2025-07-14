// src/workers/terrain-sampler-worker.js
// This file runs in a separate thread to perform heavy computations.

import * as Cesium from 'cesium';

self.onmessage = async (e) => {
    const { type, cartographicPoints, terrainProviderUrl } = e.data;

    if (type === 'sampleTerrain') {
        try {
            // Recreate a CesiumTerrainProvider instance within the worker's context.
            // This is crucial because Cesium objects cannot be directly transferred between threads.
            let terrainProvider = Cesium.createWorldTerrain(); // Default fallback
            if (terrainProviderUrl) {
                try {
                    terrainProvider = new Cesium.CesiumTerrainProvider({
                        url: terrainProviderUrl,
                        // Add any other specific terrain options you use in your main app
                        requestVertexNormals: true,
                        requestWaterMask: true
                    });
                } catch (providerError) {
                    console.error("Worker: Failed to create CesiumTerrainProvider from URL.", providerError);
                    self.postMessage({ type: 'error', message: `Failed to initialize terrain provider: ${providerError.message}` });
                    return;
                }
            }

            // Ensure the terrainProvider is ready before attempting to sample
            if (!terrainProvider.ready) {
                 await terrainProvider.readyPromise; // Wait for the terrain provider to be ready
            }

            // Perform the heavy terrain sampling computation
            const sampledCartographics = await Cesium.sampleTerrainMostDetailed(terrainProvider, cartographicPoints);
            const sampledCartesians = sampledCartographics.map(c => Cesium.Ellipsoid.WGS84.cartographicToCartesian(c));

            // Send the results back to the main thread
            self.postMessage({ type: 'sampledResult', sampledPoints: sampledCartesians });

        } catch (error) {
            console.error("Worker: Error during terrain sampling:", error);
            self.postMessage({ type: 'error', message: error.message });
        }
    }
};