import * as Cesium from 'cesium';

export default class CesiumMapManager {
  constructor(containerId, terrainUrl) {
    this.containerId = containerId;
    this.terrainUrl = terrainUrl;
    this.viewer = null;
    this.northArrowElement = null;
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
      creditContainer: document.createElement('div'),
      fullscreenButton: false,
      imageryProvider: false,
      sceneMode: Cesium.SceneMode.SCENE3D,
      terrainExaggeration: 1.0,
      terrain: new Cesium.Terrain(Cesium.CesiumTerrainProvider.fromUrl(this.terrainUrl))
    });

    this._addImageryLayer();
    this._initNorthArrow();
    this.viewer.scene.globe.depthTestAgainstTerrain = false;
  }

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
  }

  _initNorthArrow() {
    this.northArrowElement = document.getElementById('northArrow');
    const updateArrow = () => {
      const heading = this.viewer.camera.heading;
      this.northArrowElement.style.transform = `rotate(${Cesium.Math.toDegrees(heading)}deg)`;
    };

    this.viewer.scene.camera.moveEnd.addEventListener(updateArrow);
    updateArrow();
  }

  flyToCoordinates({ longitude, latitude, height = 500000 }) {
    if (!this.viewer) return;
    this.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, height),
      duration: 2
    });
  }

  setSceneMode(mode) {
    switch (mode) {
      case '2D':
        this.viewer.scene.mode = Cesium.SceneMode.SCENE2D;
        break;
      case '3D':
        this.viewer.scene.mode = Cesium.SceneMode.SCENE3D;
        break;
      default:
        console.warn('Unsupported mode:', mode);
    }
  }
}
