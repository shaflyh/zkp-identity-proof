const { execSync } = require("child_process");

// Configuration
const fs = require("fs");
const crypto = require("crypto");

const CIRCUIT_NAME = "IdentityPossessionProof";
const SMART_CONTRACT = "IndentityVerifier";
const PTAU_FILE = "pot12_final.ptau";

function fileExists(file) {
  return fs.existsSync(file);
}

async function main() {
  try {
    compile();
    setupZkey();
  } catch (error) {
    console.error(error);
  }
}

async function compile() {
  try {
    console.log("\n🛠️ Compiling circuit...");
    execSync(`circom ${CIRCUIT_NAME}.circom --r1cs --wasm --sym`, {
      stdio: "inherit",
    });
    console.log("✅ Circuit compiled successfully");
  } catch {
    console.error("❌ Error during compile:", error);
  }
}

async function setupZkey() {
  try {
    console.log("\n🔐 Setting up zKey using snarkjs CLI...");

    if (!fileExists(`${CIRCUIT_NAME}.r1cs`)) {
      console.error(`❌ R1CS file not found: ${CIRCUIT_NAME}.r1cs`);
      return;
    }

    if (!fileExists(PTAU_FILE)) {
      console.error(`❌ PTAU file not found: ${PTAU_FILE}`);
      return;
    }

    // Generate initial zKey
    console.log("▶️ Generating initial zKey...");
    execSync(
      `snarkjs groth16 setup ${CIRCUIT_NAME}.r1cs ${PTAU_FILE} ${CIRCUIT_NAME}_0000.zkey`,
      {
        stdio: "inherit",
      }
    );

    // Apply beacon
    const beacon = crypto.randomBytes(32).toString("hex");
    console.log("▶️ Applying beacon...");
    execSync(
      `snarkjs zkey beacon ${CIRCUIT_NAME}_0000.zkey ${CIRCUIT_NAME}_final.zkey ${beacon} 10`,
      { stdio: "inherit" }
    );

    // Export verification key
    console.log("▶️ Exporting verification key...");
    execSync(
      `snarkjs zkey export verificationkey ${CIRCUIT_NAME}_final.zkey verification_key.json`,
      { stdio: "inherit" }
    );

    // Export Solidity verifier
    console.log("▶️ Exporting Solidity verifier...");
    execSync(
      `snarkjs zkey export solidityverifier ${CIRCUIT_NAME}_final.zkey ${SMART_CONTRACT}.sol`,
      { stdio: "inherit" }
    );

    console.log("\n🎉 zKey setup complete!");
  } catch (error) {
    console.error("❌ Error during CLI-based zKey setup:", error);
  }
}

main().catch(console.error);
