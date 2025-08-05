// src/components/Menu/SubSidebars/Plugins/PluginLoader.js
export async function loadPlugins() {
  const pluginModules = import.meta.glob("./external_plugins/**/index.js");

  console.log("🧩 Plugin paths found:", Object.keys(pluginModules));

  const plugins = [];

  for (const path in pluginModules) {
    try {
      const mod = await pluginModules[path]();
      console.log(`✅ Loaded plugin from ${path}`);
      plugins.push(mod.default);
    } catch (e) {
      console.error(`❌ Failed to load plugin at ${path}`, e);
    }
  }

  return plugins;
}
