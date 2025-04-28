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
  outputFile: "test/zkp_benchmark_results.json",
};

// Contract ABI - update with your actual contract ABI
const contractFile = require("../artifacts/contracts/IdentityZKP.sol/IdentityZKP.json");
const CONTRACT_ABI = contractFile.abi;

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

const userId = ethers.keccak256(ethers.toUtf8Bytes("User1"));
const hash = publicSignals[0];

// Test data - using just 2 data points with real proof values
const TEST_DATA = {
  userIds: [userId],
  hashes: [hash],
  proofs: [
    {
      a: a,
      b: b,
      c: c,
    },
    {
      a: a,
      b: b,
      c: c,
    },
  ],
};

// Benchmarking results
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
};

// Initialize provider and wallet
const provider = new ethers.JsonRpcProvider(CONFIG.rpc);
const wallet = new ethers.Wallet(CONFIG.privateKey, provider);
const contract = new ethers.Contract(
  CONFIG.contractAddress,
  CONTRACT_ABI,
  wallet
);

// Helper function to measure transaction metrics
async function measureTransaction(functionName, txPromise) {
  console.log(`Running ${functionName}...`);
  const startTime = Date.now();

  try {
    // Send transaction
    const tx = await txPromise;
    const receipt = await tx.wait();

    // Calculate metrics
    const endTime = Date.now();
    const gasUsed = receipt.gasUsed.toString();
    const timeElapsed = endTime - startTime;

    // Record results
    results.gasCosts[functionName].push(gasUsed);
    results.transactionTimes[functionName].push(timeElapsed);

    console.log(
      `${functionName} completed: Gas used: ${gasUsed}, Time: ${timeElapsed}ms`
    );
    return receipt;
  } catch (error) {
    console.error(`Error in ${functionName}:`, error);
    return null;
  }
}

// Main benchmark function
async function runBenchmarks() {
  console.log("Starting IdentityZKP Contract Benchmarks...");

  // Run benchmarks for each test data point
  for (let i = 0; i < TEST_DATA.userIds.length; i++) {
    const userId = TEST_DATA.userIds[i];
    const hash = TEST_DATA.hashes[i];
    const proof = TEST_DATA.proofs[i];

    console.log(`\nRunning test case ${i + 1} for user ${userId}:`);

    // 1. Submit hash
    await measureTransaction(
      "submitHashByUser",
      contract.submitHashByUser(userId, hash)
    );

    // 2. Approve identity (as admin)
    await measureTransaction(
      "approveIdentity",
      contract.approveIdentity(userId)
    );

    // 3. Submit proof
    await measureTransaction(
      "submitProof",
      contract.submitProof(userId, proof.a, proof.b, proof.c)
    );

    // 4. Revoke approved identity
    await measureTransaction(
      "revokeApprovedIdentity",
      contract.revokeApprovedIdentity(userId, 1)
    );
  }

  // Calculate averages
  const averages = calculateAverages();

  // Save results to file
  const finalResults = {
    raw: results,
    averages: averages,
    config: {
      contractAddress: CONFIG.contractAddress,
      testCases: TEST_DATA.userIds.length,
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
    console.log(`- ${func}: ${avg} ms`);
  }
}

// Helper function to calculate averages
function calculateAverages() {
  const averages = {
    gasCosts: {},
    transactionTimes: {},
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

  return averages;
}

// Run the benchmarks
runBenchmarks().catch(console.error);
