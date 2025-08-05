// services/PluginManagerService.js
import { loadPlugins } from "../components/Menu/SubSidebars/Plugins/PluginLoader.js";
import { PopupService } from "./PopupService.js";

class PluginManagerService {
  plugins = [];
  enabledPlugins = new Map();

  async init() {
    try {
      const loaded = await loadPlugins();
      this.plugins = loaded.filter(
        (p) => p?.name && typeof p.enable === "function"
      );
      console.log(
        "🧩 Plugins loaded:",
        this.plugins.map((p) => p.name)
      );
    } catch (err) {
      console.error("❌ Failed to load plugins:", err);
    }
  }

  getAll() {
    return this.plugins;
  }

  isEnabled(name) {
    return this.enabledPlugins.has(name);
  }

  enablePlugin(plugin) {
    plugin.isEnabled = true;

    if (!plugin || !plugin.name) return;
    if (this.isEnabled(plugin.name)) return;

    try {
      plugin.enable?.({ PopupService });
      this.enabledPlugins.set(plugin.name, plugin);
      console.log(`✅ Plugin enabled: ${plugin.name}`);
    } catch (e) {
      console.error(`❌ Failed to enable plugin "${plugin.name}":`, e);
    }
  }

  disablePlugin(plugin) {
    plugin.isEnabled = false;

    if (!plugin || !plugin.name) return;
    if (!this.isEnabled(plugin.name)) return;

    try {
      plugin.disable?.();
      this.enabledPlugins.delete(plugin.name);
      console.log(`🛑 Plugin disabled: ${plugin.name}`);
    } catch (e) {
      console.error(`❌ Failed to disable plugin "${plugin.name}":`, e);
    }
  }

  openPlugin(plugin) {
    if (!plugin || typeof plugin.open !== "function") return;
    try {
      plugin.open();
      console.log(`📂 Plugin opened: ${plugin.name}`);
    } catch (e) {
      console.error(`❌ Failed to open plugin "${plugin.name}":`, e);
    }
  }

  closePlugin(plugin) {
    if (!plugin || typeof plugin.close !== "function") return;
    try {
      plugin.close();
      console.log(`📁 Plugin closed: ${plugin.name}`);
    } catch (e) {
      console.error(`❌ Failed to close plugin "${plugin.name}":`, e);
    }
  }
}

export const PluginManager = new PluginManagerService();
