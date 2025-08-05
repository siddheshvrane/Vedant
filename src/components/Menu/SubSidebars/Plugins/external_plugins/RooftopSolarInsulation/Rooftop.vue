<template>
  <div class="shadow-panel">
    <h3 class="panel-title">Shadow Analysis Settings</h3>

    <!-- Date Picker -->
    <div class="form-group">
      <label for="date">Select Date:</label>
      <input type="date" v-model="selectedDate" />
    </div>

    <!-- Shadow Time Scroll Bar -->
    <div class="form-group">
      <label for="shadowTime">Shadow Time: {{ shadowTime }} hrs</label>
      <input
        type="range"
        id="shadowTime"
        min="0"
        max="24"
        step="0.5"
        v-model="shadowTime"
        @input="handleShadowTimeChange" />
    </div>

    <!-- Dropdown Menu -->
    <div class="form-group">
      <label for="season">Select Seasonal Date:</label>
      <select v-model="selectedSeason">
        <option value="march">21 March</option>
        <option value="june">21 June</option>
        <option value="september">21 September</option>
        <option value="december">21 December</option>
        <option value="average">Average</option>
      </select>
    </div>

    <!-- Toggle Buttons -->
    <div class="toggle-group">
      <label>
        <input type="checkbox" v-model="highRes" />
        High Resolution Satellite Image
      </label>
    </div>

    <div class="toggle-group">
      <label>
        <input type="checkbox" v-model="showBuildings" />
        Buildings
      </label>
    </div>

    <!-- Load Buildings Button -->
    <button class="load-btn" @click="loadBuildings">Load Buildings</button>

    <!-- Chart containers -->
    <div id="container1" style="margin-top: 2rem"></div>
    <div id="container2" style="margin-top: 1rem"></div>
    <button class="load-btn clear-btn" @click="clearBuildings">
      Clear Buildings
    </button>
  </div>
  <!-- Clear Buildings Button -->
</template>

<script>
import {
  setupRooftopSolarInsulationTool,
  updateShadowTime,
} from "./RooftopSolarInsulationCore";
import { getToolState } from "../../../BasicTools/tool-helpers/tools-helpers";
import { clearRooftopSolarInsulation } from "./RooftopSolarInsulationCore";

export default {
  name: "rooftop",
  props: {
    onClose: Function,
    selectedSeason: String,
    shadowTime: Number,
  },
  data() {
    return {
      selectedDate: new Date(), // ← today's date by default
      selectedSeason: this.selectedSeason || "march",
      shadowTime: this.shadowTime ?? 12,
      highRes: false,
      showBuildings: false,
    };
  },
  methods: {
    clearBuildings() {
      clearRooftopSolarInsulation();
    },
    loadBuildings() {
      const { viewer } = getToolState();
      if (!viewer) {
        console.warn("Viewer not ready.");
        return;
      }
      clearRooftopSolarInsulation();
      setupRooftopSolarInsulationTool(viewer, {
        selectedDate: new Date(this.selectedDate), // ✅ ensure it's a valid Date
        shadowTime: this.shadowTime,
        selectedSeason: this.selectedSeason,
        highRes: this.highRes,
        showBuildings: this.showBuildings,
      });
    },
    handleShadowTimeChange() {
      if (this.selectedDate) {
        updateShadowTime(this.shadowTime);
      }
    },
    getToday() {
      const d = new Date();
      return d.toISOString().split("T")[0]; // 'YYYY-MM-DD'
    },
  },
};
</script>

<style scoped>
.shadow-panel {
  background-color: #1f1f1f;
  color: #f0f0f0;
  padding: 2rem;
  border-radius: 1rem;
  max-width: 30rem;
  margin: auto;
  box-shadow: 0 0 1rem rgba(0, 0, 0, 0.4);
  font-family: "Segoe UI", sans-serif;
  font-size: 1rem;
}

.panel-title {
  text-align: center;
  margin-bottom: 2rem;
  font-weight: 600;
  font-size: 1.5rem;
}

.form-group {
  margin-bottom: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

input[type="date"],
select,
input[type="range"] {
  background-color: #2b2b2b;
  border: 1px solid #444;
  color: #f0f0f0;
  padding: 0.6rem 1rem;
  border-radius: 0.5rem;
  font-size: 1rem;
}

input[type="range"] {
  height: 1.2rem;
}

input[type="range"]::-webkit-slider-thumb,
input[type="range"]::-moz-range-thumb {
  background: #4caf50;
}

.toggle-group {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
  font-size: 1rem;
}

.toggle-group input[type="checkbox"] {
  width: 1rem;
  height: 1rem;
  accent-color: #4caf50;
}

.load-btn {
  margin-top: 1.5rem;
  padding: 0.75rem 1rem;
  width: 100%;
  font-size: 1.1rem;
  font-weight: 600;
  background-color: #4caf50;
  color: #ffffff;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: background 0.3s ease;
}

.load-btn:hover {
  background-color: #45a049;
}

.clear-btn {
  background-color: #e74c3c;
  margin-top: 1rem;
}
.clear-btn:hover {
  background-color: #c0392b;
}
</style>
