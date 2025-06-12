import * as Cesium from 'cesium';

export default class CesiumMapManager {
  constructor(containerId, terrainUrl) {
    this.containerId = containerId;
    this.terrainUrl = terrainUrl;
    this.viewer = null;
    this.northArrowImageElement = null; // Changed to target the <img> element
  }

  init() {
    this.viewer = new Cesium.Viewer(this.containerId, {
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
      imageryProvider: false, // We'll add our own imagery layer
      sceneMode: Cesium.SceneMode.SCENE3D,
      terrainExaggeration: 1.0,
      terrain: new Cesium.Terrain(Cesium.CesiumTerrainProvider.fromUrl(this.terrainUrl))
    });

    this._addImageryLayer();
    this._setupNorthArrowRotation(); // Call the north arrow setup
    this.viewer.scene.globe.depthTestAgainstTerrain = false; // Ensures objects below terrain are not clipped
  }

  /**
   * Returns the Cesium Viewer instance.
   * This is crucial for integrating external components.
   */
  getViewer() {
    return this.viewer;
  }

  _addImageryLayer() {
    // Adding Bhuvan WMS Imagery Layer
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
  }

  // Updated method to manage north arrow rotation
  _setupNorthArrowRotation() {
    // Get the actual image element inside the northArrow div
    this.northArrowImageElement = document.querySelector('#northArrow .north-arrow-img');

    if (!this.northArrowImageElement) {
      console.warn("North arrow image element with class 'north-arrow-img' not found inside '#northArrow'.");
      return;
    }

    // Listener for postRender event to update arrow constantly
    this.viewer.scene.postRender.addEventListener(() => {
      // Get the camera heading in radians
      const heading = this.viewer.camera.heading;

      // Convert radians to degrees and negate for correct CSS rotation
      // Cesium heading is clockwise, CSS rotate() is counter-clockwise for positive values.
      const rotationDegrees = -Cesium.Math.toDegrees(heading);
      this.northArrowImageElement.style.transform = `rotate(${rotationDegrees}deg)`;
    });

    // Initial update in case the camera doesn't move immediately
    const initialHeading = this.viewer.camera.heading;
    this.northArrowImageElement.style.transform = `rotate(${-Cesium.Math.toDegrees(initialHeading)}deg)`;
  }

  flyToCoordinates({ longitude, latitude, height = 500000 }) {
    if (!this.viewer) {
      console.error('Cesium viewer not initialized.');
      return;
    }
    this.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, height),
      duration: 2 // seconds
    });
  }

  setSceneMode(mode) {
    if (!this.viewer) {
      console.error('Cesium viewer not initialized.');
      return;
    }
    switch (mode) {
      case '2D':
        this.viewer.scene.mode = Cesium.SceneMode.SCENE2D;
        break;
      case '3D':
        this.viewer.scene.mode = Cesium.SceneMode.SCENE3D;
        break;
      case 'ColumbusView':
        this.viewer.scene.mode = Cesium.SceneMode.COLUMBUS_VIEW;
        break;
      default:
        console.warn('Unsupported scene mode:', mode);
    }
  }

  // Add more methods here as needed for map interactions (e.g., adding layers, entities)
}