<template>
  <div v-if="showPopup" class="unified-popup-overlay">
    <div class="unified-popup poppins-font">
      <div class="popup-header-common"> <h5 class="popup-title">{{ getTitleForCurrentPopup }}</h5>
        <button @click="hidePopup" class="close-btn" title="Close">
          <i class="fas fa-times"></i>
        </button>
      </div>


      <template v-if="currentPopupType === 'serviceAdded'">
        <div class="popup-content">
          <div class="popup-item">
            <span class="info-label">Layer:</span>
            <span class="info-value">{{ popupData.layerName }}</span>
          </div>
          <div class="popup-item">
            <span class="info-label">SRS:</span>
            <span class="info-value">{{ popupData.srs }}</span>
          </div>
          <div class="popup-item">
            <span class="info-label">Extent:</span>
            <span class="info-value">{{ popupData.extent }}</span>
          </div>
        </div>
        <button @click="hidePopup" class="btn btn-primary close-popup-btn">OK</button>
      </template>

      <template v-else-if="currentPopupType === 'toolInstruction'">
        <div class="popup-content">
          <p>{{ popupData.message }}</p>
        </div>
        <button v-if="popupData.showDismissButton !== false" @click="hidePopup" class="btn btn-primary close-popup-btn">OK</button>
      </template>

      <template v-else-if="currentPopupType === 'confirmation'">
        <div class="popup-content">
          <p>{{ popupData.message }}</p>
        </div>
        <div class="popup-actions">
          <button @click="confirm(false)" class="btn btn-secondary action-btn">
            {{ popupData.cancelText || 'Cancel' }}
          </button>
          <button @click="confirm(true)" class="btn btn-danger action-btn">
            {{ popupData.confirmText || 'Confirm' }}
          </button>
        </div>
      </template>

      <template v-else-if="currentPopupType === 'viewshedForm'">
        <div class="viewshed-form-content popup-content">
          <label class="form-label">Observer Height (m):</label>
          <input type="number" v-model.number="viewshedOptions.observerHeight" min="1" max="100" class="form-input" />

          <label class="form-label">View Distance (m):</label>
          <input type="number" v-model.number="viewshedOptions.viewDistance" min="100" max="10000" step="100" class="form-input" />

          <label class="form-label">Resolution (number of rays):</label>
          <select v-model.number="viewshedOptions.rayCount" class="form-select">
            <option :value="32">Low (32)</option>
            <option :value="64">Medium (64)</option>
            <option :value="128">High (128)</option>
          </select>
        </div>
        <div class="popup-actions">
          <button @click="handleViewshedStart" class="btn btn-primary action-btn">Start Analysis</button>
          <button @click="handleViewshedCancel" class="btn btn-secondary action-btn">Cancel</button>
        </div>
      </template>

      <template v-else-if="currentPopupType === 'terrainProfileStats'">
        <div class="graph-container">
          <svg viewBox="0 0 1000 300" class="elevation-graph">
            <g v-for="(y, i) in yGrid" :key="'y-' + i">
              <line
                :y1="y.y"
                :y2="y.y"
                x1="0"
                x2="1000"
                stroke="#444"
                stroke-width="0.5" />
              <text x="10" :y="y.y - 4" fill="#ddd" font-size="14">
                {{ y.label }} m
              </text>
            </g>

            <g v-for="(x, i) in xGrid" :key="'x-' + i">
              <line
                :x1="x.x"
                :x2="x.x"
                y1="0"
                y2="200"
                stroke="#444"
                stroke-width="0.5" />
              <text
                :x="x.x"
                y="230"
                fill="#ddd"
                font-size="14"
                text-anchor="middle"
              >
                {{ x.label }} m
              </text>
            </g>

            <polyline
              :points="svgPolyline"
              fill="none"
              stroke="#4ade80"
              stroke-width="2.5" />
          </svg>
        </div>

        <div class="stats popup-content">
          <p class="popup-item">
            <span class="info-label">Total Distance:</span>
            <span class="info-value">{{ totalDistance.toFixed(1) }} m</span>
          </p>
          <p class="popup-item">
            <span class="info-label">Min Elevation:</span>
            <span class="info-value">{{ minHeight.toFixed(1) }} m</span>
          </p>
          <p class="popup-item">
            <span class="info-label">Max Elevation:</span>
            <span class="info-value">{{ maxHeight.toFixed(1) }} m</span>
          </p>
          <p class="popup-item">
            <span class="info-label">Elevation Gain:</span>
            <span class="info-value">{{ (maxHeight - minHeight).toFixed(1) }} m</span>
          </p>
        </div>
      </template>

      <template v-else>
        <div class="popup-content">
          <p>No specific popup content defined for this type.</p>
        </div>
        <button @click="hidePopup" class="btn btn-primary close-popup-btn">OK</button>
      </template>

    </div>
  </div>
</template>

<script>
// (No changes to script section)
import { PopupService } from '../../services/PopupService.js';
import { getToolState } from '../../components/Menu/SubSidebars/BasicTools/tool-helpers/tools-helpers.js';

export default {
  name: 'AppPopup',
  data() {
    return {
      showPopup: false,
      currentPopupType: null,
      popupData: {},
      viewshedOptions: {
        observerHeight: 1.75,
        viewDistance: 5000,
        rayCount: 64,
      },
      profile: [],
      terrainProfileEntity: null,
      visibilitySubscription: null,
      contentSubscription: null,
    };
  },
  computed: {
    getTitleForCurrentPopup() {
      switch (this.currentPopupType) {
        case 'serviceAdded': return 'Successfully Added Service';
        case 'toolInstruction': return this.popupData.title || 'Tool Instructions';
        case 'confirmation': return this.popupData.title || 'Confirm Action';
        case 'viewshedForm': return 'Viewshed Parameters';
        case 'terrainProfileStats': return 'Terrain Profile'; // Explicitly set title for terrain profile
        default: return 'Information';
      }
    },
    totalDistance() {
      return this.profile.length ? this.profile.at(-1)?.distance || 0 : 0;
    },
    minHeight() {
      return this.profile.length
        ? Math.min(...this.profile.map((p) => p.height))
        : 0;
    },
    maxHeight() {
      return this.profile.length
        ? Math.max(...this.profile.map((p) => p.height))
        : 1;
    },
    svgPolyline() {
      const width = 1000;
      const height = 200;
      const stepX = this.profile.length > 1 ? width / (this.profile.length - 1) : 0;
      const min = this.minHeight;
      const range = this.maxHeight - min || 1;

      return this.profile
        .map((p, i) => {
          const x = i * stepX;
          const y = height - ((p.height - min) / range) * height;
          return `${x},${y}`;
        })
        .join(" ");
    },
    xGrid() {
      const count = 6;
      const labels = [];
      const step = this.totalDistance / (count - 1);
      for (let i = 0; i < count; i++) {
        const x = (i / (count - 1)) * 1000;
        const label = Math.round(i * step);
        labels.push({ x, label });
      }
      return labels;
    },
    yGrid() {
      const height = 200;
      const count = 5;
      const range = this.maxHeight - this.minHeight || 1;
      const labels = [];

      for (let i = 0; i < count; i++) {
        const fraction = i / (count - 1);
        const y = height - fraction * height;
        const label = Math.round(this.minHeight + fraction * range);
        labels.push({ y, label });
      }

      return labels;
    },
  },
  mounted() {
    this.visibilitySubscription = PopupService.isVisible$.subscribe(isVisible => {
      this.showPopup = isVisible;
    });

    this.contentSubscription = PopupService.popupContent$.subscribe(content => {
      console.log('AppPopup received popupContent:', content);
      this.currentPopupType = content.type;
      this.popupData = content.data;

      if (content.type === 'viewshedForm' && content.data.viewshedOptions) {
        this.viewshedOptions = { ...content.data.viewshedOptions };
      } else if (content.type === 'terrainProfileStats') {
        this.initializeTerrainProfile(content.data);
      }
    });

    window.addEventListener("terrain-profile-ready", this.handleTerrainProfileReady);
  },
  beforeUnmount() {
    if (this.visibilitySubscription) {
      this.visibilitySubscription.unsubscribe();
    }
    if (this.contentSubscription) {
      this.contentSubscription.unsubscribe();
    }
    window.removeEventListener("terrain-profile-ready", this.handleTerrainProfileReady);
  },
  methods: {
    hidePopup() {
      PopupService.hide();
    },
    confirm(result) {
      PopupService.resolveConfirmation(result);
    },
    handleViewshedStart() {
      if (this.popupData.onStart) {
        this.popupData.onStart(this.viewshedOptions);
      }
      this.hidePopup();
    },
    handleViewshedCancel() {
      if (this.popupData.onCancel) {
        this.popupData.onCancel();
      }
      this.hidePopup();
    },
    initializeTerrainProfile(data) {
      this.profile = data.profile || [];
      this.terrainProfileEntity = data.entity || null;
    },
    handleTerrainProfileReady(e) {
      PopupService.show({
        type: 'terrainProfileStats',
        data: {
          profile: e.detail.profile || [],
          entity: e.detail.entity || null,
        }
      });
      console.log('Popup.vue: Received terrain-profile-ready event.');
    },
    handleRemoveProfile() {
      console.log("Removing terrain profile...");
      const { viewer } = getToolState();

      if (viewer && this.terrainProfileEntity && viewer.entities.contains(this.terrainProfileEntity)) {
        viewer.entities.remove(this.terrainProfileEntity);
        console.log("Terrain profile entity removed.");
      }

      this.terrainProfileEntity = null;
      this.profile = [];
      this.hidePopup();
    },
  },
};
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');

.poppins-font {
  font-family: 'Poppins', sans-serif;
}

/* Unified styles for all popups - Mimicking SceneInfo/MeasurementHistory container */
.unified-popup-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5); /* Semi-transparent overlay */
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000; /* Ensure popup is on top */
}

.unified-popup {
  /* Mimic SceneInfo/MeasurementHistory container background */
  background-color: rgba(30, 30, 30, 0.9); /* Slightly more opaque for pop-up */
  color: white;
  padding: 15px 20px;
  border-radius: 10px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5); /* Stronger shadow for pop-up prominence */
  backdrop-filter: blur(8px); /* Stronger blur for pop-up effect */
  -webkit-backdrop-filter: blur(8px);
  width: 380px; /* Adjust width as needed for content, balanced with history item width */
  text-align: center;
  font-family: 'Poppins', sans-serif;
  max-height: 90vh; /* Prevent popup from overflowing screen */
  overflow-y: auto; /* Allow scrolling if content is too long */
  border: 1px solid rgba(255, 255, 255, 0.15); /* Subtle border for definition */
}

/* Common header styling for all popups - Mimicking .history-title */
.popup-header-common {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2); /* Consistent border style */
  padding-bottom: 8px;
  position: sticky; /* Make header sticky if content scrolls */
  top: 0;
  background-color: inherit; /* Inherit background to not break blur effect */
  z-index: 10; /* Ensure header is above scrolling content */
}

.popup-title {
  font-size: 1.2em; /* Consistent font size */
  font-weight: 600; /* Consistent font weight */
  margin: 0; /* Remove default margin */
  color: #007bff; /* Primary accent color */
  flex-grow: 1; /* Allows title to take available space */
  text-align: left; /* Align title to left */
}

/* --- ICON STYLING --- */

/* Base style for all icons within buttons (like action-btn i) */
.close-btn { /* This class is now the sole style for ALL close buttons */
  background: none;
  border: none;
  font-size: 1.2em; /* Consistent icon size */
  padding: 5px 8px; /* Consistent padding for clickable area */
  cursor: pointer;
  transition: transform 0.1s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white; /* Default color for the icon itself */
}

/* Hover effect for all close buttons */
.close-btn:hover {
  transform: scale(1.1); /* Subtle grow effect */
}

.close-btn i {
  color: white; /* Ensure the icon itself is white by default */
  transition: color 0.2s ease;
}

.close-btn:hover i {
  color: #007bff !important; /* Consistent blue on hover */
}


/* .popup-buttons div is now removed from the HTML for terrainProfileStats */
/* The styles for .action-btn.close-btn-popup and .action-btn.delete-btn-popup are removed from here */


.popup-content {
  margin-bottom: 15px;
  text-align: left; /* Align content text to left for better readability */
  color: rgba(255, 255, 255, 0.9); /* Default content text color */
  font-size: 0.95em; /* Consistent content font size */
}

.popup-content p {
  font-size: 1em;
  line-height: 1.5;
  margin-bottom: 0; /* Adjust as needed */
}

.popup-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 5px;
  font-size: 0.95em; /* Consistent with tool-operation-title */
  text-align: left;
}

.info-label {
  font-weight: 500; /* Consistent with tool-operation-title */
  color: rgba(255, 255, 255, 0.8); /* Slightly less opaque for label */
}

.info-value {
  color: rgba(255, 255, 255, 0.95); /* Brighter for value */
  text-align: right;
  word-break: break-word;
}

/* Updated Styles for confirmation and action buttons - Mimicking .action-btn */
.popup-actions {
  margin-top: 15px;
  display: flex;
  justify-content: center;
  gap: 20px;
}

/* Keep these .action-btn styles as they are for the confirmation/viewshed forms,
   as they are already similar to MeasurementHistory's button styles (not icon styles) */
.action-btn {
  padding: 8px 18px;
  border-radius: 5px; /* Slightly less rounded than history items */
  cursor: pointer;
  font-size: 0.95em; /* Consistent font size */
  font-weight: 500; /* Consistent font weight */
  transition: all 0.2s ease-in-out;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 90px;
}

.btn-secondary {
  background-color: rgba(45, 45, 45, 0.8); /* Mimic history-item background */
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.1); /* Mimic history-item border */
}

.btn-secondary:hover {
  background-color: rgba(60, 60, 60, 0.9); /* Mimic history-item hover */
  border-color: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px); /* Slight lift on hover */
}

.btn-danger {
  background-color: #FF6600; /* Consistent orange for delete actions */
  color: white;
  border: 1px solid #FF6600;
}

.btn-danger:hover {
  background-color: #FF9933; /* Lighter orange on hover */
  border-color: #FF9933;
  transform: translateY(-2px); /* Subtle lift */
}

.close-popup-btn {
  margin-top: 10px;
  width: 100%;
  background-color: #007bff; /* Primary blue for main action */
  color: white;
  border: 1px solid #007bff;
}

.close-popup-btn:hover {
  background-color: #0056b3; /* Darker blue on hover */
  border-color: #0056b3;
  transform: translateY(-2px); /* Subtle lift */
}

/* Styles for the new viewshed form elements */
.viewshed-form-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 0;
}

.form-label {
  font-size: 0.9em;
  color: rgba(255, 255, 255, 0.9);
  text-align: left;
  margin-bottom: 2px;
  font-weight: 500; /* Consistent with other labels */
}

.form-input,
.form-select {
  width: 100%;
  padding: 8px;
  border-radius: 5px;
  border: 1px solid rgba(255, 255, 255, 0.1); /* Softer border */
  background-color: rgba(0, 0, 0, 0.3); /* Transparent dark background */
  color: white;
  font-size: 1em;
  box-sizing: border-box;
}

.form-input:focus,
.form-select:focus {
  outline: none;
  border-color: #007bff; /* Primary blue focus */
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25); /* Soft blue glow */
}

.form-select option {
  background-color: #333; /* Darker background for options */
  color: white;
}

.btn-primary {
  background-color: #007bff;
  color: white;
  border: 1px solid #007bff;
}

.btn-primary:hover {
  background-color: #0056b3;
  border-color: #0056b3;
  transform: translateY(-2px); /* Subtle lift */
}

/* NEW: Styles for Terrain Profile section */
.graph-container {
  background: #111; /* Darker background for the graph area */
  border: 1px solid rgba(255, 255, 255, 0.1); /* Subtle border */
  border-radius: 4px;
  padding: 0;
  overflow: hidden;
  margin-bottom: 1rem; /* Increased margin for better separation */
}

.elevation-graph {
  width: 100%;
  height: 240px; /* Consistent height for the graph */
}

/* Text inside SVG graph */
.elevation-graph text {
  fill: rgba(255, 255, 255, 0.7); /* Lighter text color for graph labels */
  font-size: 14px;
  font-family: 'Poppins', sans-serif; /* Apply Poppins to SVG text */
}

.elevation-graph line {
  stroke: rgba(255, 255, 255, 0.15); /* Softer grid lines */
  stroke-width: 0.5px;
}

.elevation-graph polyline {
  stroke: #4ade80; /* Your existing green for the line */
  stroke-width: 2.5px;
}

.stats.popup-content { /* Combine with popup-content for consistent padding/margins */
  margin-bottom: 0; /* Adjust as needed */
  text-align: left; /* Ensure stats align left */
}

/* Custom scrollbar for better aesthetics within popup content */
.unified-popup::-webkit-scrollbar {
  width: 8px;
}

.unified-popup::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05); /* Lighter track */
  border-radius: 4px;
}

.unified-popup::-webkit-scrollbar-thumb {
  background-color: rgba(0, 123, 255, 0.5); /* Semi-transparent blue thumb */
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.unified-popup::-webkit-scrollbar-thumb:hover {
  background-color: rgba(0, 123, 255, 0.7);
}
</style>