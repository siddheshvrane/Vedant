<template>
  <div class="shadow-panel">
    <h3 class="panel-title">Shadow Analysis Settings</h3>

    <!-- Date Picker -->
    <div class="form-group">
      <label for="date">Select Date:</label>
      <input type="date" v-model="selectedDate" />
    </div>

    <!-- Shadow Time Picker -->
    <div class="form-group">
      <label for="shadowTime">Shadow Time:</label>
      <input
        type="time"
        id="shadowTime"
        step="1800"
        v-model="shadowTimeString" />
    </div>

    <!-- Dropdown Menu -->
    <div class="form-group">
      <label for="season">Select Seasonal Date:</label>
      <select v-model="selectedSeason">
        <option disabled value="">-- None --</option>
        <option value="march">21 March</option>
        <option value="june">21 June</option>
        <option value="september">21 September</option>
        <option value="december">21 December</option>
        <option value="average">Average</option>
      </select>
    </div>

    <!-- Load / Clear Buttons -->
    <button class="load-btn" @click="loadBuildings">Load Buildings</button>
    <button class="load-btn clear-btn" @click="clearBuildings">
      Clear Buildings
    </button>

    <!-- Chart containers -->
    <div id="container1" style="margin-top: 2rem"></div>
    <div id="container2" style="margin-top: 1rem"></div>
  </div>
</template>

<script>
import {
  setupRooftopSolarInsulationTool,
  updateShadowTime,
  clearRooftopSolarInsulation,
  updateBuildingColorsForSeason,
} from "./RooftopSolarInsulationCore";
import { getToolState } from "../../../../BasicTools/tool-helpers/tools-helpers";

export default {
  name: "RooftopPanel",
  props: {
    onClose: Function,
    shadowTime: Number,
  },
  data() {
    return {
      selectedDate: "",
      selectedSeason: "", // fully local
      shadowTimeString: this.formatTime(this.shadowTime ?? 12),
      highRes: false,
      showBuildings: false,
    };
  },
  mounted() {
    // Initialize date field based on season or today
    if (this.selectedSeason && this.selectedSeason !== "average") {
      const fixedDate = this.getDateForSeason(this.selectedSeason);
      if (fixedDate) this.selectedDate = this.formatDate(fixedDate);
    } else {
      this.selectedDate = this.getTodayString();
    }
    this.updateShadow();
  },
  watch: {
    selectedDate() {
      this.updateShadow();
    },
    selectedSeason(newSeason) {
      const dateForSeason = this.getDateForSeason(newSeason);
      this.selectedDate = dateForSeason
        ? this.formatDate(dateForSeason)
        : this.getTodayString();
      this.updateShadow();
    },
    shadowTimeString() {
      this.updateShadow();
    },
  },
  methods: {
    getTodayString() {
      return this.formatDate(new Date());
    },
    formatDate(date) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    },
    parseDateString(s) {
      if (!s) return new Date();
      const [y, m, d] = s.split("-").map(Number);
      return new Date(y, m - 1, d);
    },
    formatTime(hourDecimal) {
      const hour = Math.floor(hourDecimal);
      const minute = Math.round((hourDecimal - hour) * 60);
      return `${String(hour).padStart(2, "0")}:${String(minute).padStart(
        2,
        "0"
      )}`;
    },
    getDateForSeason(season) {
      const year = new Date().getFullYear();
      switch (season) {
        case "march":
          return new Date(year, 2, 21);
        case "june":
          return new Date(year, 5, 21);
        case "september":
          return new Date(year, 8, 21);
        case "december":
          return new Date(year, 11, 21);
        default:
          return null;
      }
    },
    clearBuildings() {
      clearRooftopSolarInsulation();
    },
    loadBuildings() {
      if (!this.selectedSeason) {
        alert("Please select a season before loading.");
        return;
      }
      const { viewer } = getToolState();
      if (!viewer) {
        console.warn("Viewer not ready.");
        return;
      }
      clearRooftopSolarInsulation();

      const [hourStr, minuteStr] = this.shadowTimeString.split(":");
      const hour = parseInt(hourStr, 10) || 0;
      const minute = parseInt(minuteStr, 10) || 0;
      const hourDecimal = hour + minute / 60;
      const selectedDateObj = this.parseDateString(this.selectedDate);

      setupRooftopSolarInsulationTool(viewer, {
        selectedDate: selectedDateObj,
        shadowTime: hourDecimal,
        selectedSeason: this.selectedSeason,
        highRes: this.highRes,
        showBuildings: this.showBuildings,
      });
    },
    updateShadow() {
      if (!this.selectedSeason) return;

      const [hourStr, minuteStr] = (this.shadowTimeString || "12:00").split(
        ":"
      );
      const hour = parseInt(hourStr, 10) || 0;
      const minute = parseInt(minuteStr, 10) || 0;
      const hourDecimal = hour + minute / 60;
      const dateObj = this.parseDateString(this.selectedDate);

      updateShadowTime(hourDecimal, dateObj, this.selectedSeason);
      updateBuildingColorsForSeason(this.selectedSeason);
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
input[type="time"] {
  background-color: #2b2b2b;
  border: 1px solid #444;
  color: #f0f0f0;
  padding: 0.6rem 1rem;
  border-radius: 0.5rem;
  font-size: 1rem;
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
.clear-btn {
  background-color: #e74c3c;
  margin-top: 1rem;
}
</style>
