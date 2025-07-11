// controller.js
// Unified Controller Entry Point

// Set CESIUM_BASE_URL before importing Cesium
window.CESIUM_BASE_URL = '/Cesium/';

// Vue Setup
import { createApp } from 'vue';
import App from '../App.vue';
import 'bootstrap/dist/css/bootstrap.min.css';

// Cesium Setup
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
Cesium.Ion.defaultAccessToken = 'YOUR_CESIUM_ION_ACCESS_TOKEN'; // <<< IMPORTANT: Replace with your actual token
window.Cesium = Cesium;

// App Services (Aggregated)
import { AppInitializerClass } from './AppInitializer.js';
export { MapService } from './MapService.js';
export { UserInterfaceService } from './UserInterfaceService.js';
export { MenuItemService } from './MenuItemService.js';
export { PopupService } from './PopupService.js';
export { DataAddService } from './DataAddService.js';
export { LayerService } from './LayerService.js';
export { ToolManagementService } from './ToolManagementService.js'; // NEW: Import ToolManagementService
export { AppInitializerClass } from './AppInitializer.js'; // Keep this export if AppInitializerClass is used elsewhere as a named export

// Mount Vue App
createApp(App).mount('#app');

// Initialize App Flow
const appInitializer = new AppInitializerClass();
appInitializer.initialize();