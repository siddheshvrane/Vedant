<template>
  <div id="mapWrapper">
    <!-- The div where Cesium will attach its canvas -->
    <div id="globeContainer"></div>
  </div>
</template>

<script>
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { MapService } from '../services/controller.js'; // Ensure this path is correct

// Cesium Ion access token is required for using Cesium's default assets (e.g., imagery, terrain).
Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJjNmUzZWU3Ni1kYzM3LTQyNzYtOTk0MS03YWVkMTZlNTU0MDMiLCJpZCI6MzEwMzcwLCJpYXQiOjE3NDk0NjMxNzl9.K7YHyi1fwwi5ICQKn4C82gUnv60u9nVs783T_UpHxG0';

export default {
  name: 'Globe',
  // No longer directly imports or uses other Vue components
  props: {
    // No props needed from App.vue for its core functionality now
  },
  data() {
    return {
      viewer: null, // Holds the Cesium Viewer instance.
      // Internal state for Globe, not directly exposed to other components' rendering logic.
      zoomLevel: 0.0,
      centerCoordinates: [0.0, 0.0],
      orientation: 0.0,
      currentLocationMarkerEntity: null,
      
      // Subscriptions for cleanup
      mapViewSubscription: null,
      compassRedirectSubscription: null,
      graphicRenderSubscription: null,
      graphicRemovalSubscription: null,
      zoomToCoordinatesSubscription: null,
      displayLocationMarkerSubscription: null,
      initGlobeSubscription: null, // New subscription to trigger init
    };
  },
  /**
   * @Lifecycle Hook: mounted
   * Subscribes to MapService observables for inter-component communication.
   * Crucially, it subscribes to `MapService.initGlobe$` to know when to initialize itself.
   */
  mounted() {
    // Subscribe to MapService for various commands
    this.mapViewSubscription = MapService.updateView$.subscribe(this.updateView);
    this.compassRedirectSubscription = MapService.orientToNorth$.subscribe(this.orientToNorth);
    this.graphicRenderSubscription = MapService.renderGraphic$.subscribe(this.renderGraphic);
    this.graphicRemovalSubscription = MapService.removeGraphic$.subscribe(this.removeGraphic);
    this.zoomToCoordinatesSubscription = MapService.zoomToCoordinates$.subscribe(this.zoomToCoordinates);
    this.displayLocationMarkerSubscription = MapService.displayLocationMarker$.subscribe(this.displayLocationMarker);
    
    // NEW: Subscribe to the initGlobe$ observable from MapService
    // This tells Globe.vue WHEN to create the Cesium viewer.
    this.initGlobeSubscription = MapService.initGlobe$.subscribe(() => {
      this.$nextTick(() => { // Ensure DOM element is ready
        try {
          this.initGlobe();
          MapService.notifyGlobeInitialized(true); // Notify that globe is ready
          MapService.setGlobeViewer(this.viewer); // Pass the viewer instance to the service
        } catch (error) {
          console.error('Error initializing Globe:', error);
          MapService.notifyGlobeInitialized(false); // Notify failure
          MapService.setGlobeViewer(null); // Indicate no viewer available
        }
      });
    });
  },
  /**
   * @Lifecycle Hook: beforeUnmount
   * Cleans up Cesium viewer and unsubscribes from RxJS observables to prevent memory leaks.
   */
  beforeUnmount() {
    if (this.viewer) {
      this.viewer.destroy();
      this.viewer = null;
    }
    // Unsubscribe from all RxJS observables.
    if (this.mapViewSubscription) this.mapViewSubscription.unsubscribe();
    if (this.compassRedirectSubscription) this.compassRedirectSubscription.unsubscribe();
    if (this.graphicRenderSubscription) this.graphicRenderSubscription.unsubscribe();
    if (this.graphicRemovalSubscription) this.graphicRemovalSubscription.unsubscribe();
    if (this.zoomToCoordinatesSubscription) this.zoomToCoordinatesSubscription.unsubscribe();
    if (this.displayLocationMarkerSubscription) this.displayLocationMarkerSubscription.unsubscribe();
    if (this.initGlobeSubscription) this.initGlobeSubscription.unsubscribe(); // NEW: Unsubscribe init trigger

    // Remove the current location marker if it exists.
    if (this.currentLocationMarkerEntity) {
        this.viewer.entities.remove(this.currentLocationMarkerEntity);
        this.currentLocationMarkerEntity = null;
    }
  },
  methods: {
    /**
     * @method initGlobe
     * Initializes the Cesium Viewer with specific options (e.g., UI elements disabled).
     * Configures a custom terrain provider and adds an imagery layer.
     * Sets an initial camera position over India and attaches a camera change listener.
     */
    initGlobe() {
      this.viewer = new Cesium.Viewer('globeContainer', {
        animation: false,
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        infoBox: false,
        sceneModePicker: false,
        selectionIndicator: false,
        timeline: false,
        navigationHelpButton: false,
        navigationInstructionsInitiallyVisible: false,
        creditContainer: document.createElement('div'), // Hides the Cesium credit badge
        fullscreenButton: false,
        imageryProvider: false, // Explicitly false to add our own below
        sceneMode: Cesium.SceneMode.SCENE3D,
        terrainExaggeration: 1.0,
        terrain: new Cesium.Terrain(Cesium.CesiumTerrainProvider.fromUrl('https://vedas.sac.gov.in/elevation/cdem_10m_2016/'))
      });

      this._addImageryLayer();
      this.viewer.scene.globe.depthTestAgainstTerrain = false;

      // Set default camera position to India.
      this.viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(78.9629, 20.5937, 20000000), // Long, Lat, Height
        orientation: {
          heading: Cesium.Math.toRadians(0.0),    // Look North
          pitch: Cesium.Math.toRadians(-90.0),    // Look straight down
          roll: Cesium.Math.toRadians(0.0)        // No roll
        },
        duration: 0 // Immediate positioning
      });

      this.updateGlobeViewProperties();

      // Attach listener to camera changes to update UI components.
      this.viewer.camera.changed.addEventListener(this.onCameraChanged);
    },

    /**
     * @method _addImageryLayer
     * Adds a Web Map Service (WMS) imagery provider to the globe.
     */
    _addImageryLayer() {
      this.viewer.imageryLayers.addImageryProvider(new Cesium.WebMapServiceImageryProvider({
        url: 'https://bhuvan-ras1.nrsc.gov.in/tilecache/tilecache.py',
        layers: 'bhuvan_img',
        parameters: {
          service: 'WMS',
          version: '1.1.1',
          TILED: true,
          request: 'GetMap',
          format: 'image/jpeg',
          transparent: true,
          width: 256,
          height: 256
        },
        srs: 'EPSG:4326'
      }));
    },

    /**
     * @method updateGlobeViewProperties
     * Updates the component's data properties (zoomLevel, centerCoordinates, orientation)
     * based on the current Cesium camera position and orientation.
     */
    updateGlobeViewProperties() {
      if (this.viewer) {
        const cameraPosition = this.viewer.camera.positionCartographic;
        this.zoomLevel = cameraPosition.height;
        this.centerCoordinates = [Cesium.Math.toDegrees(cameraPosition.longitude), Cesium.Math.toDegrees(cameraPosition.latitude)];
        this.orientation = Cesium.Math.toDegrees(this.viewer.camera.heading);
      }
    },

    /**
     * @method onCameraChanged
     * Callback for Cesium camera changes. Updates view properties and emits scene info via MapService.
     */
    onCameraChanged() {
        this.updateGlobeViewProperties();
        MapService.updateView(this.getSceneInformation());
    },

    /**
     * @method getSceneInformation
     * Gathers and returns an object with current camera/scene details.
     */
    getSceneInformation() {
      if (!this.viewer) return {};
      const cameraPosition = this.viewer.camera.positionCartographic;
      return {
        currentCoordinates: {
          latitude: Cesium.Math.toDegrees(cameraPosition.latitude),
          longitude: Cesium.Math.toDegrees(cameraPosition.longitude),
          elevation: cameraPosition.height
        },
        terrainType: 'cdem_10m_2016',
        satelliteImageryType: 'Bhuvan WMS',
        angle: Cesium.Math.toDegrees(this.viewer.camera.heading)
      };
    },

    // These methods are called via MapService subscriptions, keeping Globe decoupled
    rotateView() {
      console.log('Globe: rotateView method called');
    },
    zoomIn() {
      if (this.viewer) {
        this.viewer.camera.zoomIn(this.viewer.camera.positionCartographic.height * 0.5);
      }
    },
    zoomOut() {
      if (this.viewer) {
        this.viewer.camera.zoomOut(this.viewer.camera.positionCartographic.height);
      }
    },
    panView() {
      console.log('Globe: panView method called');
    },
    updateView(updateData) {
      console.log('Globe: updateView method called with data:', updateData);
    },
    /**
     * @method renderGraphic
     * Renders a point or polygon graphic on the globe based on provided geometry.
     * @param {Object} graphic - Contains `identifier` and `geometry` (array of coordinates).
     */
    renderGraphic(graphic) {
      console.log('Globe: renderGraphic method called with graphic:', graphic);
      if (this.viewer && graphic && graphic.geometry && graphic.geometry.length > 0) {
        const points = graphic.geometry.map(coord =>
          Cesium.Cartesian3.fromDegrees(coord.longitude, coord.latitude, coord.elevation || 0)
        );

        if (graphic.geometry.length === 1) {
            this.viewer.entities.add({
              position: points[0],
              point: {
                  pixelSize: 10,
                  color: Cesium.Color.RED,
                  outlineColor: Cesium.Color.WHITE,
                  outlineWidth: 2
              },
              id: graphic.identifier
            });
        } else if (graphic.geometry.length > 1) {
            this.viewer.entities.add({
              polygon: {
                  hierarchy: new Cesium.PolygonHierarchy(points),
                  material: Cesium.Color.BLUE.withAlpha(0.5),
                  outline: true,
                  outlineColor: Cesium.Color.BLACK,
                  outlineWidth: 2,
              },
              id: graphic.identifier
            });
        }
      }
    },
    /**
     * @method removeGraphic
     * Removes a graphic from the globe using its unique identifier.
     * @param {string} graphicIdentifier - ID of the graphic to remove.
     */
    removeGraphic(graphicIdentifier) {
      console.log('Globe: removeGraphic method called for identifier:', graphicIdentifier);
      if (this.viewer) {
        const entity = this.viewer.entities.getById(graphicIdentifier);
        if (entity) {
          this.viewer.entities.remove(entity);
        }
      }
    },
    /**
     * @method zoomToCoordinates
     * Flies the camera to a specified longitude, latitude, and elevation.
     * Uses a default elevation if the provided one is too low.
     * @param {Object} coordinates - Contains `longitude`, `latitude`, and optional `elevation`.
     */
    zoomToCoordinates(coordinates) {
      console.log('Globe: zoomToCoordinates method called with coordinates:', coordinates);
      if (this.viewer && coordinates) {
        const targetElevation = coordinates.elevation && coordinates.elevation > 1000 ? coordinates.elevation : 25000;

        this.viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(coordinates.longitude, coordinates.latitude, targetElevation),
          duration: 2
        });
      }
    },
    /**
     * @method displayLocationMarker
     * Displays a named label marker at a given location.
     * Removes any existing `currentLocationMarkerEntity` before adding a new one.
     * @param {Object} location - Object with `name` and `getCoordinates()` method.
     */
    displayLocationMarker(location) {
      console.log('Globe: displayLocationMarker method called for location:', location);
      if (this.viewer && location && location.getCoordinates) {
        // Remove existing marker before adding a new one.
        if (this.currentLocationMarkerEntity) {
            this.viewer.entities.remove(this.currentLocationMarkerEntity);
            this.currentLocationMarkerEntity = null;
        }

        const coords = location.getCoordinates();
        if (coords) {
            const newMarkerEntity = this.viewer.entities.add({
                position: Cesium.Cartesian3.fromDegrees(coords.longitude, coords.latitude, coords.elevation || 0),
                label: {
                    text: location.name,
                    font: '14pt Poppins, sans-serif',
                    fillColor: Cesium.Color.WHITE,
                    outlineColor: Cesium.Color.BLACK,
                    outlineWidth: 2,
                    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                    pixelOffset: new Cesium.Cartesian2(0, -20)
                },
                id: `location-label-${location.identifier}`
            });
            // Store reference to the new marker.
            this.currentLocationMarkerEntity = newMarkerEntity;
        }
      }
    },
    /**
     * @method orientToNorth
     * Orients the camera's heading to North (0 degrees) while preserving current pitch and roll.
     */
    orientToNorth() {
      console.log('Globe: orientToNorth method called (maintaining current pitch and roll)');
      if (this.viewer) {
        const currentCameraPosition = this.viewer.camera.positionCartographic;
        const longitude = Cesium.Math.toDegrees(currentCameraPosition.longitude);
        const latitude = Cesium.Math.toDegrees(currentCameraPosition.latitude);
        const height = currentCameraPosition.height;

        const currentPitch = this.viewer.camera.pitch;
        const currentRoll = this.viewer.camera.roll;

        this.viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, height),
          orientation: {
            heading: Cesium.Math.toRadians(0.0), // Set heading to North
            pitch: currentPitch, // Preserve current pitch
            roll: currentRoll // Preserve current roll
          },
          duration: 1.5
        });
      }
    }
  }
};
</script>

<style scoped>
/* Only globe-specific styles remain here */
#mapWrapper {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  position: relative;
}
#globeContainer {
  width: 100%;
  height: 100%;
}

/* ProjectLogo overlay styles removed from here,
   as ProjectLogo itself or its parent should manage its positioning/visibility.
   If ProjectLogo is still an overlay, its CSS should be in ProjectLogo.vue or a global style. */
</style>