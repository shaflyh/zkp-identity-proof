const ethers = require("ethers");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const { PRIVATE_KEY } = process.env;

// Configuration
const CONFIG = {
  rpc: "https://polygon-rpc.com",
  contractAddress: "0xF99024c6E16c2dCCA305DAF4406b17D93F22a72f",
  privateKey: PRIVATE_KEY,
  outputFile: "test/benchmark_results.json",
  iterations: 1, // Reduced iterations to avoid rate limiting
  concurrentTests: [3], // Reduced concurrency levels
  retryAttempts: 2, // Number of retry attempts for failed transactions
  retryDelay: 3000, // Delay between retries in ms (increased)
  gasLimit: 3000000, // Fixed gas limit to avoid estimation errors
};

// Contract ABI - update with your actual contract ABI
const contractFile = require("../artifacts/contracts/IdentityZKP.sol/IdentityZKP.json");
const CONTRACT_ABI = contractFile.abi;

// Load proof data
function loadProofData() {
  try {
    const proof = JSON.parse(
      fs.readFileSync(path.join(__dirname, "../build/proof1.json"))
    );
    const publicSignals = JSON.parse(
      fs.readFileSync(path.join(__dirname, "../build/public1.json"))
    );

    const a = [proof.pi_a[0], proof.pi_a[1]];
    const b = [
      [proof.pi_b[0][1], proof.pi_b[0][0]],
      [proof.pi_b[1][1], proof.pi_b[1][0]],
    ];
    const c = [proof.pi_c[0], proof.pi_c[1]];
    const hash = publicSignals[0];

    return { a, b, c, hash };
  } catch (error) {
    console.error("Error loading proof data:", error);
    process.exit(1);
  }
}

const proofData = loadProofData();

// Prepare test data with more users
function generateTestData(count) {
  const userIds = [];
  const hashes = [];
  const proofs = [];

  for (let i = 0; i < count; i++) {
    const userId = ethers.keccak256(ethers.toUtf8Bytes(`User${i + 1}`));
    userIds.push(userId);
    hashes.push(proofData.hash);
    proofs.push({
      a: proofData.a,
      b: proofData.b,
      c: proofData.c,
    });
  }

  return { userIds, hashes, proofs };
}

// Enhanced results structure
const results = {
  gasCosts: {
    submitHashByUser: [],
    approveIdentity: [],
    submitProof: [],
    revokeApprovedIdentity: [],
  },
  transactionTimes: {
    submitHashByUser: [],
    approveIdentity: [],
    submitProof: [],
    revokeApprovedIdentity: [],
  },
  gasPrices: [],
  networkLatency: [],
  concurrencyResults: {},
  errors: [],
};

// Initialize provider and wallet
let provider, wallet, contract;

function initializeConnection() {
  provider = new ethers.JsonRpcProvider(CONFIG.rpc);
  wallet = new ethers.Wallet(CONFIG.privateKey, provider);
  contract = new ethers.Contract(CONFIG.contractAddress, CONTRACT_ABI, wallet);

  // Set higher polling interval to reduce RPC load
  provider.pollingInterval = 1000;
}

// Helper function to sleep
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper function to retry on failure
async function withRetry(
  fn,
  retries = CONFIG.retryAttempts,
  delay = CONFIG.retryDelay
) {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) throw error;

    console.log(`Retrying operation after error: ${error.message}`);
    await sleep(delay);

    return withRetry(fn, retries - 1, delay);
  }
}

// Fixed transaction measurement function without estimateGas call
async function measureTransaction(functionName, txFunction, extraData = {}) {
  console.log(`Running ${functionName}...`);
  const startTime = Date.now();
  const beforeMemory = process.memoryUsage();

  try {
    // Get current gas price
    const feeData = await provider.getFeeData();

    // Prepare transaction options with fixed gas limit
    const txOptions = {
      gasLimit: CONFIG.gasLimit,
    };

    // If maxFeePerGas is available (EIP-1559), use it
    if (feeData.maxFeePerGas) {
      txOptions.maxFeePerGas = feeData.maxFeePerGas;
      txOptions.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
    } else if (feeData.gasPrice) {
      // Otherwise fall back to legacy gas price
      txOptions.gasPrice = feeData.gasPrice;
    }

    // Execute the transaction with options
    const tx = await txFunction(txOptions);
    const receipt = await tx.wait();

    // Calculate detailed metrics
    const endTime = Date.now();
    const afterMemory = process.memoryUsage();

    const gasUsed = receipt.gasUsed.toString();
    const timeElapsed = endTime - startTime;
    const actualCost = receipt.gasUsed * receipt.gasPrice;
    const memoryDelta = {
      rss: afterMemory.rss - beforeMemory.rss,
      heapTotal: afterMemory.heapTotal - beforeMemory.heapTotal,
      heapUsed: afterMemory.heapUsed - beforeMemory.heapUsed,
    };

    // Get block time
    const block = await provider.getBlock(receipt.blockNumber);
    const blockTime = block ? block.timestamp * 1000 : Date.now(); // Convert to ms
    const networkLatency = blockTime - startTime;

    // Record detailed results
    results.gasCosts[functionName].push(gasUsed);
    results.transactionTimes[functionName].push(timeElapsed);
    results.gasPrices.push(receipt.gasPrice.toString());
    results.networkLatency.push(networkLatency);

    console.log(
      `${functionName} completed: Gas used: ${gasUsed}, Time: ${timeElapsed}ms, Cost: ${ethers.formatEther(
        actualCost
      )} POL`
    );
    return {
      receipt,
      metrics: { gasUsed, timeElapsed, actualCost, memoryDelta },
    };
  } catch (error) {
    console.error(`Error in ${functionName}:`, error);
    results.errors.push({
      function: functionName,
      error: error.message,
      timestamp: new Date().toISOString(),
      ...extraData,
    });
    return null;
  }
}

// Run a single test case with fixed transaction calls
async function runTestCase(userId, hash, proof, iteration) {
  console.log(
    `\nRunning test case for user ${userId} (iteration ${iteration + 1}):`
  );

  const extraData = { userId, iteration };

  // Add a delay before starting to avoid rate limits
  await sleep(1000);

  // 1. Submit hash
  await withRetry(
    async () =>
      await measureTransaction(
        "submitHashByUser",
        (options) => contract.submitHashByUser(userId, hash, options),
        extraData
      )
  );

  // Small delay between transactions
  await sleep(1000);

  // 2. Approve identity (as admin)
  await withRetry(
    async () =>
      await measureTransaction(
        "approveIdentity",
        (options) => contract.approveIdentity(userId, options),
        extraData
      )
  );

  // Small delay between transactions
  await sleep(1000);

  // 3. Submit proof
  await withRetry(
    async () =>
      await measureTransaction(
        "submitProof",
        (options) =>
          contract.submitProof(userId, proof.a, proof.b, proof.c, options),
        extraData
      )
  );

  // Small delay between transactions
  await sleep(1000);

  // 4. Revoke approved identity
  await withRetry(
    async () =>
      await measureTransaction(
        "revokeApprovedIdentity",
        (options) => contract.revokeApprovedIdentity(userId, 1, options),
        extraData
      )
  );
}

// Run tests with different concurrency levels - with proper nonce management
async function runConcurrencyTest(concurrencyLevel) {
  console.log(
    `\n=== Running concurrency test with ${concurrencyLevel} parallel transactions ===`
  );

  // Generate test data for this concurrency level
  const testData = generateTestData(concurrencyLevel);
  const startTime = Date.now();

  // Initialize results for this concurrency level
  results.concurrencyResults[concurrencyLevel] = {
    gasCosts: {
      submitHashByUser: [],
      approveIdentity: [],
      submitProof: [],
      revokeApprovedIdentity: [],
    },
    transactionTimes: {
      submitHashByUser: [],
      approveIdentity: [],
      submitProof: [],
      revokeApprovedIdentity: [],
    },
    errors: [],
  };

  // 1. Submit hashes in sequence with proper nonce management
  console.log(
    "Running submitHashByUser in sequence with proper nonce management..."
  );
  const nonce = await provider.getTransactionCount(wallet.address);

  for (let i = 0; i < concurrencyLevel; i++) {
    try {
      const startTime = Date.now();
      const txOptions = {
        gasLimit: CONFIG.gasLimit,
        nonce: nonce + i,
      };

      const tx = await contract.submitHashByUser(
        testData.userIds[i],
        testData.hashes[i],
        txOptions
      );

      console.log(
        `Submitted hash for user ${i + 1}/${concurrencyLevel} with nonce ${
          nonce + i
        }`
      );

      const receipt = await tx.wait();
      const endTime = Date.now();

      results.concurrencyResults[
        concurrencyLevel
      ].gasCosts.submitHashByUser.push(receipt.gasUsed.toString());
      results.concurrencyResults[
        concurrencyLevel
      ].transactionTimes.submitHashByUser.push(endTime - startTime);
    } catch (error) {
      console.error(`Error submitting hash for user ${i + 1}:`, error.message);
      results.concurrencyResults[concurrencyLevel].errors.push({
        function: "submitHashByUser",
        userId: testData.userIds[i],
        error: error.message,
      });
    }
  }

  // Wait for all transactions to be mined
  await sleep(5000);

  // 2. Approve identities in sequence with proper nonce management
  console.log(
    "\nRunning approveIdentity in sequence with proper nonce management..."
  );
  const nonceAfterSubmit = await provider.getTransactionCount(wallet.address);

  for (let i = 0; i < concurrencyLevel; i++) {
    try {
      const startTime = Date.now();
      const txOptions = {
        gasLimit: CONFIG.gasLimit,
        nonce: nonceAfterSubmit + i,
      };

      const tx = await contract.approveIdentity(testData.userIds[i], txOptions);

      console.log(
        `Approved identity for user ${i + 1}/${concurrencyLevel} with nonce ${
          nonceAfterSubmit + i
        }`
      );

      const receipt = await tx.wait();
      const endTime = Date.now();

      results.concurrencyResults[
        concurrencyLevel
      ].gasCosts.approveIdentity.push(receipt.gasUsed.toString());
      results.concurrencyResults[
        concurrencyLevel
      ].transactionTimes.approveIdentity.push(endTime - startTime);
    } catch (error) {
      console.error(
        `Error approving identity for user ${i + 1}:`,
        error.message
      );
      results.concurrencyResults[concurrencyLevel].errors.push({
        function: "approveIdentity",
        userId: testData.userIds[i],
        error: error.message,
      });
    }
  }

  // Wait for all transactions to be mined
  await sleep(5000);

  // 3. Submit proofs in sequence with proper nonce management
  console.log(
    "\nRunning submitProof in sequence with proper nonce management..."
  );
  const nonceAfterApprove = await provider.getTransactionCount(wallet.address);

  for (let i = 0; i < concurrencyLevel; i++) {
    try {
      const startTime = Date.now();
      const txOptions = {
        gasLimit: CONFIG.gasLimit,
        nonce: nonceAfterApprove + i,
      };

      const tx = await contract.submitProof(
        testData.userIds[i],
        testData.proofs[i].a,
        testData.proofs[i].b,
        testData.proofs[i].c,
        txOptions
      );

      console.log(
        `Submitted proof for user ${i + 1}/${concurrencyLevel} with nonce ${
          nonceAfterApprove + i
        }`
      );

      const receipt = await tx.wait();
      const endTime = Date.now();

      results.concurrencyResults[concurrencyLevel].gasCosts.submitProof.push(
        receipt.gasUsed.toString()
      );
      results.concurrencyResults[
        concurrencyLevel
      ].transactionTimes.submitProof.push(endTime - startTime);
    } catch (error) {
      console.error(`Error submitting proof for user ${i + 1}:`, error.message);
      results.concurrencyResults[concurrencyLevel].errors.push({
        function: "submitProof",
        userId: testData.userIds[i],
        error: error.message,
      });
    }
  }

  // Wait for all transactions to be mined
  await sleep(5000);

  // 4. Revoke approved identities in sequence with proper nonce management
  console.log(
    "\nRunning revokeApprovedIdentity in sequence with proper nonce management..."
  );
  const nonceAfterProof = await provider.getTransactionCount(wallet.address);

  for (let i = 0; i < concurrencyLevel; i++) {
    try {
      const startTime = Date.now();
      const txOptions = {
        gasLimit: CONFIG.gasLimit,
        nonce: nonceAfterProof + i,
      };

      const tx = await contract.revokeApprovedIdentity(
        testData.userIds[i],
        1,
        txOptions
      );

      console.log(
        `Revoked identity for user ${i + 1}/${concurrencyLevel} with nonce ${
          nonceAfterProof + i
        }`
      );

      const receipt = await tx.wait();
      const endTime = Date.now();

      results.concurrencyResults[
        concurrencyLevel
      ].gasCosts.revokeApprovedIdentity.push(receipt.gasUsed.toString());
      results.concurrencyResults[
        concurrencyLevel
      ].transactionTimes.revokeApprovedIdentity.push(endTime - startTime);
    } catch (error) {
      console.error(
        `Error revoking identity for user ${i + 1}:`,
        error.message
      );
      results.concurrencyResults[concurrencyLevel].errors.push({
        function: "revokeApprovedIdentity",
        userId: testData.userIds[i],
        error: error.message,
      });
    }
  }

  const endTime = Date.now();
  results.concurrencyResults[concurrencyLevel].totalTime = endTime - startTime;

  console.log(
    `Concurrency test with ${concurrencyLevel} transactions completed in ${
      endTime - startTime
    }ms`
  );
}

// Enhanced average calculation
function calculateAverages() {
  const averages = {
    gasCosts: {},
    transactionTimes: {},
    gasPrices: "0",
    networkLatency: 0,
    concurrencyResults: {},
  };

  // Calculate average gas costs
  for (const [func, costs] of Object.entries(results.gasCosts)) {
    if (costs.length > 0) {
      const sum = costs.reduce((acc, val) => acc + BigInt(val), BigInt(0));
      averages.gasCosts[func] = (sum / BigInt(costs.length)).toString();
    } else {
      averages.gasCosts[func] = "N/A";
    }
  }

  // Calculate average transaction times
  for (const [func, times] of Object.entries(results.transactionTimes)) {
    if (times.length > 0) {
      averages.transactionTimes[func] =
        times.reduce((acc, val) => acc + val, 0) / times.length;
    } else {
      averages.transactionTimes[func] = "N/A";
    }
  }

  // Average gas prices
  if (results.gasPrices.length > 0) {
    const sum = results.gasPrices.reduce(
      (acc, val) => acc + BigInt(val),
      BigInt(0)
    );
    averages.gasPrices = (sum / BigInt(results.gasPrices.length)).toString();
  }

  // Average network latency
  if (results.networkLatency.length > 0) {
    averages.networkLatency =
      results.networkLatency.reduce((acc, val) => acc + val, 0) /
      results.networkLatency.length;
  }

  // Process concurrency results
  for (const [level, data] of Object.entries(results.concurrencyResults)) {
    averages.concurrencyResults[level] = {
      gasCosts: {},
      transactionTimes: {},
      throughput: 0,
    };

    // Calculate average gas costs for each function
    for (const [func, costs] of Object.entries(data.gasCosts)) {
      if (costs.length > 0) {
        const sum = costs.reduce((acc, val) => acc + BigInt(val), BigInt(0));
        averages.concurrencyResults[level].gasCosts[func] = (
          sum / BigInt(costs.length)
        ).toString();
      } else {
        averages.concurrencyResults[level].gasCosts[func] = "N/A";
      }
    }

    // Calculate average transaction times for each function
    for (const [func, times] of Object.entries(data.transactionTimes)) {
      if (times.length > 0) {
        averages.concurrencyResults[level].transactionTimes[func] =
          times.reduce((acc, val) => acc + val, 0) / times.length;
      } else {
        averages.concurrencyResults[level].transactionTimes[func] = "N/A";
      }
    }

    // Calculate throughput (transactions per second)
    if (data.totalTime) {
      const totalSuccessfulTxs = Object.values(data.gasCosts).reduce(
        (acc, arr) => acc + arr.length,
        0
      );
      averages.concurrencyResults[level].throughput =
        (totalSuccessfulTxs / data.totalTime) * 1000;
    }
  }

  return averages;
}

// Create a detailed report
function generateDetailedReport(averages) {
  const report = {
    summary: {
      averageGasCosts: averages.gasCosts,
      averageTransactionTimes: averages.transactionTimes,
      averageGasPrice: `${ethers.formatUnits(averages.gasPrices, "gwei")} gwei`,
      averageNetworkLatency: `${averages.networkLatency.toFixed(2)} ms`,
      errorRate: `${
        results.errors.length > 0
          ? (
              (results.errors.length /
                (Object.values(results.gasCosts).flat().length +
                  results.errors.length)) *
              100
            ).toFixed(2)
          : 0
      }%`,
    },
    concurrencyAnalysis: {},
    costAnalysis: {},
    recommendations: [],
  };

  // Process concurrency results
  for (const [level, data] of Object.entries(averages.concurrencyResults)) {
    report.concurrencyAnalysis[level] = {
      throughput: `${data.throughput ? data.throughput.toFixed(4) : 0} tx/s`,
      averageCostsPerFunction: data.gasCosts,
      averageTimesPerFunction: {},
    };

    // Add average times for each function
    for (const [func, time] of Object.entries(data.transactionTimes || {})) {
      if (time !== "N/A") {
        report.concurrencyAnalysis[level].averageTimesPerFunction[
          func
        ] = `${time.toFixed(2)} ms`;
      } else {
        report.concurrencyAnalysis[level].averageTimesPerFunction[func] = "N/A";
      }
    }
  }

  // Calculate POL costs based on average gas price
  for (const [func, gas] of Object.entries(averages.gasCosts)) {
    if (gas !== "N/A") {
      const gasBigInt = BigInt(gas);
      const gasPriceBigInt = BigInt(averages.gasPrices || 0);
      const totalWei = gasBigInt * gasPriceBigInt;

      report.costAnalysis[func] = {
        gasUsed: gas,
        estimatedCostInPOL: `${ethers.formatEther(totalWei)} POL`,
        estimatedCostInGwei: `${ethers.formatUnits(totalWei, "gwei")} gwei`,
      };
    }
  }

  // Generate recommendations based on results
  if (Object.keys(averages.concurrencyResults).length > 1) {
    // Find optimal throughput level if there are multiple concurrency tests
    const levels = Object.keys(averages.concurrencyResults);
    if (levels.length > 0) {
      let optimalLevel = levels[0];
      let maxThroughput =
        averages.concurrencyResults[optimalLevel].throughput || 0;

      for (const level of levels) {
        const throughput = averages.concurrencyResults[level].throughput || 0;
        if (throughput > maxThroughput) {
          maxThroughput = throughput;
          optimalLevel = level;
        }
      }

      report.recommendations.push(
        `Optimal concurrency level appears to be ${optimalLevel} transactions in parallel with throughput of ${maxThroughput.toFixed(
          4
        )} tx/s`
      );
    }
  }

  // Identify the most expensive operation
  let mostExpensiveFunc = null;
  let maxGas = BigInt(0);

  for (const [func, gas] of Object.entries(averages.gasCosts)) {
    if (gas !== "N/A") {
      const gasBigInt = BigInt(gas);
      if (gasBigInt > maxGas) {
        maxGas = gasBigInt;
        mostExpensiveFunc = func;
      }
    }
  }

  if (mostExpensiveFunc) {
    report.recommendations.push(
      `Most expensive operation is '${mostExpensiveFunc}' at ${maxGas.toString()} gas`
    );
  }

  // Add recommendations based on error patterns
  if (results.errors.length > 0) {
    const errorsByFunc = {};
    results.errors.forEach((err) => {
      errorsByFunc[err.function] = (errorsByFunc[err.function] || 0) + 1;
    });

    if (Object.keys(errorsByFunc).length > 0) {
      let mostErrorFunc = Object.keys(errorsByFunc)[0];
      let maxErrors = errorsByFunc[mostErrorFunc];

      for (const [func, count] of Object.entries(errorsByFunc)) {
        if (count > maxErrors) {
          maxErrors = count;
          mostErrorFunc = func;
        }
      }

      report.recommendations.push(
        `Consider optimizing '${mostErrorFunc}' which had ${maxErrors} errors`
      );
    }
  }

  return report;
}

// Main benchmark function
async function runBenchmarks() {
  console.log("Starting Enhanced IdentityZKP Contract Benchmarks...");
  initializeConnection();

  try {
    // First, run iterative tests for baseline performance
    const testData = generateTestData(CONFIG.iterations);

    for (let iteration = 0; iteration < CONFIG.iterations; iteration++) {
      await runTestCase(
        testData.userIds[iteration],
        testData.hashes[iteration],
        testData.proofs[iteration],
        iteration
      );

      // Add delay between iterations to avoid rate limiting
      await sleep(3000);
    }

    // Then, run concurrency tests with proper nonce management
    for (const concurrencyLevel of CONFIG.concurrentTests) {
      await runConcurrencyTest(concurrencyLevel);

      // Add delay between concurrency tests
      await sleep(5000);
    }

    // Calculate averages and generate report
    const averages = calculateAverages();
    const detailedReport = generateDetailedReport(averages);

    // Save results to file
    const finalResults = {
      raw: results,
      averages: averages,
      report: detailedReport,
      config: {
        contractAddress: CONFIG.contractAddress,
        iterations: CONFIG.iterations,
        concurrencyLevels: CONFIG.concurrentTests,
        timestamp: new Date().toISOString(),
      },
    };

    fs.writeFileSync(CONFIG.outputFile, JSON.stringify(finalResults, null, 2));
    console.log(`\nBenchmark completed. Results saved to ${CONFIG.outputFile}`);

    // Print summary
    console.log("\nBenchmark Summary:");
    console.log("==================");

    console.log("\nAverage Gas Costs:");
    for (const [func, avg] of Object.entries(averages.gasCosts)) {
      console.log(`- ${func}: ${avg} gas`);
    }

    console.log("\nAverage Transaction Times:");
    for (const [func, avg] of Object.entries(averages.transactionTimes)) {
      if (avg !== "N/A") {
        console.log(`- ${func}: ${avg.toFixed(2)} ms`);
      } else {
        console.log(`- ${func}: N/A`);
      }
    }

    console.log("\nConcurrency Results:");
    for (const [level, data] of Object.entries(averages.concurrencyResults)) {
      if (data.throughput) {
        console.log(`- Level ${level}: ${data.throughput.toFixed(4)} tx/s`);
      } else {
        console.log(`- Level ${level}: throughput data not available`);
      }
    }

    console.log("\nRecommendations:");
    detailedReport.recommendations.forEach((rec, i) => {
      console.log(`${i + 1}. ${rec}`);
    });
  } catch (error) {
    console.error("Benchmark failed:", error);
  }
}

// Run the benchmarks
runBenchmarks().catch(console.error);
