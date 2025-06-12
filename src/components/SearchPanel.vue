<template>
  <div class="search-panel-container poppins-font">
    <div class="input-group">
      <input
        type="text"
        class="form-control custom-search-input"
        placeholder="Search Places" v-model="searchTerm"
        @input="handleInput"
        @focus="isDropdownVisible = true"
        @blur="hideDropdown"
        @keyup.enter="performSearch" >
      <button class="btn search-icon-btn" @click="performSearch">
        <i class="fas fa-search"></i>
      </button>
    </div>

    <div v-if="isDropdownVisible && filteredResults.length > 0" class="dropdown-menu-custom shadow-sm show">
      <ul class="list-unstyled">
        <li v-for="result in filteredResults" :key="result.properties.id">
          <a href="#" class="dropdown-item-custom" @mousedown.prevent="selectLocation(result)">
            <i class="fas fa-map-marker-alt me-2"></i>
            {{ result.properties.name }}
          </a>
        </li>
      </ul>
    </div>
  </div>
</template>

<script>
// IMPORTANT: Keep this line removed, as per our previous discussion.
// import indianCitiesGeoJSON from '../data/indian_cities.geojson';

export default {
  name: 'SearchPanel',

  data() {
    return {
      searchTerm: '',
      isDropdownVisible: false,
      allLocations: [], // Will be populated by fetched GeoJSON features
      filteredResults: []
    };
  },

  watch: {
    searchTerm: {
      handler(newTerm) {
        this.filterLocations(newTerm);
      },
      immediate: true
    }
  },

  async mounted() {
    try {
      // Use fetch to load the GeoJSON file as a static asset.
      const response = await fetch('/src/data/indian_cities.geojson');
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
     * Emits 'zoom-to-coordinates' if coordinates are detected.
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

        // Basic validation for latitude and longitude ranges
        if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
          console.warn('Invalid coordinates entered:', trimmedSearchTerm);
          // Optionally, add a visual feedback to the user here
          this.isDropdownVisible = false; // Hide dropdown
          return;
        }

        console.log('Coordinates entered:', lat, lon);
        // Emit event to parent (EarthViewer) to zoom to these coordinates
        this.$emit('zoom-to-coordinates', lat, lon);
        this.isDropdownVisible = false; // Hide dropdown after action
        this.searchTerm = `${lat}, ${lon}`; // Keep cleaned coordinates in search bar
      } else {
        // It's a text search, continue with existing filtering logic
        console.log('Text search for:', trimmedSearchTerm);
        this.filterLocations(trimmedSearchTerm); // Re-filter to ensure latest results
        this.isDropdownVisible = this.filteredResults.length > 0;
      }
    },

    /**
     * @method selectLocation
     * @description Handles selecting a location from the dropdown.
     * Emits 'zoom-to-coordinates' using the GeoJSON feature's coordinates.
     * @param {Object} locationFeature - The selected GeoJSON Feature object.
     * @returns {void}
     */
    selectLocation(locationFeature) {
      console.log('Selected location:', locationFeature.properties.name);
      this.searchTerm = locationFeature.properties.name;
      this.isDropdownVisible = false;

      // Check if the feature has valid point coordinates
      if (locationFeature.geometry && locationFeature.geometry.type === 'Point' && locationFeature.geometry.coordinates) {
        const [lon, lat] = locationFeature.geometry.coordinates; // GeoJSON coordinates are [longitude, latitude]
        this.$emit('zoom-to-coordinates', lat, lon); // Emit with (latitude, longitude)
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
      setTimeout(() => {
        this.isDropdownVisible = false;
      }, 150);
    },

    /**
     * @method filterLocations
     * @description Filters the loaded locations based on the current search term.
     * @param {string} term - The search term.
     * @returns {void}
     */
    filterLocations(term) {
      if (!term) {
        this.filteredResults = [];
        return;
      }
      const lowerCaseTerm = term.toLowerCase();
      this.filteredResults = this.allLocations.filter(feature =>
        feature.properties.name.toLowerCase().includes(lowerCaseTerm)
      );
      this.isDropdownVisible = this.filteredResults.length > 0;
    }
  }
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

.dropdown-menu-custom {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 1000;
  width: 100%;
  max-height: 200px;
  overflow-y: auto;
  background-color: rgba(30, 30, 30, 0.65);
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 0.25rem;
  padding: 0;
  margin-top: 0.125rem;
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.175);
}

.dropdown-menu-custom .list-unstyled {
    margin-bottom: 0;
    padding-bottom: 0;
}

.dropdown-item-custom {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 0.5rem 1rem;
  clear: both;
  font-weight: 400;
  text-align: inherit;
  white-space: nowrap;
  background-color: transparent;
  border: 0;
  text-decoration: none;
  color: white;
}

.dropdown-item-custom:hover,
.dropdown-item-custom:focus {
  color: #fff;
  background-color: rgba(255, 255, 255, 0.1);
}

.dropdown-item-custom i {
    font-size: 0.9em;
    margin-right: 0.5rem;
}
</style>