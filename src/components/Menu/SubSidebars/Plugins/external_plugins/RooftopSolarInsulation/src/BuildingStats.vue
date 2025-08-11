<template>
  <div class="building-popup">
    <div ref="chartContainer" class="chart-container"></div>

    <div class="info-table">
      <table>
        <thead>
          <tr>
            <th colspan="2">Building Info</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Latitude</td>
            <td>{{ localData.latitude }}</td>
          </tr>
          <tr>
            <td>Longitude</td>
            <td>{{ localData.longitude }}</td>
          </tr>
          <tr>
            <td>Height (m)</td>
            <td>{{ localData.height }}</td>
          </tr>
          <tr>
            <td>March</td>
            <td>{{ localData.March }}%</td>
          </tr>
          <tr>
            <td>June</td>
            <td>{{ localData.June }}%</td>
          </tr>
          <tr>
            <td>September</td>
            <td>{{ localData.September }}%</td>
          </tr>
          <tr>
            <td>December</td>
            <td>{{ localData.December }}%</td>
          </tr>
          <tr>
            <td>Average</td>
            <td>{{ localData.Average }}%</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
import Highcharts from "highcharts";
import { eventBus } from "../../../evenBus"; // adjust relative path as needed
import { nextTick } from "vue";

export default {
  name: "BuildingStats",
  props: {
    data: {
      type: Object,
      required: true,
      default: () => ({}),
    },
    onClose: {
      type: Function,
      required: true,
    },
  },

  data() {
    return {
      localData: this.data,
      chart: null,
    };
  },

  watch: {
    data: {
      deep: true,
      immediate: true,
      handler(newVal) {
        console.log("BuildingStats received data:", newVal);
        this.localData = newVal;
        nextTick(() => this.updateChart());
      },
    },
  },

  mounted() {
    nextTick(() => {
      this.renderChart();
    });
    eventBus.on("update-building-stats", this.handleExternalUpdate);
  },

  beforeUnmount() {
    eventBus.off("update-building-stats", this.handleExternalUpdate);
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  },

  methods: {
    handleExternalUpdate(newData) {
      console.log("External update received:", newData);
      this.localData = newData;
      this.updateChart();
    },

    findShadowTimeIndex(times, shadowTime) {
      // Try to find index in times matching the hour shadowTime
      // Times are strings like "5:15", "6:15", so parse hour
      if (!times || !times.length) return -1;

      for (let i = 0; i < times.length; i++) {
        const t = times[i];
        const hourStr = t.split(":")[0];
        const hour = parseInt(hourStr, 10);
        if (hour === shadowTime) return i;
      }
      return -1;
    },

    renderChart() {
      if (!this.$refs.chartContainer) {
        console.warn("Chart container not found");
        return;
      }

      if (this.chart) {
        this.chart.destroy();
        this.chart = null;
      }

      const times = this.localData?.times || [];
      const march = this.localData?.MarchHourly || [];
      const june = this.localData?.JuneHourly || [];
      const sept = this.localData?.SeptemberHourly || [];
      const dec = this.localData?.DecemberHourly || [];
      const shadowTime = this.localData.shadowTime ?? 12; // Default to noon if not set

      const shadowTimeIndex = this.findShadowTimeIndex(times, shadowTime);

      const plotLines = [];
      if (shadowTimeIndex >= 0) {
        plotLines.push({
          id: "shadowTimeLine",
          color: "#FFFF00",
          width: 2,
          value: shadowTimeIndex,
          label: {
            text: `Shadow Time: ${shadowTime}:00`,
            style: { color: "#FFFF00", fontWeight: "bold" },
            rotation: 0,
            verticalAlign: "top",
            y: -10,
          },
          zIndex: 5,
        });
      }

      this.chart = Highcharts.chart(this.$refs.chartContainer, {
        chart: {
          type: "spline",
          backgroundColor: "#222",
          style: { fontFamily: "Poppins, sans-serif" },
        },
        title: {
          text: "Open Area % Throughout the Day",
          style: { color: "#f0f0f0" },
        },
        xAxis: {
          categories: times,
          title: { text: "Hours", style: { color: "#f0f0f0" } },
          labels: { style: { color: "#f0f0f0" } },
          plotLines,
        },
        yAxis: {
          max: 100,
          title: {
            text: "Open area percentage (%)",
            style: { color: "#f0f0f0" },
          },
          labels: { style: { color: "#f0f0f0" } },
          gridLineColor: "#444",
        },
        tooltip: {
          shared: true,
          crosshairs: true,
          valueSuffix: "%",
        },
        legend: {
          itemStyle: { color: "#f0f0f0" },
        },
        plotOptions: {
          spline: {
            marker: {
              radius: 4,
              lineColor: "#666",
              lineWidth: 1,
            },
          },
        },
        series: [
          { name: "21st March", data: march, color: "red" },
          { name: "21st June", data: june, color: "orange" },
          { name: "21st Sep", data: sept, color: "blue" },
          { name: "21st Dec", data: dec, color: "green" },
        ],
      });
    },

    updateChart() {
      if (!this.chart) {
        this.renderChart();
        return;
      }

      const times = this.localData?.times || [];
      this.chart.xAxis[0].setCategories(times);

      const shadowTime = this.localData.shadowTime ?? 12;
      this.chart.xAxis[0].removePlotLine("shadowTimeLine");
      this.chart.xAxis[0].addPlotLine({
        id: "shadowTimeLine",
        color: "#FFFF00",
        width: 2,
        value: Math.min(shadowTime, times.length - 1),
        label: {
          text: `Shadow Time: ${shadowTime}:00`,
          style: { color: "#FFFF00", fontWeight: "bold" },
          rotation: 0,
          verticalAlign: "top",
          y: -10,
        },
        zIndex: 5,
      });

      const seriesData = [
        this.localData?.MarchHourly || [],
        this.localData?.JuneHourly || [],
        this.localData?.SeptemberHourly || [],
        this.localData?.DecemberHourly || [],
      ];

      // Update each series with new data
      this.chart.series.forEach((series, idx) => {
        series.setData(seriesData[idx], false);
      });

      this.chart.redraw();
    },
  },
};
</script>

<style scoped>
.building-popup {
  padding: 1rem;
  color: #f0f0f0;
  max-width: 60rem;
  background-color: #222;
  border-radius: 1rem;
  border: 1px solid #555;
}

.chart-container {
  width: 100%;
  height: 400px;
  margin-bottom: 1rem;
}

.info-table table {
  width: 100%;
  border-collapse: collapse;
  color: #f0f0f0;
}

.info-table thead {
  background-color: #333;
}

.info-table th,
.info-table td {
  border: 1px solid #555;
  padding: 0.5rem;
  text-align: left;
}
</style>
