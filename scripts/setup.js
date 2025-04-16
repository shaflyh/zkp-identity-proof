const { execSync } = require("child_process");
const fs = require("fs");
const crypto = require("crypto");

// ===== Configuration =====
const CIRCUIT_NAME = "IdentityPossessionProof";
const PTAU_FILE = "pot12_final.ptau";
const ZKEY_INITIAL = `${CIRCUIT_NAME}_0000.zkey`;
const ZKEY_FINAL = `${CIRCUIT_NAME}_final.zkey`;
const VERIFICATION_KEY_FILE = "verification_key.json";
const SOLIDITY_CONTRACT_NAME = "IdentityVerifier.sol";

// ===== Utility =====
function fileExists(path) {
  return fs.existsSync(path);
}

// ===== Main Execution =====
async function main() {
  try {
    compileCircuit();
    await setupZKey();
  } catch (error) {
    console.error("❌ Unexpected error occurred:", error);
  }
}

// ===== Compile Circuit =====
function compileCircuit() {
  console.log("\n🔧 Compiling circuit...");
  try {
    ensureDir("./build");
    execSync(`circom circuits/${CIRCUIT_NAME}.circom --r1cs --wasm --sym -o ./build`, {
      stdio: "inherit",
    });
    console.log("✅ Circuit compiled successfully.");
  } catch (error) {
    console.error("❌ Circuit compilation failed:", error);
    process.exit(1);
  }
}

// ===== Setup Trusted Setup Keys =====
async function setupZKey() {
  console.log("\n🔐 Running Groth16 trusted setup...");

  if (!fileExists(`./build/${CIRCUIT_NAME}.r1cs`)) {
    console.error(`❌ Missing R1CS file: ./build/${CIRCUIT_NAME}.r1cs`);
    return;
  }

  if (!fileExists(PTAU_FILE)) {
    console.error(`❌ Missing PTAU file: ${PTAU_FILE}`);
    return;
  }

  try {
    console.log("🧱 Step 1: Generating initial zKey...");
    execSync(
      `snarkjs groth16 setup ./build/${CIRCUIT_NAME}.r1cs ${PTAU_FILE} ./build/${ZKEY_INITIAL}`,
      { stdio: "inherit" }
    );

    console.log("⚡ Step 2: Applying beacon phase...");
    const beacon = crypto.randomBytes(32).toString("hex");
    execSync(
      `snarkjs zkey beacon ./build/${ZKEY_INITIAL} ./build/${ZKEY_FINAL} ${beacon} 10`,
      { stdio: "inherit" }
    );

    console.log("🗝️ Step 3: Exporting verification key...");
    execSync(
      `snarkjs zkey export verificationkey ./build/${ZKEY_FINAL} ./build/${VERIFICATION_KEY_FILE}`,
      { stdio: "inherit" }
    );

    console.log("🏗️ Step 4: Exporting Solidity verifier...");
    ensureDir("./contracts");
    execSync(
      `snarkjs zkey export solidityverifier ./build/${ZKEY_FINAL} ./contracts/${SOLIDITY_CONTRACT_NAME}`,
      { stdio: "inherit" }
    );

    console.log("\n🎉 Trusted setup complete.");
  } catch (error) {
    console.error("❌ zKey setup error:", error);
  }
}

main();

function ensureDir(path) {
  if (!fs.existsSync(path)) {
    fs.mkdirSync(path, { recursive: true });
    console.log(`📁 Created folder: ${path}`);
  }
}
