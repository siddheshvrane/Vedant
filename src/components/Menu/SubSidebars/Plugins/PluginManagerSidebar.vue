<template>
  <BaseSubSidebar title="Spatial Analysis Plugin">
    <div class="search-section mb-4">
      <div class="input-group custom-search-input">
        <input
          type="text"
          class="form-control"
          placeholder="Search Plugins"
          v-model="searchQuery" />
        <span class="input-group-text">
          <i class="fas fa-search"></i>
        </span>
      </div>
    </div>

    <div class="plugin-list-section">
      <ul class="list-unstyled plugin-list">
        <PluginListItem
          v-for="plugin in filteredPlugins"
          :key="plugin.name"
          :plugin="plugin"
          @toggle-enable="toggleEnablePlugin"
          @open-plugin="openPlugin"
          @help-plugin="showPluginHelp" />
        <li
          v-if="filteredPlugins.length === 0"
          class="text-center text-muted mt-3">
          No plugins found.
        </li>
      </ul>
    </div>
  </BaseSubSidebar>
</template>

<script>
import BaseSubSidebar from "../SubSidebar.vue";
import PluginListItem from "./PluginListItem.vue";
import { PluginManager } from "../../../../services/PluginManagerService";

export default {
  name: "PluginManagerSidebar",
  components: {
    BaseSubSidebar,
    PluginListItem,
  },
  data() {
    return {
      searchQuery: "",
      allPlugins: [],
    };
  },
  computed: {
    filteredPlugins() {
      const query = this.searchQuery.toLowerCase().trim();
      return this.allPlugins.filter(
        (plugin) =>
          plugin.title?.toLowerCase().includes(query) ||
          plugin.subtitle?.toLowerCase().includes(query)
      );
    },
  },
  async created() {
    await PluginManager.init();
    this.allPlugins = PluginManager.getAll();

    // Mark enabled plugins (based on PluginManager state)
    this.allPlugins.forEach((plugin) => {
      plugin.isEnabled = PluginManager.isEnabled(plugin.name);
    });
  },
  methods: {
    showPluginHelp(pluginId) {
      const plugin = this.allPlugins.find(
        (p) => p.id === pluginId || p.name === pluginId
      );
      if (plugin) {
        console.log(
          `Help requested for plugin: ${plugin.title || plugin.name}`
        );
        // Optional: Open help popup via PopupService
      }
    },

    togglePluginEnable(pluginId) {
      const plugin = this.allPlugins.find(
        (p) => p.id === pluginId || p.name === pluginId
      );
      if (!plugin) return;

      plugin.isEnabled = !plugin.isEnabled;

      if (plugin.isEnabled) {
        PluginManager.enablePlugin(plugin);
      } else {
        PluginManager.disablePlugin(plugin);
      }
    },

    openPlugin(pluginId) {
      const plugin = this.allPlugins.find(
        (p) => p.id === pluginId || p.name === pluginId
      );
      if (plugin?.isEnabled) {
        PluginManager.openPlugin(plugin);
      }
    },
  },
};
</script>

<style scoped>
/* Keep all your existing CSS — no changes needed */
:root {
  --sidebar-bg: rgba(30, 30, 30, 0.95);
  --card-bg: rgba(40, 40, 40, 0.9);
  --border-color: rgba(60, 60, 60, 0.7);
  --text-color: #e0e0e0;
  --muted-text-color: #a0a0a0;
  --bs-primary: #0d6efd;
  --bs-primary-rgb: 13, 110, 253;
  --bs-secondary: #6c757d;
  --bs-danger: #dc3545;
}

.sub-sidebar-transition-target {
  background: var(--sidebar-bg);
  color: var(--text-color);
  box-shadow: 0 0 15px rgba(0, 0, 0, 0.5);
}

.search-section {
  padding: 20px 20px 10px 20px;
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 15px;
}

.custom-search-input .form-control {
  background-color: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: var(--text-color);
  border-right: none;
  border-radius: 8px 0 0 8px;
  padding: 10px 15px;
  font-size: 0.95em;
}

.custom-search-input .form-control::placeholder {
  color: var(--muted-text-color);
  opacity: 0.8;
}

.custom-search-input .form-control:focus {
  background-color: rgba(255, 255, 255, 0.15);
  border-color: var(--bs-primary);
  box-shadow: 0 0 0 0.15rem rgba(0, 123, 255, 0.3);
}

.custom-search-input .input-group-text {
  background-color: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: var(--muted-text-color);
  border-left: none;
  border-radius: 0 8px 8px 0;
  padding: 10px 15px;
}

.plugin-list-section {
  flex-grow: 1;
  padding: 0 20px 20px 20px;
  overflow-y: auto;
}

.plugin-list {
  padding: 0;
  margin: 0;
}

.plugin-list li:not(:last-child) {
  margin-bottom: 15px;
}

.plugin-list li.text-center {
  color: var(--muted-text-color);
  padding: 20px;
}

.plugin-list-section::-webkit-scrollbar {
  width: 0;
  background: transparent;
}
.plugin-list-section::-webkit-scrollbar-track {
  background: transparent;
}
.plugin-list-section::-webkit-scrollbar-thumb {
  background: transparent;
  border: none;
}
.plugin-list-section {
  scrollbar-width: none;
}
</style>
