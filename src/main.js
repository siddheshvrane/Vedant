// src/main.js

import { createApp } from 'vue';
import App from './App.vue';
import 'bootstrap/dist/css/bootstrap.min.css';

import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css'; // Keep this path as it is

window.Cesium = Cesium;

createApp(App).mount('#app');