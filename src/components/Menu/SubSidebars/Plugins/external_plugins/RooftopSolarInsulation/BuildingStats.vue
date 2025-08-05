<template>
  <div class="building-popup">
    <div id="building-chart" class="chart-container"></div>

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
            <td>{{ data.latitude }}</td>
          </tr>
          <tr>
            <td>Longitude</td>
            <td>{{ data.longitude }}</td>
          </tr>
          <tr>
            <td>Height (m)</td>
            <td>{{ data.height }}</td>
          </tr>
          <tr>
            <td>March</td>
            <td>{{ data.March }}%</td>
          </tr>
          <tr>
            <td>June</td>
            <td>{{ data.June }}%</td>
          </tr>
          <tr>
            <td>September</td>
            <td>{{ data.September }}%</td>
          </tr>
          <tr>
            <td>December</td>
            <td>{{ data.December }}%</td>
          </tr>
          <tr>
            <td>Average</td>
            <td>{{ data.Average }}%</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
import Highcharts from "highcharts";

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

  mounted() {
    console.log("📊 BuildingStats mounted with data:", this.data);
    this.renderChart();
  },

  methods: {
    renderChart() {
      const times = this.data.times || []; // e.g. ["5:15", "6:15", ..., "18:15"]
      const march = this.data.MarchHourly || [];
      const june = this.data.JuneHourly || [];
      const sept = this.data.SeptemberHourly || [];
      const dec = this.data.DecemberHourly || [];

      Highcharts.chart("building-chart", {
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
          {
            name: "21st March",
            data: march,
            color: "red",
          },
          {
            name: "21st June",
            data: june,
            color: "orange",
          },
          {
            name: "21st Sep",
            data: sept,
            color: "blue",
          },
          {
            name: "21st Dec",
            data: dec,
            color: "green",
          },
        ],
      });
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
