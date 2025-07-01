// src/main.js

import { createApp } from 'vue';
import App from './App.vue';
import 'bootstrap/dist/css/bootstrap.min.css';

import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

window.Cesium = Cesium; // Keep this for Cesium's global access if needed by legacy parts

createApp(App).mount('#app'); // Mount the root App.vue to the #app div in index.html