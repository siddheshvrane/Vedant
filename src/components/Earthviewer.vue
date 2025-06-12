<template>
  <div id="mapWrapper" style="width: 100vw; height: 100vh; overflow: hidden;">
    <div id="mapContainer" style="width: 100%; height: 100%;"></div>
    <div id="northArrow"></div>
    <MenuSidebar />
    <SearchPanel @zoom-to-coordinates="handleZoomToCoordinates" />
  </div>
</template>

<script>
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css'; // <--- ADD THIS LINE
import MenuSidebar from './MenuSidebar.vue';
import SearchPanel from './SearchPanel.vue';

// Set your Cesium Ion default access token here
// IMPORTANT: Replace 'YOUR_CESIUM_ION_ACCESS_TOKEN' with your actual token from cesium.com/ion
// This is crucial for Cesium World Terrain to load.
Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI3MGIxZmQ5Mi1mZDYwLTQ3YjUtYTE2MS1kY2I0OWZhMjdkODkiLCJpZCI6MzEwMzcwLCJpYXQiOjE3NDk2MDQ1NzR9.hqwRjx5mLRGgnxMRsl3SCgX8kJF-7N_VPLWq28nikXk';

export default {
  name: 'EarthViewer',

  components: {
    MenuSidebar,
    SearchPanel
  },
  data() {
    return {
      viewer: null // Initialize viewer to null, will be set in mounted
    };
  },
  mounted() {
    this.initCesiumMap();
  },
  methods: {
    initCesiumMap() {
      const viewer = new Cesium.Viewer('mapContainer', {
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
        creditContainer: document.createElement('div'),
        fullscreenButton: false,
        imageryProvider: false, // Disable default imagery provider
        sceneMode: Cesium.SceneMode.SCENE3D,
        terrainExaggeration: 1.0,
        terrain: new Cesium.Terrain(Cesium.CesiumTerrainProvider.fromUrl("https://vedas.sac.gov.in/elevation/cdem_10m_2016/"))
      });

      viewer.imageryLayers.addImageryProvider(new Cesium.WebMapServiceImageryProvider({
        url: 'https://bhuvan-ras1.nrsc.gov.in/tilecache/tilecache.py', // Replace with your WMS server URL
        layers: 'bhuvan_img', // Replace with the name of the WMS layer you want to add
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

      // Store the viewer instance in component data
      this.viewer = viewer;

      // North Arrow Logic
      const northArrow = document.getElementById('northArrow');
      const updateNorthArrow = () => {
        // Ensure viewer and camera are defined before accessing properties
        if (this.viewer && this.viewer.camera) {
          const heading = this.viewer.camera.heading;
          northArrow.style.transform = `rotate(${Cesium.Math.toDegrees(heading)}deg)`;
        }
      };

      // Add event listener for camera movement
      if (this.viewer && this.viewer.scene && this.viewer.scene.camera) {
        this.viewer.scene.camera.moveEnd.addEventListener(updateNorthArrow);
      }
      // Initial update to set the north arrow's orientation
      updateNorthArrow();

      // Set depthTextAgainstTerrain
      if (this.viewer && this.viewer.scene && this.viewer.scene.globe) {
        this.viewer.scene.globe.depthTestAgainstTerrain = false;
      }

      // Optional: Adjust map to a specific view
      // viewer.camera.flyTo({
      //   destination: Cesium.Cartesian3.fromDegrees(72.5714, 23.0225, 500000), // Example: Ahmedabad coordinates
      //   orientation: {
      //     heading: Cesium.Math.toRadians(0),
      //     pitch: Cesium.Math.toRadians(-90),
      //     roll: 0.0
      //   }
      // });
    },
    handleZoomToCoordinates(coordinates) {
      // Example implementation for zooming:
      if (this.viewer && coordinates && coordinates.longitude !== undefined && coordinates.latitude !== undefined) {
        const { longitude, latitude, height = 500000 } = coordinates; // Default height if not provided
        this.viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, height),
          duration: 2 // seconds
        });
      } else {
        console.warn("Viewer not initialized or invalid coordinates provided for zoom.");
      }
    }
  }
};
</script>

<style scoped>
#mapWrapper {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  position: relative; /* Needed for positioning the north arrow */
}

#mapContainer {
  width: 100%;
  height: 100%;
}

#northArrow {
  position: absolute;
  top: 20px; /* Adjust as needed */
  right: 20px; /* Adjust as needed */
  width: 40px; /* Size of your north arrow */
  height: 40px; /* Size of your north arrow */
  background-image: url(''); /* Replace with your north arrow image */
  background-size: cover;
  z-index: 10; /* Ensure it's above the map */
}

/* Ensure no default margin/padding on body/html if this is the root component */
html, body {
  margin: 0;
  padding: 0;
}
</style>