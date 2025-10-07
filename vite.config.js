import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import cesium from 'vite-plugin-cesium';
import path from 'path';

export default defineConfig({
  plugins: [
    vue(),
    cesium()
  ],
  // CRITICAL FIX FOR ELECTRON BLANK SCREEN:
  // This forces all built assets (JS/CSS/images) to be loaded using relative paths 
  // (e.g., ./assets/...) instead of absolute paths (/assets/...). 
  // This is mandatory when assets are loaded via the file:// protocol in Electron.
  base: './', 
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // FIX: The error "cesium cannot be included in manualChunks" occurs
        // because the 'vite-plugin-cesium' handles this dependency.
        // We must remove 'cesium' from the manualChunks configuration.
        manualChunks: {
          'vendor': ['vue', 'bootstrap'] // Retaining other chunks as requested
        }
      }
    },
    chunkSizeWarningLimit: 5000 // Increase limit for Cesium
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 5173,
    strictPort: true
  },
  optimizeDeps: {
    include: ['cesium']
  }
});