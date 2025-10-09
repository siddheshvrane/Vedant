// controller.js
// Unified Controller Entry Point

// IMPORTANT: set CESIUM_BASE_URL relative to the final dist layout
// The dist folder will contain `dist/cesium/...` after the copy script runs
window.CESIUM_BASE_URL = './cesium/'; // relative path used by renderer

// Vue Setup
import { createApp } from 'vue';
import App from './App.vue';
import 'bootstrap/dist/css/bootstrap.min.css';

// IMPORTANT: import Cesium AFTER setting CESIUM_BASE_URL
// This import will provide the Cesium namespace to runtime.
import * as Cesium from 'cesium';

// Don't import widgets.css here; we let the static link in dist/index.html load it,
// so it resolves at runtime to ./cesium/Widgets/widgets.css
// import 'cesium/Build/Cesium/Widgets/widgets.css';  // <-- removed

Cesium.Ion.defaultAccessToken = 'YOUR_CESIUM_ION_ACCESS_TOKEN'; // Replace this
window.Cesium = Cesium;

// App Services (Aggregated)
import { AppInitializerClass } from './services/AppInitializer.js';
export { MapService } from './services/MapService.js';
export { UserInterfaceService } from './services/UserInterfaceService.js';
export { MenuItemService } from './services/MenuItemService.js';
export { PopupService } from './services/PopupService.js';
export { DataAddService } from './services/DataAddService.js';
export { LayerService } from './services/LayerService.js';
export { ToolManagementService } from './services/ToolManagementService.js';
export { AppInitializerClass } from './services/AppInitializer.js';

// Mount Vue App
createApp(App).mount('#app');

// Initialize App Flow
const appInitializer = new AppInitializerClass();
appInitializer.initialize();
