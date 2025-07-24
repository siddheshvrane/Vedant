<template>
  <div class="terrain-profile-popup">
    <div class="graph-wrapper">
      <!-- Y-axis labels -->
      <div class="y-axis-labels">
        <div
          v-for="(y, i) in yGrid"
          :key="'ylabel-' + i"
          class="y-label"
          :style="{ top: `${y.y}px` }">
          {{ y.label }} m
        </div>
      </div>

      <!-- SVG Graph -->
      <div class="svg-container">
        <svg viewBox="0 0 1000 200" class="elevation-graph">
          <g v-for="(y, i) in yGrid" :key="'y-' + i">
            <line :y1="y.y" :y2="y.y" x1="0" x2="1000" />
          </g>

          <g v-for="(x, i) in xGrid" :key="'x-' + i">
            <line :x1="x.x" :x2="x.x" y1="0" y2="200" />
          </g>

          <polyline :points="svgPolyline" />
        </svg>

        <!-- External X-axis labels below graph -->
        <div class="x-axis-labels">
          <div
            class="x-label"
            v-for="(x, i) in xGrid"
            :key="'xlabel-' + i"
            :style="{ left: `${x.x}px` }">
            {{ x.label }} km
          </div>
        </div>

        <div class="x-axis-title">Distance (km)</div>
      </div>

      <!-- Y-axis title -->
      <div class="y-axis-title">Elevation (m)</div>
    </div>

    <!-- Stats Section -->
    <div class="stats-grid">
      <div class="stat-item">
        <span class="info-label">Total Distance:</span>
        <span class="info-value">
          {{ (totalDistance / 1000).toFixed(2) }} km
        </span>
      </div>
      <div class="stat-item">
        <span class="info-label">Min Elevation:</span>
        <span class="info-value">{{ minHeight.toFixed(1) }} m</span>
      </div>
      <div class="stat-item">
        <span class="info-label">Max Elevation:</span>
        <span class="info-value">{{ maxHeight.toFixed(1) }} m</span>
      </div>
      <div class="stat-item">
        <span class="info-label">Elevation Gain:</span>
        <span class="info-value">
          {{ (maxHeight - minHeight).toFixed(1) }} m
        </span>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "TerrainProfileStats",
  props: {
    profile: { type: Array, required: true },
    onRemoveProfile: { type: Function, required: false },
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
      const count = 7; // fewer labels for same spacing
      const labels = [];
      const padding = 30; // to prevent overflow
      const usableWidth = 1000 - 2 * padding;
      const step = this.totalDistance / (count - 1);

      for (let i = 0; i < count; i++) {
        const x = padding + (i / (count - 1)) * usableWidth;
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
};
</script>

<style scoped>
.terrain-profile-popup {
  background: #111;
  border-radius: 8px;
  padding: 10px 20px;
  color: white;
  max-width: 1200px;
  margin: 0 auto;
}

.graph-wrapper {
  display: flex;
  position: relative;
  padding-left: 60px;
  margin-bottom: 40px;
}

.y-axis-labels {
  position: absolute;
  left: 0;
  top: 0;
  height: 200px;
  width: 60px;
  font-size: 12px;
  color: white;
}

.y-label {
  position: absolute;
  left: 0;
  transform: translateY(-50%);
}

.y-axis-title {
  position: absolute;
  top: 50%;
  left: -50px;
  transform: rotate(-90deg) translateY(-50%);
  transform-origin: center;
  font-size: 13px;
  color: white;
  white-space: nowrap;
}

.svg-container {
  flex-grow: 1;
  position: relative;
}

.elevation-graph {
  width: 100%;
  height: 200px;
}

.elevation-graph line {
  stroke: rgba(255, 255, 255, 0.2);
  stroke-width: 0.5;
}

.elevation-graph polyline {
  stroke: #4ade80;
  stroke-width: 2.5;
  fill: none;
}

.x-axis-labels {
  display: flex;
  position: absolute;
  width: 1000px;
  top: 210px;
  left: 0;
  height: 20px;
  pointer-events: none;
}

.x-label {
  position: absolute;
  transform: translateX(-50%);
  font-size: 12px;
  color: white;
  white-space: nowrap;
  max-width: 60px;
  text-align: center;
}

.x-axis-title {
  text-align: center;
  font-size: 13px;
  color: white;
  margin-top: 28px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px 20px;
  margin-top: 20px;
  font-size: 13px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
}

.info-label {
  font-weight: 500;
}

.info-value {
  color: #ddd;
}
</style>