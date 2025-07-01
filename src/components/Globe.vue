<template>
  <div id="mapWrapper">
    <ProjectLogo @loading-complete="handleGlobeReady" />

    <div v-show="isGlobeReady" id="globeContainer"></div>

    <Compass :viewer="viewer" :is-visible="isGlobeReady" />
    <SearchPanel v-if="isGlobeReady" />

  </div>
</template>

<script>
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { MapService } from '../services.js';
import Compass from './Compass.vue';
import SearchPanel from './SearchPanel.vue';
import ProjectLogo from './ProjectLogo.vue'; // NEW: Import ProjectLogo

Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJjNmUzZWU3Ni1kYzM3LTQyNzYtOTk0MS03YWVkMTZlNTU0MDMiLCJpZCI6MzEwMzcwLCJpYXQiOjE3NDk0NjMxNzl9.K7YHyi1fwwi5ICQKn4C82gUnv60u9nVs783T_UpHxG0';

export default {
  name: 'Globe',
  components: {
    Compass,
    SearchPanel,
    ProjectLogo, // NEW: Register ProjectLogo
  },
  props: {
    // We can pass initial properties if needed, but for now, Globe manages its own Cesium instance
  },
  data() {
    return {
      viewer: null, // This will hold the Cesium Viewer instance
      isGlobeReady: false, // NEW: Controls when Cesium globe and other components are displayed
      // REMOVED: loading, globeLogoFinalPosition, vedantLogoSrc, spaceImageSrc
      zoomLevel: 0.0,
      centerCoordinates: [0.0, 0.0],
      orientation: 0.0,
      currentLocationMarkerEntity: null, // To keep track of the last added label entity
    };
  },
  mounted() {
    // REMOVED: setTimeout logic for loading screen and logo transition. ProjectLogo handles this.

    // Subscribe to MapService events
    this.mapViewSubscription = MapService.updateView$.subscribe(this.updateView);
    this.compassRedirectSubscription = MapService.orientToNorth$.subscribe(this.orientToNorth);
    this.graphicRenderSubscription = MapService.renderGraphic$.subscribe(this.renderGraphic);
    this.graphicRemovalSubscription = MapService.removeGraphic$.subscribe(this.removeGraphic);

    // Handle zoomToCoordinates
    this.zoomToCoordinatesSubscription = MapService.zoomToCoordinates$.subscribe(this.zoomToCoordinates);
    // Handle displayLocationMarker
    this.displayLocationMarkerSubscription = MapService.displayLocationMarker$.subscribe(this.displayLocationMarker);
  },
  beforeUnmount() {
    // Clean up Cesium viewer
    if (this.viewer) {
      this.viewer.destroy();
      this.viewer = null;
    }
    // Unsubscribe from RxJS observables to prevent memory leaks
    if (this.mapViewSubscription) this.mapViewSubscription.unsubscribe();
    if (this.compassRedirectSubscription) this.compassRedirectSubscription.unsubscribe();
    if (this.graphicRenderSubscription) this.graphicRenderSubscription.unsubscribe();
    if (this.graphicRemovalSubscription) this.graphicRemovalSubscription.unsubscribe();
    if (this.zoomToCoordinatesSubscription) this.zoomToCoordinatesSubscription.unsubscribe();
    if (this.displayLocationMarkerSubscription) this.displayLocationMarkerSubscription.unsubscribe();

    // Ensure the current marker is also destroyed if component unmounts
    if (this.currentLocationMarkerEntity) {
        this.viewer.entities.remove(this.currentLocationMarkerEntity);
        this.currentLocationMarkerEntity = null;
    }
  },
  methods: {
    /**
     * @method handleGlobeReady
     * @description Called when ProjectLogo component emits 'loading-complete'.
     * Sets isGlobeReady to true and initializes the Cesium globe.
     * @returns {void}
     */
    handleGlobeReady() { // NEW method
      this.isGlobeReady = true;
      this.$nextTick(() => {
        try {
          this.initGlobe();
        } catch (error) {
          console.error('Error initializing Globe:', error);
        }
      });
    },
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
        imageryProvider: false, // Explicitly set to false to add our own
        sceneMode: Cesium.SceneMode.SCENE3D,
        terrainExaggeration: 1.0,
        terrain: new Cesium.Terrain(Cesium.CesiumTerrainProvider.fromUrl('https://vedas.sac.gov.in/elevation/cdem_10m_2016/'))
      });

      this._addImageryLayer();
      this.viewer.scene.globe.depthTestAgainstTerrain = false;

      // Set the default camera position to India as per CesiumMapManager
      this.viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(78.9629, 20.5937, 20000000), // Longitude, Latitude for India, and height
        orientation: {
          heading: Cesium.Math.toRadians(0.0),    // Look North
          pitch: Cesium.Math.toRadians(-90.0),    // Look straight down
          roll: Cesium.Math.toRadians(0.0)        // No roll
        },
        duration: 0 // Set duration to 0 for immediate positioning
      });

      this.updateGlobeViewProperties();

      // IMPORTANT: Use Cesium's camera.changed event for frequent updates
      // and then emit through MapService.updateView.
      // This ensures SceneInfo and Compass get updates.
      this.viewer.camera.changed.addEventListener(this.onCameraChanged);
    },

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

    updateGlobeViewProperties() {
      if (this.viewer) {
        const cameraPosition = this.viewer.camera.positionCartographic;
        this.zoomLevel = cameraPosition.height;
        this.centerCoordinates = [Cesium.Math.toDegrees(cameraPosition.longitude), Cesium.Math.toDegrees(cameraPosition.latitude)];
        this.orientation = Cesium.Math.toDegrees(this.viewer.camera.heading);
      }
    },

    onCameraChanged() {
        this.updateGlobeViewProperties();
        // Emit the scene information through MapService
        MapService.updateView(this.getSceneInformation());
    },

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
    removeGraphic(graphicIdentifier) {
      console.log('Globe: removeGraphic method called for identifier:', graphicIdentifier);
      if (this.viewer) {
        const entity = this.viewer.entities.getById(graphicIdentifier);
        if (entity) {
          this.viewer.entities.remove(entity);
        }
      }
    },
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
    displayLocationMarker(location) {
      console.log('Globe: displayLocationMarker method called for location:', location);
      if (this.viewer && location && location.getCoordinates) {
        // Remove the previously displayed marker if it exists
        if (this.currentLocationMarkerEntity) {
            this.viewer.entities.remove(this.currentLocationMarkerEntity);
            this.currentLocationMarkerEntity = null;
        }

        const coords = location.getCoordinates();
        if (coords) {
            // Only add the label, no separate icon/billboard for now
            const newMarkerEntity = this.viewer.entities.add({
                position: Cesium.Cartesian3.fromDegrees(coords.longitude, coords.latitude, coords.elevation || 0),
                label: {
                    text: location.name,
                    font: '14pt Poppins, sans-serif', // Consistent font styling
                    fillColor: Cesium.Color.WHITE,
                    outlineColor: Cesium.Color.BLACK,
                    outlineWidth: 2,
                    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                    pixelOffset: new Cesium.Cartesian2(0, -20)
                },
                id: `location-label-${location.identifier}`
            });
            // Store the reference to the newly added entity
            this.currentLocationMarkerEntity = newMarkerEntity;
        }
      }
    },
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
            heading: Cesium.Math.toRadians(0.0),
            pitch: currentPitch,
            roll: currentRoll
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

/* REMOVED: All loading screen and logo position/animation CSS, now in ProjectLogo.vue */
</style>