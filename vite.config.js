import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import cesium from 'vite-plugin-cesium'; // Make sure this is imported

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    cesium({
      // Base URL for Cesium assets, typically empty or '/' for root
      // If you're building for a subfolder, this would be '/your-app-path/'
      cesiumBaseUrl: '/',
    }),
  ],
  server: {
    // This is important for Electron to be able to connect
    host: 'localhost', // Or '0.0.0.0' if you need network access
    port: 5173, // Ensure this matches wait-on in package.json
  },
  build: {
    // You might need to configure this for production builds
    // to ensure Cesium's static assets are copied correctly.
    // The plugin should handle this, but sometimes additional config is needed.
    // assetsDir: 'assets', // Example, often not needed with cesium plugin
  },
});