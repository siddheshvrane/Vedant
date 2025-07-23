<template>
  <div>
    <div class="graph-container">
      <svg viewBox="0 0 1000 300" class="elevation-graph">
        <!-- Y-axis -->
        <g v-for="(y, i) in yGrid" :key="'y-' + i">
          <line
            :y1="y.y"
            :y2="y.y"
            x1="0"
            x2="1000"
            stroke="#444"
            stroke-width="0.5" />
          <text x="10" :y="y.y - 4">{{ y.label }} m</text>
        </g>

        <!-- X-axis -->
        <g v-for="(x, i) in xGrid" :key="'x-' + i">
          <line
            :x1="x.x"
            :x2="x.x"
            y1="0"
            y2="200"
            stroke="#444"
            stroke-width="0.5" />
          <text :x="x.x" y="270" text-anchor="middle">{{ x.label }} km</text>
        </g>

        <!-- Profile Line -->
        <polyline
          :points="svgPolyline"
          fill="none"
          stroke="#4ade80"
          stroke-width="3.5" />
      </svg>
    </div>

    <div class="stats popup-content">
      <p class="popup-item">
        <span class="info-label">Total Distance:</span>
        <span class="info-value"
          >{{ (totalDistance / 1000).toFixed(2) }} km</span
        >
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
        <span class="info-value"
          >{{ (maxHeight - minHeight).toFixed(1) }} m</span
        >
      </p>
    </div>

    <div class="popup-actions">
      <button @click="handleRemoveProfile" class="btn btn-danger action-btn">
        Delete Profile
      </button>
    </div>
  </div>
</template>

<script>
import { getToolState } from "../../../components/Menu/SubSidebars/BasicTools/tool-helpers/tools-helpers.js";

export default {
  name: "TerrainProfileStats",
  props: {
    profile: {
      type: Array,
      required: true,
    },
    terrainProfileEntity: {
      type: Object,
      default: null,
    },
    onRemoveProfile: {
      type: Function,
      required: true,
    },
    onClose: {
      type: Function,
      required: true,
    },
  },
  computed: {
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
      const stepX =
        this.profile.length > 1 ? width / (this.profile.length - 1) : 0;
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
        const label = ((i * step) / 1000).toFixed(2); // KM
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
  methods: {
    handleRemoveProfile() {
      const { viewer } = getToolState();
      if (
        viewer &&
        this.terrainProfileEntity &&
        viewer.entities.contains(this.terrainProfileEntity)
      ) {
        viewer.entities.remove(this.terrainProfileEntity);
        console.log("Terrain profile entity removed from viewer.");
      }
      this.$emit("remove-profile-and-hide");
      this.onRemoveProfile();
      this.onClose();
    },
  },
};
</script>

<style scoped>
.graph-container {
  background: #111;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 10px;
  overflow: hidden;
  margin-bottom: 1.5rem;
}

.elevation-graph {
  width: 100%;
  height: 300px;
}

.elevation-graph text {
  fill: rgba(255, 255, 255, 0.9);
  font-size: 30px; /* Slightly increased */
  font-family: "Poppins", sans-serif;
}

.elevation-graph line {
  stroke: rgba(255, 255, 255, 0.15);
  stroke-width: 0.5px;
}

.elevation-graph polyline {
  stroke: #4ade80;
  stroke-width: 3.5px;
}

.stats.popup-content {
  font-size: 1.1em;
  padding: 10px 20px;
  text-align: left;
}

.popup-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
}

.info-label {
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
}

.info-value {
  color: rgba(255, 255, 255, 0.95);
  text-align: right;
  word-break: break-word;
}

.popup-actions {
  margin-top: 20px;
  display: flex;
  justify-content: center;
  gap: 20px;
}

.action-btn {
  padding: 10px 22px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1.1em;
  font-weight: 500;
  transition: all 0.2s ease-in-out;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 120px;
}

.btn-danger {
  background-color: #ff6600;
  color: white;
  border: 1px solid #ff6600;
}

.btn-danger:hover {
  background-color: #ff9933;
  border-color: #ff9933;
  transform: translateY(-2px);
}
</style>
