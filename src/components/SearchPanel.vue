<template>
  <div class="search-panel-container poppins-font">
    <div class="input-group">
      <input
        type="text"
        class="form-control custom-search-input"
        :placeholder="searchTerm ? '' : 'Search Places'" v-model="searchTerm"
        @input="handleInput"
        @focus="isDropdownVisible = true"
        @blur="hideDropdown"
        @keyup.enter="performSearch"
      />
      <button class="btn search-icon-btn" @click="performSearch">
        <i class="fas fa-search"></i>
      </button>
    </div>

    <Suggestion
      :suggestions="filteredResults"
      :is-visible="isDropdownVisible"
      @select-location="handleSelectLocation"
    />
  </div>
</template>

<script>
import { MapService } from '../services/controller.js'; // Import MapService
import Suggestion from './Suggestion.vue'; // Import the new Suggestion component

export default {
  name: 'SearchPanel',
  components: {
    Suggestion, // Register the Suggestion component
  },
  data() {
    return {
      searchTerm: '',
      isDropdownVisible: false,
      allLocations: [], // Will be populated by fetched GeoJSON features
      filteredResults: [], // This will be passed to the Suggestion component
    };
  },
  watch: {
    searchTerm: {
      handler(newTerm) {
        this.filterLocations(newTerm);
        // If the search term becomes empty, ensure dropdown is hidden and results are cleared.
        // This handles cases where user deletes all text.
        if (!newTerm.trim()) {
            this.isDropdownVisible = false;
            this.filteredResults = [];
        }
      },
      immediate: true,
    },
  },
  async mounted() {
    try {
      // Use fetch to load the GeoJSON file as a static asset.
      const response = await fetch('/src/data/Location.geojson'); // Updated path to Location.geojson
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const geojsonData = await response.json();
      this.allLocations = geojsonData.features;
      console.log('Loaded Indian cities:', this.allLocations);
      this.filterLocations(this.searchTerm);
    } catch (error) {
      console.error('Error loading GeoJSON data:', error);
      this.allLocations = [];
    }
  },
  methods: {
    /**
     * @method handleInput
     * @description Handles input changes in the search bar, making the dropdown visible.
     * The watcher handles filtering.
     * @returns {void}
     */
    handleInput() {
      this.isDropdownVisible = true;
    },

    /**
     * @method performSearch
     * @description Triggers a search based on the input: either coordinates or text.
     * Publishes 'zoom-to-coordinates' via MapService if coordinates are detected.
     * @returns {void}
     */
    performSearch() {
      const trimmedSearchTerm = this.searchTerm.trim();

      // Regex to match two numbers (float/int) separated by comma or space
      // Captures negative numbers and decimals.
      const coordRegex = /^(-?\d+(\.\d+)?)\s*[, ]\s*(-?\d+(\.\d+)?)$/;
      const match = trimmedSearchTerm.match(coordRegex);

      if (match) {
        // It's a coordinate search
        const lat = parseFloat(match[1]);
        const lon = parseFloat(match[3]);
        const elevation = 15000; // Default elevation for coordinate search

        // Basic validation for latitude and longitude ranges
        if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
          console.warn('Invalid coordinates entered:', trimmedSearchTerm);
          // Optionally, add a visual feedback to the user here
          this.isDropdownVisible = false; // Hide dropdown
          return;
        }

        console.log('Coordinates entered:', lat, lon);
        // Publish event via MapService to zoom to these coordinates
        MapService.zoomToCoordinates({ latitude: lat, longitude: lon, elevation: elevation });
        MapService.displayLocationMarker({
            name: `${lat}, ${lon}`,
            identifier: `coord-${lat}-${lon}`,
            getCoordinates: () => ({ latitude: lat, longitude: lon, elevation: elevation })
        });
        this.isDropdownVisible = false; // Hide dropdown after action
        this.searchTerm = ''; // Clear search term after successful coordinate search
      } else {
        // If it's a text search without selecting from suggestions,
        // we keep the text to allow further refinement or re-search.
        // The placeholder will only reappear if the user manually clears the input.
        this.filterLocations(trimmedSearchTerm);
        this.isDropdownVisible = this.filteredResults.length > 0;
      }
    },

    /**
     * @method handleSelectLocation
     * @description Handles selecting a location from the Suggestion component.
     * Publishes 'zoom-to-coordinates' via MapService using the GeoJSON feature's coordinates.
     * @param {Object} locationFeature - The selected GeoJSON Feature object.
     * @returns {void}
     */
    handleSelectLocation(locationFeature) {
      console.log('Selected location:', locationFeature.properties.name);
      this.isDropdownVisible = false;

      // Check if the feature has valid point coordinates
      if (locationFeature.geometry && locationFeature.geometry.type === 'Point' && locationFeature.geometry.coordinates) {
        const [lon, lat, elevation = 500] = locationFeature.geometry.coordinates; // GeoJSON coords are [lon, lat, elevation]
        // Publish event via MapService to zoom to these coordinates
        MapService.zoomToCoordinates({ latitude: lat, longitude: lon, elevation: elevation });
        MapService.displayLocationMarker({
            name: locationFeature.properties.name,
            identifier: locationFeature.properties.id,
            getCoordinates: () => ({ latitude: lat, longitude: lon, elevation: elevation })
        });
        this.searchTerm = ''; // Clear search term after successful selection
      } else {
        console.warn('Selected location does not have valid point coordinates:', locationFeature);
      }
    },

    /**
     * @method hideDropdown
     * @description Hides the dropdown after a short delay to allow click/mousedown events on items.
     * @returns {void}
     */
    hideDropdown() {
      // Use a timeout to allow click events on suggestions to register before hiding
      setTimeout(() => {
        this.isDropdownVisible = false;
      }, 150);
    },

    /**
     * @method filterLocations
     * @description Filters the loaded locations based on the current search term.
     * Updates 'filteredResults' which is passed to the Suggestion component.
     * @param {string} term - The search term.
     * @returns {void}
     */
    filterLocations(term) {
      if (!term) {
        this.filteredResults = [];
        return;
      }
      const lowerCaseTerm = term.toLowerCase();
      this.filteredResults = this.allLocations.filter((feature) =>
        feature.properties.name.toLowerCase().includes(lowerCaseTerm)
      );
      this.isDropdownVisible = this.filteredResults.length > 0;
    },
  },
};
</script>

<style scoped>
/* All your existing styles for SearchPanel.vue remain unchanged */
.poppins-font {
  font-family: 'Poppins', sans-serif;
}

.search-panel-container {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 300px;
  z-index: 1000;
}

.input-group > .form-control,
.input-group > .btn {
  border-radius: 0.375rem;
}

.custom-search-input {
  background: rgba(30, 30, 30, 0.6);
  color: white;
  border-color: rgba(255, 255, 255, 0.2);
}

.custom-search-input::placeholder {
  color: rgba(255, 255, 255, 0.6);
}

.custom-search-input:focus {
  background-color: rgba(10, 10, 10, 0.65);
  color: white;
  border-color: rgba(255, 255, 255, 0.4);
  box-shadow: 0 0 0 0.25rem rgba(255, 255, 255, 0.1);
}

.search-icon-btn {
  background-color: rgba(10, 10, 10, 0.9);
  color: white;
  border-color: rgba(255, 255, 255, 0.2);
  padding: 0.375rem 0.75rem;
}

.search-icon-btn:hover {
  background-color: rgba(25, 25, 25, 1);
  border-color: rgba(255, 255, 255, 0.3);
}

.input-group > .form-control:not(:last-child) {
  border-top-right-radius: 0 !important;
  border-bottom-right-radius: 0 !important;
}

.input-group > .search-icon-btn:not(:first-child) {
  border-top-left-radius: 0 !important;
  border-bottom-left-radius: 0 !important;
}
</style>