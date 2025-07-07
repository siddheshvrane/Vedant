// PopupManager.js
export default class PopupManager {
  constructor() {
    this.visible = false;
    this.parameters = {
      layerName: '',
      srs: '',
      extent: ''
    };
  }

  show(params) {
    this.parameters = { ...params };
    this.visible = true;
  }

  hide() {
    this.visible = false;
  }

  getParams() {
    return this.parameters;
  }

  isVisible() {
    return this.visible;
  }
}
