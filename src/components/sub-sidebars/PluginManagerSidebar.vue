<template>
  <BaseSubSidebar title="Spatial Analysis Plugin">
    <div class="search-section mb-4">
      <div class="input-group custom-search-input">
        <input
          type="text"
          class="form-control"
          placeholder="Search Plugins"
          v-model="searchQuery"
          @input="filterPlugins"
        >
        <span class="input-group-text">
          <i class="fas fa-search"></i>
        </span>
      </div>
    </div>

    <div class="plugin-list-section">
      <ul class="list-unstyled plugin-list">
        <PluginListItem
          v-for="plugin in filteredPlugins"
          :key="plugin.id"
          :plugin="plugin"
          @toggle-install="togglePluginInstall"
          @help-plugin="showPluginHelp"
        />
        <li v-if="filteredPlugins.length === 0" class="text-center text-muted mt-3">
          No plugins found.
        </li>
      </ul>
    </div>
  </BaseSubSidebar>
</template>

<script>
import BaseSubSidebar from '../utils/BaseSubSidebar.vue'; // Adjust path as needed
import PluginListItem from '../utils/PluginListItem.vue'; // Adjust path as needed

export default {
  name: 'PluginManagerSidebar',
  components: {
    BaseSubSidebar,
    PluginListItem,
  },
  data() {
    return {
      searchQuery: '',
      allPlugins: [
        {
          id: 'plugin1',
          title: 'Forest Cover Change',
          subtitle: 'Detects changes in forest areas over time.',
          pfpUrl: 'https://placehold.co/60x60/28a745/ffffff?text=FC', // Green
          isInstalled: true,
        },
        {
          id: 'plugin2',
          title: 'Urban Growth Monitor',
          subtitle: 'Analyzes urban expansion and sprawl.',
          pfpUrl: 'https://placehold.co/60x60/007bff/ffffff?text=UG', // Blue
          isInstalled: false,
        },
        {
          id: 'plugin3',
          title: 'Flood Risk Assessment',
          subtitle: 'Identifies areas prone to flooding.',
          pfpUrl: 'https://placehold.co/60x60/ffc107/343a40?text=FR', // Yellow
          isInstalled: true,
        },
        {
          id: 'plugin4',
          title: 'Crop Yield Prediction',
          subtitle: 'Predicts crop yields based on satellite data.',
          pfpUrl: 'https://placehold.co/60x60/6f42c1/ffffff?text=CY', // Purple
          isInstalled: false,
        },
        {
          id: 'plugin5',
          title: 'Air Quality Index',
          subtitle: 'Visualizes real-time air quality data.',
          pfpUrl: 'https://placehold.co/60x60/dc3545/ffffff?text=AQ', // Red
          isInstalled: false,
        },
      ],
      filteredPlugins: [],
    };
  },
  created() {
    this.filteredPlugins = [...this.allPlugins]; // Initialize filtered list with all plugins
  },
  methods: {
    filterPlugins() {
      const query = this.searchQuery.toLowerCase().trim();
      this.filteredPlugins = this.allPlugins.filter(plugin =>
        plugin.title.toLowerCase().includes(query) ||
        plugin.subtitle.toLowerCase().includes(query)
      );
    },
    togglePluginInstall(pluginId) {
      const plugin = this.allPlugins.find(p => p.id === pluginId);
      if (plugin) {
        plugin.isInstalled = !plugin.isInstalled;
        console.log(`Plugin ${plugin.title} installation status toggled to: ${plugin.isInstalled}`);
      }
    },
    showPluginHelp(pluginId) {
      const plugin = this.allPlugins.find(p => p.id === pluginId);
      if (plugin) {
        console.log(`Showing help for ${plugin.title}.`);
      }
    },
  },
};
</script>

<style scoped>
/*
  Using Bootstrap variables where possible is ideal, but here we define custom
  variables for transparency and specific shades not directly in Bootstrap's palette.
  Bootstrap's theme colors like --bs-primary are generally opaque.
*/
:root {
  --sidebar-bg: rgba(30, 30, 30, 0.95); /* Slightly more opaque for content */
  --card-bg: rgba(40, 40, 40, 0.9); /* Darker than sidebar, more opaque */
  --border-color: rgba(60, 60, 60, 0.7); /* Subtle border for cards */
  --text-color: #e0e0e0; /* Light gray for general text */
  --muted-text-color: #a0a0a0; /* Even lighter gray for muted text */
  /* Using Bootstrap's built-in variables for primary/secondary/danger if available,
     otherwise defining them to match Bootstrap's defaults. */
  --bs-primary: #0d6efd; /* Official Bootstrap 5 primary blue */
  --bs-primary-rgb: 13,110,253;
  --bs-secondary: #6c757d; /* Official Bootstrap 5 secondary gray */
  --bs-danger: #dc3545; /* Official Bootstrap 5 danger red */
}

/* Ensure the sidebar content fills its space and has consistent background */
.sub-sidebar-transition-target {
  background: var(--sidebar-bg); /* Use the defined variable */
  color: var(--text-color); /* Set default text color for the sidebar */
  /* Using Bootstrap's shadow utility might be an alternative if it fits.
     For custom opacity, a custom box-shadow is better. */
  box-shadow: 0 0 15px rgba(0, 0, 0, 0.5);
}

/* Search Section */
.search-section {
  padding: 20px 20px 10px 20px; /* Custom padding */
  border-bottom: 1px solid var(--border-color); /* Custom border */
  margin-bottom: 15px; /* Bootstrap spacing for mb-3 or mb-4 could be used, but 15px is specific */
}

.custom-search-input .form-control {
  background-color: rgba(255, 255, 255, 0.1); /* Custom transparent background */
  border: 1px solid rgba(255, 255, 255, 0.2); /* Custom transparent border */
  color: var(--text-color);
  border-right: none;
  border-radius: 8px 0 0 8px; /* Custom border-radius */
  padding: 10px 15px; /* Custom padding, Bootstrap has p-2, p-3 etc. but might not match exactly */
  font-size: 0.95em; /* Custom font size */
}

.custom-search-input .form-control::placeholder {
  color: var(--muted-text-color);
  opacity: 0.8; /* Custom opacity */
}

.custom-search-input .form-control:focus {
  background-color: rgba(255, 255, 255, 0.15); /* Custom background */
  border-color: var(--bs-primary); /* Using Bootstrap primary color */
  /* Using Bootstrap's focus ring would be `box-shadow: 0 0 0 0.25rem rgba(var(--bs-primary-rgb),.25);`
     but the current one is also effective. */
  box-shadow: 0 0 0 0.15rem rgba(0, 123, 255, 0.3);
}

.custom-search-input .input-group-text {
  background-color: rgba(255, 255, 255, 0.1); /* Custom transparent background */
  border: 1px solid rgba(255, 255, 255, 0.2); /* Custom transparent border */
  color: var(--muted-text-color);
  border-left: none;
  border-radius: 0 8px 8px 0; /* Custom border-radius */
  padding: 10px 15px; /* Custom padding */
}

/* Plugin List Section */
.plugin-list-section {
  flex-grow: 1;
  padding: 0 20px 20px 20px; /* Custom padding */
  overflow-y: auto; /* Enable scrolling for plugin list */
}

.plugin-list {
  padding: 0; /* Bootstrap `list-unstyled` handles this */
  margin: 0; /* Bootstrap `list-unstyled` handles this */
}

.plugin-list li:not(:last-child) {
  margin-bottom: 15px; /* Custom spacing */
}

.plugin-list li.text-center {
  color: var(--muted-text-color); /* Custom color */
  padding: 20px; /* Custom padding */
}

/* Scrollbar styling reset - explicitly overriding any browser defaults */
.plugin-list-section::-webkit-scrollbar {
  width: 0; /* Hide scrollbar width */
  background: transparent; /* Make track transparent */
}
.plugin-list-section::-webkit-scrollbar-track {
  background: transparent;
}
.plugin-list-section::-webkit-scrollbar-thumb {
  background: transparent;
  border: none;
}
/* For Firefox */
.plugin-list-section {
  scrollbar-width: none; /* Hide scrollbar in Firefox */
}
</style>
