import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import cesium from 'vite-plugin-cesium';
import path from 'path';
import fs from 'fs-extra';

export default defineConfig({
  plugins: [
    vue(),
    cesium(),
    {
      name: 'copy-cesium-assets',
      apply: 'build',
      closeBundle() {
        const cesiumSource = 'node_modules/cesium/Build/Cesium';
        const cesiumDest = 'dist/cesium';
        fs.copySync(cesiumSource, cesiumDest);
        console.log('✅ Copied Cesium assets to dist/cesium');
      }
    }
  ],
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['vue', 'bootstrap']
        }
      }
    },
    chunkSizeWarningLimit: 5000
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  define: {
    CESIUM_BASE_URL: JSON.stringify('./cesium')
  },
  server: {
    port: 5173,
    strictPort: true
  },
  optimizeDeps: {
    include: ['cesium']
  }
});
