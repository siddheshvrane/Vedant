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
                        // IMPORTANT: Ensure these options match those used in your main application
                        // if they are critical for consistent terrain behavior (e.g., for lighting, water effects).
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

            // --- OPTIONAL PERFORMANCE OPTIMIZATION FOR LARGE DATASETS ---
            // Instead of sending an array of Cesium.Cartesian3 objects (which are copied),
            // you can flatten the data into a TypedArray (like Float64Array) and transfer its buffer.
            // This avoids the overhead of structured cloning for each Cartesian3 object.

            // To implement this optimization:
            // 1. Uncomment the 'flatCartesians' and 'postMessage' lines below.
            // 2. Comment out the 'sampledCartesians' and original 'postMessage' lines.
            // 3. In your main thread, where you receive the worker message (e.g., in AreaMeasureTool.js),
            //    you would need to convert the received Float64Array back into an array of Cesium.Cartesian3 objects.

            // const flatCartesians = new Float64Array(sampledCartesians.length * 3);
            // for (let i = 0; i < sampledCartesians.length; i++) {
            //     flatCartesians[i * 3] = sampledCartesians[i].x;
            //     flatCartesians[i * 3 + 1] = sampledCartesians[i].y;
            //     flatCartesians[i * 3 + 2] = sampledCartesians[i].z;
            // }
            // self.postMessage({ type: 'sampledResult', sampledPoints: flatCartesians }, [flatCartesians.buffer]);

            // Original approach (works, but copies Cartesian3 objects for large arrays):
            self.postMessage({ type: 'sampledResult', sampledPoints: sampledCartesians });

        } catch (error) {
            console.error("Worker: Error during terrain sampling:", error);
            self.postMessage({ type: 'error', message: error.message });
        }
    }
};