import { Chart, registerables } from "chart.js";
Chart.register(...registerables);

export class ChartWrapper {
  chart: Chart;

  /**
     * @param {*} ctx 
     * @param {*} datasets eg.
          {
            "Dataset 1": {
                borderColor: "blue",
            },
            "Dataset 2": {
                borderColor: "red",
            }
          }
     * @param {*} scales eg. {
          x: { title: { display: true, text: "Time" } },
          y: { title: { display: true, text: "Freq" }, min: 0, max: 150 },
        }
     */

  constructor(ctx, datasets, options) {
    this.chart = new Chart(ctx, {
      type: "line",
      data: {
        datasets: Object.keys(datasets).map((k) => ({
          label: k,
          data: {},
          ...datasets[k],
        })),
      },
      // https://www.chartjs.org/docs/latest/configuration/elements.html
      options: {
        maintainAspectRatio: false,
        plugins: {
          decimation: false, // https://www.chartjs.org/docs/latest/configuration/decimation.html
        },
        borderWidth: 1,
        fill: false,
        spanGaps: true, // Avoid segmentation for continuous data
        parsing: false, // Faster data processing
        normalized: true, // Optimized for sorted, consistent data
        tension: 0, // Straight lines for better performance
        animation: false, // Disable for faster real-time updates,
        //scales,
        // https://www.chartjs.org/docs/latest/axes/
        // https://stackoverflow.com/questions/74525780/chart-js-parsing-data-with-xaxiskey
        ...options,
      },
    });
  }

  /**
   *
   * @param {*} dataPointsMap
   * @returns
   */
  update(dataPointsMap) {
    if (!this.chart) {
      return;
    }
    for (const k in dataPointsMap) {
      const ds = this.chart.data.datasets.find((ds) => ds.label === k);
      if (ds) {
        ds.data = dataPointsMap[k];
      }
    }
    this.chart.update("none");
  }
}
