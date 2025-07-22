<template>
  <div class="sub-sidebar-panel poppins-font">
    <div class="sub-sidebar-header">
      <button @click="$emit('back-to-main-menu')" class="btn btn-link text-white back-btn">
        <i class="fas fa-arrow-left"></i>
      </button>
      <h5 class="sub-sidebar-title">Visualization Mode</h5>
      <button @click="$emit('close-all-sidebars')" class="btn btn-link text-white close-btn">
        <i class="fas fa-times"></i>
      </button>
    </div>
    <div class="sub-sidebar-body">
      <hr class="sidebar-divider mb-4">

      <div class="form-group mb-4">
        <label class="form-label mb-2">Modes:</label>
        <div class="form-check">
          <input
            class="form-check-input"
            type="radio"
            id="radio2DMode"
            value="2D"
            v-model="selectedMode"
            @change="emitModeChange"
          >
          <label class="form-check-label" for="radio2DMode">2D Mode</label>
        </div>
        <div class="form-check">
          <input
            class="form-check-input"
            type="radio"
            id="radio3DGlobe"
            value="3D"
            v-model="selectedMode"
            @change="emitModeChange"
          >
          <label class="form-check-label" for="radio3DGlobe">2.5D (3D Globe)</label>
        </div>
      </div>

      <hr class="sidebar-divider mb-4">

      <div class="form-group mb-3">
        <label class="form-label d-block mb-2">Clock Time:</label>
        <div class="d-flex justify-content-between align-items-center">
          <div class="select-wrapper me-2">
            <select v-model="selectedHour" @change="emitTimeChange" class="form-select time-select">
              <option v-for="hour in hoursOptions" :key="hour" :value="hour">{{ hour }}</option>
            </select>
            <i class="fas fa-chevron-down dropdown-icon"></i>
          </div>

          <div class="select-wrapper me-2">
            <select v-model="selectedMinute" @change="emitTimeChange" class="form-select time-select">
              <option v-for="minute in minutesOptions" :key="minute" :value="minute">{{ minute }}</option>
            </select>
            <i class="fas fa-chevron-down dropdown-icon"></i>
          </div>

          <div class="select-wrapper">
            <select v-model="selectedAmPm" @change="emitTimeChange" class="form-select time-select">
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </select>
            <i class="fas fa-chevron-down dropdown-icon"></i>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
// Ensure this path is correct based on your project structure
import { MapService } from '../../../../services/MapService.js'; 

export default {
  name: 'VisualizationSidebar',
  data() {
    // Get the initial time from MapService
    const initialTime = MapService.getCurrentGlobeClockTime();

    return {
      selectedMode: '3D', 
      modeSubscription: null,
      selectedHour: initialTime.hour, // Use persisted time
      selectedMinute: initialTime.minute, // Use persisted time
      selectedAmPm: initialTime.ampm, // Use persisted time
      timeSubscription: null, // NEW: Subscription for time updates from MapService
    };
  },
  emits: ['close-all-sidebars', 'back-to-main-menu', 'update-visualization-mode', 'update-clock-time'],
  
  computed: {
    hoursOptions() {
      // Generates hours from 01 to 12
      return Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
    },
    minutesOptions() {
      // Generates minutes with a 5-minute gap (00, 05, 10, ..., 55)
      return Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));
    },
  },

  mounted() {
    this.modeSubscription = MapService.visualizationModeChanged$.subscribe(mode => {
      if (this.selectedMode !== mode) {
        this.selectedMode = mode;
      }
    });

    // NEW: Subscribe to MapService's currentGlobeClockTime$ to keep UI in sync
    this.timeSubscription = MapService.currentGlobeClockTime$.subscribe(time => {
        if (this.selectedHour !== time.hour || 
            this.selectedMinute !== time.minute || 
            this.selectedAmPm !== time.ampm) {
            this.selectedHour = time.hour;
            this.selectedMinute = time.minute;
            this.selectedAmPm = time.ampm;
        }
    });

    // Ensure the initial visualization mode is set on the globe
    MapService.setVisualizationMode(this.selectedMode); 
    
    // Set the initial time on the globe when mounted.
    // This will use the time retrieved from MapService in data(), ensuring consistency.
    MapService.setGlobeClockTime({ 
      hour: this.selectedHour,
      minute: this.selectedMinute,
      ampm: this.selectedAmPm
    });
  },

  beforeUnmount() {
    if (this.modeSubscription) {
      this.modeSubscription.unsubscribe();
    }
    if (this.timeSubscription) { // NEW: Unsubscribe from time updates
        this.timeSubscription.unsubscribe();
    }
  },

  methods: {
    emitModeChange() {
      MapService.setVisualizationMode(this.selectedMode);
      this.$emit('update-visualization-mode', this.selectedMode); 
    },
    emitTimeChange() {
      // Dispatch time change to MapService
      MapService.setGlobeClockTime({ 
        hour: this.selectedHour,
        minute: this.selectedMinute,
        ampm: this.selectedAmPm
      });
      // Also emit to parent if parent needs to react, but MapService already handles globe update
      this.$emit('update-clock-time', {
        hour: this.selectedHour,
        minute: this.selectedMinute,
        ampm: this.selectedAmPm
      });
      console.log('Clock Time changed to:', this.selectedHour, this.selectedMinute, this.selectedAmPm);
    }
  }
};
</script>
<style scoped>
/* Your existing styles remain unchanged */
.sub-sidebar-panel {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.poppins-font {
  font-family: 'Poppins', sans-serif;
}

.sub-sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 15px 15px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  background-color: rgba(30, 30, 30, 0);
}

.sub-sidebar-title {
  flex-grow: 1;
  text-align: center;
  margin-bottom: 0;
  font-size: 1.2em;
  color: white;
}

.back-btn {
  font-size: 1em;
  color: white !important;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
}

.back-btn:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.close-btn {
  font-size: 1em;
  color: white !important;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
}

.close-btn:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.sub-sidebar-body {
  flex-grow: 1;
  padding: 20px;
  overflow-y: auto;
  color: white;
  padding-bottom: 50px; /* Added/adjusted padding to ensure space below dropdowns */
}

.form-label {
    color: rgba(255, 255, 255, 0.8);
    margin-bottom: 5px;
}

.form-check-label {
    color: rgba(255, 255, 255, 0.8);
    margin-bottom: 5px;
}

.form-check-input {
    background-color: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    cursor: pointer;
}

.form-check-input:checked {
    background-color: #007bff;
    border-color: #007bff;
}

.sidebar-divider {
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}

/* Styles for dropdowns */
.select-wrapper {
  position: relative;
  display: flex; /* Use flex to align icon */
  align-items: center;
  flex: 1; /* Allow dropdowns to take equal space */
}

.form-select {
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  background-image: none;
  padding-right: 2.5rem; /* Make space for the icon */
}

.dropdown-icon {
  position: absolute;
  right: 1rem;
  top: 50%;
  transform: translateY(-50%);
  color: rgba(255, 255, 255, 0.7);
  pointer-events: none;
  font-size: 0.8em;
}

.time-select {
  background-color: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #fff;
  padding: 0.375rem 0.75rem; /* Adjust padding for better look in small dropdowns */
  height: calc(1.5em + 0.75rem + 2px); /* Standard form control height */
}

.time-select option {
  background-color: #333;
  color: #fff;
}
</style>
