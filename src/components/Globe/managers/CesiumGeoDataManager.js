import * as Cesium from "cesium";
import { INDIA_BBOX } from "./CesiumCoreManager"; // Assuming this is defined in this file

class CesiumGeoDataManager {
  constructor(viewer) {
    if (!viewer) {
      throw new Error(
        "Cesium Viewer instance is required for CesiumGeoDataManager."
      );
    }
    this.viewer = viewer;
    this.cesiumLayersMap = new Map();
    this.currentLocationMarkerEntity = null;

    if (!this.viewer.terrainProvider) {
      console.warn(
        "CesiumGeoDataManager: Viewer does not have a terrain provider. Models might not be placed accurately on the ground."
      );
    }
  }
  /**
   * Adds a geospatial layer to the Cesium globe based on its type.
   * @param {object} layerEntry - The full Data or Service model.
   * @param {number} [imageryIndex] - Optional. For imagery layers, the exact index at which to insert the layer.
   * @returns {Promise<object|null>} The primary Cesium layer object.
   */
  async addLayer(layerEntry, imageryIndex, shouldZoom = false) {
    if (this.cesiumLayersMap.has(layerEntry.id)) {
      console.warn(
        `[DEBUG] CesiumGeoDataManager: Layer with ID ${layerEntry.id} already known. Updating visibility.`
      );
      const existingLayer = await Promise.resolve(
        this.cesiumLayersMap.get(layerEntry.id)
      );
      if (existingLayer) {
        this.toggleLayerVisibility(layerEntry.id, layerEntry.isVisible);
      }
      return existingLayer;
    }

    let cesiumLayer = null;
    let modelUri = null;

    try {
      if (
        layerEntry.type === "geojson" &&
        (layerEntry.srcInfo?.geojsonDetails?.jsonContent || layerEntry.url)
      ) {
        try {
          const source =
            layerEntry.srcInfo?.geojsonDetails?.jsonContent || layerEntry.url;

          // Load GeoJSON DataSource
          const ds = await Cesium.GeoJsonDataSource.load(source, {
            stroke: Cesium.Color.HOTPINK,
            fill: Cesium.Color.PINK.withAlpha(0.5),
            strokeWidth: 3,
            clampToGround: true,
          });

          // Iterate entities to style them
          ds.entities.values.forEach((entity) => {
            // Remove existing billboard
            if (entity.billboard) entity.billboard = undefined;

            // Ensure points are visible
            if (!entity.point) {
              entity.point = {
                pixelSize: 10,
                color: Cesium.Color.RED,
                outlineColor: Cesium.Color.WHITE,
                outlineWidth: 2,
              };
            }

            // Clamp polygons and polylines to ground
            if (entity.polygon) {
              entity.polygon.heightReference =
                Cesium.HeightReference.CLAMP_TO_GROUND;
            }
            if (entity.polyline) {
              entity.polyline.clampToGround = true;
            }
          });

          // Set name and visibility
          ds.name = layerEntry.name;
          ds.show = layerEntry.isVisible;

          // Add to viewer
          this.viewer.dataSources.add(ds);
          cesiumLayer = ds;

          console.log(
            `[DEBUG] CesiumGeoDataManager: Added GeoJSON layer: ${layerEntry.name}.`
          );

          // Auto-zoom to the GeoJSON layer
          if (shouldZoom && ds.entities.values.length > 0) {
            this.viewer.flyTo(ds, { duration: 1.5 });
          }
        } catch (geojsonError) {
          console.error(
            `[ERROR] CesiumGeoDataManager: Failed to load GeoJSON layer ${layerEntry.name}:`,
            geojsonError
          );
          return null;
        }
      } else if (
        layerEntry.type === "kml" &&
        layerEntry.srcInfo?.kmlDetails?.rawContent
      ) {
        try {
          const source = layerEntry.srcInfo.kmlDetails.rawContent;

          // Load KML DataSource
          const kmlDataSource = await Cesium.KmlDataSource.load(source, {
            camera: this.viewer.camera,
            canvas: this.viewer.canvas,
            clampToGround: true,
          });

          kmlDataSource.name = layerEntry.name;
          kmlDataSource.show = layerEntry.isVisible;
          this.viewer.dataSources.add(kmlDataSource);

          // Add markers for all placemarks with coordinates
          const markerEntities = [];
          const placemarks = layerEntry.srcInfo.kmlDetails.placemarks;

          if (placemarks?.length > 0) {
            for (const placemark of placemarks) {
              if (placemark.coordinates) {
                const { lon, lat, alt = 0 } = placemark.coordinates;
                const marker = this.viewer.entities.add({
                  name: `${layerEntry.name} - Marker`,
                  position: Cesium.Cartesian3.fromDegrees(lon, lat, alt),
                  point: {
                    pixelSize: 12,
                    color: Cesium.Color.DODGERBLUE,
                    outlineColor: Cesium.Color.WHITE,
                    outlineWidth: 2,
                    disableDepthTestDistance: Number.POSITIVE_INFINITY,
                  },
                  label: {
                    text: placemark.name || "Placemark",
                    font: "14pt Poppins, sans-serif",
                    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                    outlineWidth: 2,
                    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                    pixelOffset: new Cesium.Cartesian2(0, -15),
                    disableDepthTestDistance: Number.POSITIVE_INFINITY,
                  },
                  show: layerEntry.isVisible,
                });
                markerEntities.push(marker);
              }
            }
          }

          // Store the KML DataSource and marker(s) together
          cesiumLayer = { dataSource: kmlDataSource, markers: markerEntities };

          console.log(
            `[DEBUG] CesiumGeoDataManager: Added KML layer with ${markerEntities.length} marker(s): ${layerEntry.name}.`
          );

          // Auto-zoom to the KML layer
          if (shouldZoom && kmlDataSource.entities.values.length > 0) {
            this.viewer.flyTo(kmlDataSource, { duration: 1.5 });
          }
        } catch (error) {
          console.error(
            `[ERROR] CesiumGeoDataManager: Failed to load KML layer ${layerEntry.name}:`,
            error
          );
          return null;
        }
      } else if (
        layerEntry.type === "czml" &&
        (layerEntry.srcInfo?.czmlDetails?.czmlContent || layerEntry.url)
      ) {
        try {
          const source =
            layerEntry.srcInfo?.czmlDetails?.czmlContent || layerEntry.url;

          // Load CZML
          const ds = await Cesium.CzmlDataSource.load(source, {
            clampToGround: true, // <-- clamp entities to terrain (if possible)
          });

          // Add to viewer
          this.viewer.dataSources.add(ds);
          cesiumLayer = ds;

          // Enable animation clock
          this.viewer.clock.shouldAnimate = true;

          // Iterate over entities to adjust heightReference if needed
          ds.entities.values.forEach((entity) => {
            if (entity.position) {
              // Clamp points or models to ground
              if (entity.point)
                entity.point.heightReference =
                  Cesium.HeightReference.CLAMP_TO_GROUND;
              if (entity.billboard)
                entity.billboard.heightReference =
                  Cesium.HeightReference.CLAMP_TO_GROUND;
              if (entity.model)
                entity.model.heightReference =
                  Cesium.HeightReference.RELATIVE_TO_GROUND;
            }
          });

          // Auto-zoom
          if (shouldZoom && ds.entities.values.length > 0) {
            this.viewer.flyTo(ds, { duration: 1.5 });
          }

          console.log(
            `[DEBUG] CesiumGeoDataManager: Added CZML layer: ${layerEntry.name}.`
          );
        } catch (czmlError) {
          console.error(
            `[ERROR] CesiumGeoDataManager: Failed to load CZML layer ${layerEntry.name}:`,
            czmlError
          );
          return null;
        }
      } else if (layerEntry.type === "3dtile" && layerEntry.srcInfo.url) {
        try {
          const tileset = new Cesium.Cesium3DTileset({
            url: layerEntry.srcInfo.url,
            show: layerEntry.isVisible,
          });

          // Optional: store the name for reference
          tileset.layerName = layerEntry.name;

          // Add the tileset to the scene
          this.viewer.scene.primitives.add(tileset);
          cesiumLayer = tileset;

          console.log(
            `[DEBUG] CesiumGeoDataManager: Added 3D Tileset: ${layerEntry.name}.`
          );

          // Auto-zoom after tileset is ready
          if (shouldZoom) {
            await tileset.readyPromise; // wait until tileset is loaded
            this.viewer.flyTo(tileset, { duration: 2.0 });
          }
        } catch (tilesError) {
          console.error(
            `[ERROR] CesiumGeoDataManager: Failed to load 3D Tileset ${layerEntry.name}:`,
            tilesError
          );
          return null;
        }
      } else if (["gltf", "glb", "3dmodel"].includes(layerEntry.type)) {
        console.log(
          `[DEBUG] CesiumGeoDataManager: Attempting to add 3D Model: ${layerEntry.name}`
        );

        // Determine model URI (Blob or URL)
        if (
          layerEntry.srcInfo?.fileContent instanceof Blob ||
          layerEntry.srcInfo?.fileContent instanceof ArrayBuffer
        ) {
          const blob = new Blob([layerEntry.srcInfo.fileContent], {
            type:
              layerEntry.type === "gltf"
                ? "model/gltf+json"
                : "model/gltf-binary",
          });
          modelUri = URL.createObjectURL(blob);
          console.log(
            `[DEBUG] CesiumGeoDataManager: Created Blob URL for 3D model: ${modelUri}`
          );
        } else if (layerEntry.url) {
          modelUri = layerEntry.url;
          console.log(
            `[DEBUG] CesiumGeoDataManager: Using direct URL for 3D model: ${modelUri}`
          );
        } else {
          console.error(
            `[ERROR] CesiumGeoDataManager: Missing URL or file content for 3D model ${layerEntry.name}.`
          );
          return null;
        }

        const longitude = layerEntry.srcInfo?.longitude;
        const latitude = layerEntry.srcInfo?.latitude;
        const elevation = layerEntry.srcInfo?.elevation || 0;

        if (typeof longitude !== "number" || typeof latitude !== "number") {
          console.error(
            `[ERROR] CesiumGeoDataManager: Longitude and latitude are required for 3D model ${layerEntry.name}.`
          );
          if (modelUri?.startsWith("blob:")) URL.revokeObjectURL(modelUri);
          return null;
        }

        console.log(
          `[DEBUG] CesiumGeoDataManager: Model coordinates provided: Lon ${longitude}, Lat ${latitude}, El ${elevation}`
        );

        // Sample terrain for accurate placement
        let terrainElevation = elevation;
        try {
          const terrainProvider = this.viewer?.terrainProvider;
          if (
            terrainProvider &&
            terrainProvider.ready &&
            Cesium.sampleTerrainMostDetailed
          ) {
            const cartographicPos = [
              Cesium.Cartographic.fromDegrees(longitude, latitude),
            ];
            const updatedPos = await Cesium.sampleTerrainMostDetailed(
              terrainProvider,
              cartographicPos
            );
            if (updatedPos?.[0]?.height !== undefined) {
              terrainElevation = updatedPos[0].height + elevation; // apply user offset
              console.log(
                `[DEBUG] CesiumGeoDataManager: Terrain elevation sampled: ${terrainElevation.toFixed(
                  2
                )}m`
              );
            } else {
              console.warn(
                `[WARN] CesiumGeoDataManager: Terrain sampling returned no height. Using provided elevation.`
              );
            }
          } else {
            console.warn(
              `[WARN] CesiumGeoDataManager: Terrain provider not ready. Using provided/default elevation.`
            );
          }
        } catch (terrainError) {
          console.error(
            `[ERROR] CesiumGeoDataManager: Error sampling terrain for ${layerEntry.name}:`,
            terrainError
          );
        }

        // Create Cartesian3 position and orientation
        const position = Cesium.Cartesian3.fromDegrees(
          longitude,
          latitude,
          terrainElevation
        );
        const heading = layerEntry.srcInfo?.orientation?.heading || 0;
        const pitch = layerEntry.srcInfo?.orientation?.pitch || 0;
        const roll = layerEntry.srcInfo?.orientation?.roll || 0;
        const orientation = Cesium.Transforms.headingPitchRollQuaternion(
          position,
          new Cesium.HeadingPitchRoll(
            Cesium.Math.toRadians(heading),
            Cesium.Math.toRadians(pitch),
            Cesium.Math.toRadians(roll)
          )
        );

        try {
          const modelScale = layerEntry.srcInfo?.scale || 1.0;
          const modelMaxScale = layerEntry.srcInfo?.maximumScale || 20000;
          const distanceDisplayConditionNear =
            layerEntry.srcInfo?.distanceDisplayConditionNear || 10;
          const distanceDisplayConditionFar =
            layerEntry.srcInfo?.distanceDisplayConditionFar || 100000;

          // After creating the model entity:
          const modelEntity = this.viewer.entities.add({
            name: layerEntry.name,
            position,
            orientation,
            model: {
              uri: modelUri,
              show: layerEntry.isVisible,
              scale: modelScale,
              maximumScale: modelMaxScale,
              heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
            },
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(
              distanceDisplayConditionNear,
              distanceDisplayConditionFar
            ),
            id: layerEntry.id,
          });

          cesiumLayer = modelEntity;
          if (modelUri?.startsWith("blob:")) modelEntity._blobUrl = modelUri;

          // --- NEW: Add a marker at the model's position ---
          const modelMarker = this.viewer.entities.add({
            name: `${layerEntry.name} - Marker`,
            position,
            point: {
              pixelSize: 10,
              color: Cesium.Color.DODGERBLUE,
              outlineColor: Cesium.Color.WHITE,
              outlineWidth: 2,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
            label: {
              text: layerEntry.name,
              font: "12pt Poppins, sans-serif",
              fillColor: Cesium.Color.WHITE,
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 2,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              pixelOffset: new Cesium.Cartesian2(0, -15),
            },
            show: layerEntry.isVisible,
          });

          // Store the marker along with the entity
          cesiumLayer._marker = modelMarker;

          console.log(
            `[SUCCESS] CesiumGeoDataManager: Added 3D Model: ${
              layerEntry.name
            }, placed at elevation ${terrainElevation.toFixed(
              2
            )}m, scale ${modelScale}.`
          );
        } catch (modelError) {
          console.error(
            `[ERROR] CesiumGeoDataManager: Failed to add 3D model entity ${layerEntry.name}:`,
            modelError
          );
          if (modelUri?.startsWith("blob:")) URL.revokeObjectURL(modelUri);
          return null;
        }
      } else if (
        layerEntry.type === "wms" &&
        layerEntry.baseUrl &&
        layerEntry.args
      ) {
        const wmsParameters = {
          service: "WMS",
          version: layerEntry.args.version || "1.1.1",
          request: "GetMap",
          format: layerEntry.args.format || "image/png",
          transparent:
            layerEntry.args.transparent !== undefined
              ? layerEntry.args.transparent
              : true,
          layers: layerEntry.args.layers || layerEntry.name,
          srs: layerEntry.args.srs || "EPSG:4326",
          tiled:
            layerEntry.args.tiled !== undefined ? layerEntry.args.tiled : true,
          width: 256,
          height: 256,
          ...layerEntry.args,
        };

        const imageryProvider = new Cesium.WebMapServiceImageryProvider({
          url: layerEntry.baseUrl,
          layers: wmsParameters.layers,
          parameters: wmsParameters,
          credit: new Cesium.Credit(layerEntry.name),
        });

        cesiumLayer = this.viewer.imageryLayers.addImageryProvider(
          imageryProvider,
          imageryIndex
        );
        cesiumLayer.id = layerEntry.id;
        cesiumLayer.name = layerEntry.name;
        cesiumLayer.show = layerEntry.isVisible;

        console.log(
          `[DEBUG] CesiumGeoDataManager: Added WMS layer: ${layerEntry.name} at index ${imageryIndex}. Visible: ${cesiumLayer.show}`
        );
      } else if (
        layerEntry.type === "wmts" &&
        layerEntry.baseUrl &&
        layerEntry.args
      ) {
        const wmtsParameters = {
          service: "WMTS",
          version: layerEntry.args.version || "1.0.0",
          request: "GetTile",
          format: layerEntry.args.format || "image/jpeg",
          layer: layerEntry.args.layer || layerEntry.name,
          style: layerEntry.args.style || "",
          tileMatrixSetID: layerEntry.args.tileMatrixSetID || "EPSG:4326",
          tileMatrixLabels: layerEntry.args.tileMatrixLabels,
          dimensions: layerEntry.args.dimensions,
          tilingScheme: layerEntry.args.tilingScheme,
          credit: new Cesium.Credit(layerEntry.name),
          minimumLevel: layerEntry.args.minimumLevel || 0,
          maximumLevel: layerEntry.args.maximumLevel,
          ...layerEntry.args,
        };

        const imageryProvider = new Cesium.WebMapTileServiceImageryProvider({
          url: layerEntry.baseUrl,
          layer: wmtsParameters.layer,
          style: wmtsParameters.style,
          format: wmtsParameters.format,
          tileMatrixSetID: wmtsParameters.tileMatrixSetID,
          tileMatrixLabels: wmtsParameters.tileMatrixLabels,
          tilingScheme: wmtsParameters.tilingScheme,
          minimumLevel: wmtsParameters.minimumLevel,
          maximumLevel: wmtsParameters.maximumLevel,
          credit: wmtsParameters.credit,
          dimensions: wmtsParameters.dimensions,
        });

        cesiumLayer = this.viewer.imageryLayers.addImageryProvider(
          imageryProvider,
          imageryIndex
        );
        cesiumLayer.id = layerEntry.id;
        cesiumLayer.name = layerEntry.name;
        cesiumLayer.show = layerEntry.isVisible;

        console.log(
          `[DEBUG] CesiumGeoDataManager: Added WMTS layer: ${layerEntry.name} at index ${imageryIndex}. Visible: ${cesiumLayer.show}`
        );
      } else {
        console.warn(
          `[WARN] CesiumGeoDataManager: Unsupported layer type or missing data for ${layerEntry.name} (Type: ${layerEntry.type}).`
        );
        return null;
      }

      if (cesiumLayer) {
        this.cesiumLayersMap.set(layerEntry.id, cesiumLayer);
        return cesiumLayer;
      } else {
        console.warn(
          `[WARN] CesiumGeoDataManager: addLayer finished without creating a cesiumLayer for ${layerEntry.name}.`
        );
        return null;
      }
    } catch (error) {
      console.error(
        `[CRITICAL ERROR] CesiumGeoDataManager: Uncaught error while adding layer ${layerEntry.name}:`,
        error
      );
      if (modelUri && modelUri.startsWith("blob:")) {
        URL.revokeObjectURL(modelUri);
      }
      return null;
    }
  }

  // --- Layer Management ---
  /**
   * Removes a geospatial layer from the Cesium globe based on its type.
   * @param {string} layerId - The ID of the layer to remove.
   */
  removeLayer(layerId) {
    const cesiumLayer = this.cesiumLayersMap.get(layerId);
    if (cesiumLayer) {
      // --- FIX --- Corrected the logic chain to handle the KML object first.
      if (
        cesiumLayer.dataSource &&
        cesiumLayer.dataSource instanceof Cesium.KmlDataSource
      ) {
        this.viewer.dataSources.remove(cesiumLayer.dataSource, true);
        if (cesiumLayer.marker) {
          this.viewer.entities.remove(cesiumLayer.marker);
        }
        console.log(
          `[DEBUG] CesiumGeoDataManager: Removed KML composite layer with ID: ${layerId}`
        );
      } else if (cesiumLayer instanceof Cesium.DataSource) {
        this.viewer.dataSources.remove(cesiumLayer, true);
        console.log(
          `[DEBUG] CesiumGeoDataManager: Removed DataSource with ID: ${layerId}`
        );
      } else if (cesiumLayer instanceof Cesium.Cesium3DTileset) {
        this.viewer.scene.primitives.remove(cesiumLayer);
        console.log(
          `[DEBUG] CesiumGeoDataManager: Removed 3D Tileset with ID: ${layerId}`
        );
      } else if (cesiumLayer instanceof Cesium.Entity && cesiumLayer.model) {
        // If it's a model loaded from a Blob URL, revoke the URL
        if (
          cesiumLayer._blobUrl &&
          typeof cesiumLayer._blobUrl === "string" &&
          cesiumLayer._blobUrl.startsWith("blob:")
        ) {
          URL.revokeObjectURL(cesiumLayer._blobUrl);
          console.log(
            `[DEBUG] CesiumGeoDataManager: Revoked Blob URL: ${cesiumLayer._blobUrl}`
          );
        }
        this.viewer.entities.remove(cesiumLayer);
        console.log(
          `[DEBUG] CesiumGeoDataManager: Removed 3D Model (Entity) with ID: ${layerId}`
        );
      } else {
        console.warn(
          `[WARN] CesiumGeoDataManager: Could not remove layer type for ID ${layerId}. Not an ImageryLayer, DataSource, Cesium3DTileset, or 3D Model Entity.`
        );
      }
      this.cesiumLayersMap.delete(layerId);
    } else {
      console.warn(
        `[WARN] CesiumGeoDataManager: Layer with ID ${layerId} not found on globe to remove.`
      );
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
      // Check if it's our special KML object
      if (cesiumLayer.dataSource instanceof Cesium.KmlDataSource) {
        cesiumLayer.dataSource.show = isVisible;
        if (cesiumLayer.marker) {
          cesiumLayer.marker.show = isVisible;
        }
      }
      // Your existing visibility logic for other types
      else if (cesiumLayer instanceof Cesium.Entity && cesiumLayer.model) {
        cesiumLayer.model.show = isVisible;
      } else {
        cesiumLayer.show = isVisible;
      }
      console.log(
        `[DEBUG] CesiumGeoDataManager: Toggled visibility for layer ${layerId} to ${isVisible}`
      );
    }
  }

  /**
   * Clears all custom (non-base) layers and then re-adds/updates layers
   * based on the provided ordered list.
   * @param {Array<Object>} layersToReconcile - An ordered array of full layer entry objects.
   */
  async reconcileLayers(layersToReconcile) {
    if (!this.viewer) {
      console.warn(
        "[WARN] CesiumGeoDataManager: Viewer not initialized, cannot reconcile layers."
      );
      return;
    }

    console.log(
      "[DEBUG] CesiumGeoDataManager: Starting layer reconciliation..."
    );
    console.log(
      "[DEBUG] Desired UI order (Top to Bottom):",
      layersToReconcile.map((l) => l.name)
    );

    // Clear all existing data sources
    this.viewer.dataSources.removeAll();

    // Clear all 3D Tilesets
    for (let i = this.viewer.scene.primitives.length - 1; i >= 0; i--) {
      const primitive = this.viewer.scene.primitives.get(i);
      if (primitive instanceof Cesium.Cesium3DTileset) {
        this.viewer.scene.primitives.remove(primitive);
      }
    }

    // Clear all entities (including 3D models and temporary markers)
    // Iterate over a copy of the values array to avoid issues with modifying
    // the collection while iterating.
    const entitiesToRemove = [...this.viewer.entities.values].filter(
      (entity) => entity.model || entity === this.currentLocationMarkerEntity
    );
    for (const entity of entitiesToRemove) {
      if (
        entity._blobUrl &&
        typeof entity._blobUrl === "string" &&
        entity._blobUrl.startsWith("blob:")
      ) {
        URL.revokeObjectURL(entity._blobUrl);
        console.log(
          `[DEBUG] CesiumGeoDataManager: Revoked Blob URL during reconciliation: ${entity._blobUrl}`
        );
      }
      this.viewer.entities.remove(entity);
    }
    this.currentLocationMarkerEntity = null; // Clear the reference after potential removal

    // Clear all imagery layers (except the base layer, if you have one managed separately)
    for (let i = this.viewer.imageryLayers.length - 1; i >= 0; i--) {
      const layer = this.viewer.imageryLayers.get(i);
      // You might want to add a condition here to skip removing your default base layer
      // if (layer.name === 'MyBaseLayerName') continue;
      this.viewer.imageryLayers.remove(layer, true);
    }
    this.cesiumLayersMap.clear(); // Clear your internal map
    console.log(
      "[DEBUG] CesiumGeoDataManager: Cleared all existing dynamic globe layers, data sources, primitives, and entities."
    );

    // Re-add layers in the desired order
    const imageryLayersReversed = layersToReconcile
      .filter((l) => ["wms", "wmts"].includes(l.type))
      .reverse();
    const dataLayers = layersToReconcile.filter((l) =>
      ["geojson", "kml", "czml", "gltf", "glb", "3dmodel", "3dtiles"].includes(
        l.type
      )
    );

    // Add imagery layers first (reversed order for correct display)
    for (let i = 0; i < imageryLayersReversed.length; i++) {
      const layerEntry = imageryLayersReversed[i];
      console.log(
        `[DEBUG] CesiumGeoDataManager: Adding ${layerEntry.type.toUpperCase()} layer ${
          layerEntry.name
        } (UI order: ${layersToReconcile.indexOf(
          layerEntry
        )}, Cesium index: ${i})`
      );
      await this.addLayer(layerEntry, i);
    }

    // Add data layers after imagery layers
    for (const layerEntry of dataLayers) {
      console.log(
        `[DEBUG] CesiumGeoDataManager: Adding ${layerEntry.type.toUpperCase()} layer ${
          layerEntry.name
        }`
      );
      await this.addLayer(layerEntry);
    }

    console.log("[DEBUG] CesiumGeoDataManager: Layer reconciliation complete.");
  }

  /**
   * Zooms the globe to the extent of a specific layer.
   * @param {object} layerEntry - The full layer entry object (from LayerService).
   */
  async zoomToLayer(layerEntry) {
    if (!this.viewer) {
      console.warn(
        "[WARN] CesiumGeoDataManager: Viewer not initialized, cannot zoom to layer."
      );
      return;
    }

    const cesiumLayer = this.cesiumLayersMap.get(layerEntry.id);

    if (!cesiumLayer) {
      console.warn(
        `[WARN] CesiumGeoDataManager: Layer ${layerEntry.id} not found or not yet available for zoom.`
      );
      return;
    }
    const target = cesiumLayer.dataSource || cesiumLayer;

    if (cesiumLayer instanceof Cesium.ImageryLayer) {
      if (layerEntry.bbox) {
        const rect = Cesium.Rectangle.fromDegrees(
          layerEntry.bbox[0],
          layerEntry.bbox[1],
          layerEntry.bbox[2],
          layerEntry.bbox[3]
        );
        this.viewer.camera.flyToRectangle(rect, { duration: 1.5 });
        console.log(
          `[DEBUG] CesiumGeoDataManager: Zoomed to ImageryLayer extent: ${layerEntry.name}`
        );
      } else if (layerEntry.id === "vedas-satellite-imagery") {
        this.viewer.camera.flyTo({
          destination: INDIA_BBOX,
          duration: 2.0,
        });
        console.log(
          `[DEBUG] CesiumGeoDataManager: Zoomed to general extent for Vedas Satellite Imagery.`
        );
      } else {
        console.warn(
          `[WARN] CesiumGeoDataManager: Cannot precisely zoom to ImageryLayer ${layerEntry.name}. No extent information.`
        );
        this.viewer.camera.flyHome();
      }
    } else if (target instanceof Cesium.DataSource) {
      if (target.entities.values.length > 0) {
        this.viewer.flyTo([target], { duration: 1.5 });
        console.log(
          `[DEBUG] CesiumGeoDataManager: Zoomed to GeoJSON/KML/CZML layer: ${layerEntry.name}`
        );
      } else {
        this.viewer.camera.flyHome();
      }
    } else if (target instanceof Cesium.Cesium3DTileset) {
      this.viewer.flyTo([target], { duration: 1.5 });
      console.log(
        `[DEBUG] CesiumGeoDataManager: Zoomed to 3D Tileset: ${layerEntry.name}`
      );
    } else if (target instanceof Cesium.Entity && target.model) {
      this.viewer.flyTo([target], { duration: 1.5 });
      console.log(
        `[DEBUG] CesiumGeoDataManager: Zoomed to 3D Model: ${layerEntry.name}`
      );
    } else {
      this.viewer.camera.flyHome();
    }
  }

  // --- Graphic Management Methods ---

  /**
   * Renders a graphic (point or polygon) on the globe.
   * @param {object} graphic - The graphic object with identifier, geometry (array of {longitude, latitude, elevation}).
   */
  renderGraphic(graphic) {
    if (
      !this.viewer ||
      !graphic ||
      !graphic.geometry ||
      graphic.geometry.length === 0
    ) {
      console.warn(
        "[WARN] CesiumGeoDataManager: Invalid graphic data provided for rendering."
      );
      return;
    }

    const points = graphic.geometry.map((coord) =>
      Cesium.Cartesian3.fromDegrees(
        coord.longitude,
        coord.latitude,
        coord.elevation || 0
      )
    );

    if (graphic.geometry.length === 1) {
      this.viewer.entities.add({
        position: points[0],
        point: {
          pixelSize: 10,
          color: Cesium.Color.RED,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
        },
        id: graphic.identifier,
      });
      console.log(
        `[DEBUG] CesiumGeoDataManager: Rendered point graphic with ID: ${graphic.identifier}`
      );
    } else if (graphic.geometry.length > 1) {
      this.viewer.entities.add({
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(points),
          material: Cesium.Color.BLUE.withAlpha(0.5),
          outline: true,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
        },
        id: graphic.identifier,
      });
      console.log(
        `[DEBUG] CesiumGeoDataManager: Rendered polygon graphic with ID: ${graphic.identifier}`
      );
    } else {
      console.warn(
        `[WARN] CesiumGeoDataManager: Graphic with ID ${graphic.identifier} has unsupported geometry length.`
      );
    }
  }

  /**
   * Removes a graphic from the globe.
   * @param {string} graphicIdentifier - The identifier of the graphic to remove.
   */
  removeGraphic(graphicIdentifier) {
    if (this.viewer) {
      const entity = this.viewer.entities.getById(graphicIdentifier);
      if (entity) {
        this.viewer.entities.remove(entity);
        console.log(
          `[DEBUG] CesiumGeoDataManager: Removed graphic with ID: ${graphicIdentifier}`
        );
      } else {
        console.warn(
          `[WARN] CesiumGeoDataManager: Graphic with ID ${graphicIdentifier} not found for removal.`
        );
      }
    }
  }

  /**
   * Displays a temporary location marker with a label.
   * @param {object} location - The location object with name, identifier, and getCoordinates() method.
   */
  displayLocationMarker(location) {
    if (
      !this.viewer ||
      !location ||
      typeof location.getCoordinates !== "function"
    ) {
      console.warn(
        "[WARN] CesiumGeoDataManager: Invalid location data provided for marker display."
      );
      return;
    }

    if (this.currentLocationMarkerEntity) {
      this.viewer.entities.remove(this.currentLocationMarkerEntity);
      this.currentLocationMarkerEntity = null;
      console.log(
        "[DEBUG] CesiumGeoDataManager: Removed existing location marker."
      );
    }

    const coords = location.getCoordinates();
    if (coords) {
      const newMarkerEntity = this.viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(
          coords.longitude,
          coords.latitude,
          coords.elevation || 0
        ),
        point: {
          pixelSize: 10,
          color: Cesium.Color.RED,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
        },
        label: {
          text: location.name,
          font: "14pt Poppins, sans-serif",
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -20),
        },
        id: `location-label-${location.identifier}`,
      });
      this.currentLocationMarkerEntity = newMarkerEntity;
      this.viewer.flyTo([newMarkerEntity], { duration: 1.0 });
      console.log(
        `[DEBUG] CesiumGeoDataManager: Displayed location marker for: ${location.name}`
      );
    } else {
      console.warn(
        `[WARN] CesiumGeoDataManager: Location ${location.name} has no coordinates to display a marker.`
      );
    }
  }
}

export default CesiumGeoDataManager;
