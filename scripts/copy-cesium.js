// scripts/copy-cesium.js
// Node 16+ (fs.cp available). Copies Cesium build into dist/cesium

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const src = path.join(root, 'node_modules', 'cesium', 'Build', 'Cesium');
const dest = path.join(root, 'dist', 'cesium');

async function copyDir(srcDir, destDir) {
  try {
    // Remove existing dest if present for a clean copy
    if (fs.existsSync(destDir)) {
      await fs.promises.rm(destDir, { recursive: true, force: true });
    }
    // Use fs.cp for efficient recursive copy
    await fs.promises.cp(srcDir, destDir, { recursive: true });
    console.log(`✅ Copied Cesium from "${srcDir}" -> "${destDir}"`);
  } catch (err) {
    console.error('❌ Failed copying Cesium:', err);
    process.exitCode = 1;
  }
}

(async () => {
  if (!fs.existsSync(src)) {
    console.error(`❌ Source Cesium not found at: ${src}`);
    console.error('Run "npm install" to ensure cesium is installed.');
    process.exitCode = 2;
    return;
  }
  await copyDir(src, dest);
})();
