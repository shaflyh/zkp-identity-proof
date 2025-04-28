const fs = require("fs");
const { createCanvas } = require("canvas");
const { Chart } = require("chart.js/auto");

// Load the benchmark results from file
const resultsPath = process.argv[2] || "test/benchmark_results.json";
let results;

try {
  const data = fs.readFileSync(resultsPath, "utf8");
  results = JSON.parse(data);
} catch (error) {
  console.error("Error loading benchmark results: " + error.message);
  process.exit(1);
}

// Create output directory
const outputDir = "./benchmark_charts";
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

// Functions to create charts
async function createGasUsageChart() {
  const canvas = createCanvas(800, 500);
  const ctx = canvas.getContext("2d");

  const functions = Object.keys(results.averages.gasCosts);
  const gasCosts = functions.map((func) =>
    parseInt(results.averages.gasCosts[func])
  );

  const chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: functions,
      datasets: [
        {
          label: "Gas Used",
          data: gasCosts,
          backgroundColor: [
            "rgba(54, 162, 235, 0.7)",
            "rgba(75, 192, 192, 0.7)",
            "rgba(255, 206, 86, 0.7)",
            "rgba(255, 99, 132, 0.7)",
          ],
          borderWidth: 1,
        },
      ],
    },
    options: {
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: "Gas Used",
          },
        },
      },
      plugins: {
        title: {
          display: true,
          text: "Average Gas Usage by Function",
          font: {
            size: 18,
          },
        },
        legend: {
          display: false,
        },
      },
    },
  });

  // Write to file
  const buffer = canvas.toBuffer("image/png");
  fs.writeFileSync(outputDir + "/gas_usage.png", buffer);
  console.log("Gas usage chart saved to " + outputDir + "/gas_usage.png");
}

async function createTxTimeChart() {
  const canvas = createCanvas(800, 500);
  const ctx = canvas.getContext("2d");

  const functions = Object.keys(results.averages.transactionTimes);
  const times = functions.map(
    (func) => results.averages.transactionTimes[func]
  );

  const chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: functions,
      datasets: [
        {
          label: "Time (ms)",
          data: times,
          backgroundColor: [
            "rgba(75, 192, 192, 0.7)",
            "rgba(54, 162, 235, 0.7)",
            "rgba(255, 99, 132, 0.7)",
            "rgba(255, 206, 86, 0.7)",
          ],
          borderWidth: 1,
        },
      ],
    },
    options: {
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: "Transaction Time (ms)",
          },
        },
      },
      plugins: {
        title: {
          display: true,
          text: "Average Transaction Times by Function",
          font: {
            size: 18,
          },
        },
        legend: {
          display: false,
        },
      },
    },
  });

  // Write to file
  const buffer = canvas.toBuffer("image/png");
  fs.writeFileSync(outputDir + "/tx_times.png", buffer);
  console.log("Transaction time chart saved to " + outputDir + "/tx_times.png");
}

async function createGasDistributionChart() {
  const canvas = createCanvas(700, 500);
  const ctx = canvas.getContext("2d");

  const functions = Object.keys(results.averages.gasCosts);
  const gasCosts = functions.map((func) =>
    parseInt(results.averages.gasCosts[func])
  );

  const chart = new Chart(ctx, {
    type: "pie",
    data: {
      labels: functions,
      datasets: [
        {
          data: gasCosts,
          backgroundColor: [
            "rgba(255, 99, 132, 0.7)",
            "rgba(54, 162, 235, 0.7)",
            "rgba(255, 206, 86, 0.7)",
            "rgba(75, 192, 192, 0.7)",
          ],
          borderWidth: 1,
        },
      ],
    },
    options: {
      plugins: {
        tooltip: {
          callbacks: {
            label: function (context) {
              const value = context.raw;
              const total = context.dataset.data.reduce(function (acc, val) {
                return acc + val;
              }, 0);
              const percentage = ((value / total) * 100).toFixed(1);
              return (
                context.label +
                ": " +
                Number(value).toLocaleString() +
                " gas (" +
                percentage +
                "%)"
              );
            },
          },
        },
        title: {
          display: true,
          text: "Gas Cost Distribution",
          font: {
            size: 18,
          },
        },
      },
    },
  });

  // Write to file
  const buffer = canvas.toBuffer("image/png");
  fs.writeFileSync(outputDir + "/gas_distribution.png", buffer);
  console.log(
    "Gas distribution chart saved to " + outputDir + "/gas_distribution.png"
  );
}

async function createThroughputChart() {
  // Only create this chart if we have concurrency results
  if (
    !results.averages.concurrencyResults ||
    Object.keys(results.averages.concurrencyResults).length === 0
  ) {
    console.log("No concurrency results found, skipping throughput chart");
    return;
  }

  const canvas = createCanvas(800, 500);
  const ctx = canvas.getContext("2d");

  const concurrencyLevels = Object.keys(
    results.averages.concurrencyResults
  ).sort((a, b) => parseInt(a) - parseInt(b));

  const throughputData = concurrencyLevels.map((level) => {
    return {
      level: parseInt(level),
      throughput: results.averages.concurrencyResults[level].throughput,
    };
  });

  const chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: throughputData.map(function (item) {
        return "Level " + item.level;
      }),
      datasets: [
        {
          label: "Throughput (tx/s)",
          data: throughputData.map(function (item) {
            return item.throughput;
          }),
          backgroundColor: "rgba(54, 162, 235, 0.2)",
          borderColor: "rgba(54, 162, 235, 1)",
          borderWidth: 2,
          tension: 0.1,
          fill: true,
          pointRadius: 6,
        },
      ],
    },
    options: {
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: "Transactions per Second",
          },
        },
      },
      plugins: {
        title: {
          display: true,
          text: "Throughput by Concurrency Level",
          font: {
            size: 18,
          },
        },
      },
    },
  });

  // Write to file
  const buffer = canvas.toBuffer("image/png");
  fs.writeFileSync(outputDir + "/throughput.png", buffer);
  console.log("Throughput chart saved to " + outputDir + "/throughput.png");
}

// Create summary text file
function createSummaryFile() {
  const summary = [];

  // Basic info
  summary.push("# ZKP IDENTITY CONTRACT BENCHMARK SUMMARY");
  summary.push("Contract Address: " + results.config.contractAddress);
  summary.push(
    "Test Date: " + new Date(results.config.timestamp).toLocaleString()
  );
  summary.push("");

  // Gas costs
  summary.push("## Gas Costs");
  Object.entries(results.averages.gasCosts).forEach(function (entry) {
    var func = entry[0];
    var gas = entry[1];
    summary.push("- " + func + ": " + parseInt(gas).toLocaleString() + " gas");
  });
  summary.push("");

  // Transaction times
  summary.push("## Transaction Times");
  Object.entries(results.averages.transactionTimes).forEach(function (entry) {
    var func = entry[0];
    var time = entry[1];
    summary.push("- " + func + ": " + time.toFixed(2) + " ms");
  });
  summary.push("");

  // Concurrency results
  if (
    results.averages.concurrencyResults &&
    Object.keys(results.averages.concurrencyResults).length > 0
  ) {
    summary.push("## Concurrency Results");
    Object.entries(results.averages.concurrencyResults).forEach(function (
      entry
    ) {
      var level = entry[0];
      var data = entry[1];
      summary.push(
        "- Level " + level + ": " + data.throughput.toFixed(4) + " tx/s"
      );
    });
    summary.push("");
  }

  // Recommendations
  if (results.report && results.report.recommendations) {
    summary.push("## Recommendations");
    results.report.recommendations.forEach(function (rec, i) {
      summary.push(i + 1 + ". " + rec);
    });
  }

  // Write summary to file
  fs.writeFileSync(outputDir + "/benchmark_summary.md", summary.join("\n"));
  console.log("Summary report saved to " + outputDir + "/benchmark_summary.md");
}

// Run all chart generation functions
async function generateAllCharts() {
  console.log("Generating benchmark charts...");

  await createGasUsageChart();
  await createTxTimeChart();
  await createGasDistributionChart();
  await createThroughputChart();
  createSummaryFile();

  console.log("\nAll charts saved to " + outputDir + "/");
}

// Run the script
generateAllCharts().catch(function (err) {
  console.error("Error generating charts:", err);
});
