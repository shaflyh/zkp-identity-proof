const { execSync } = require("child_process");
const fs = require("fs");

const CIRCUIT_NAME = "IdentityMerkleProof"; // Updated circuit name
const INPUT_FILE = "input_merkle.json"; // Updated input file
const BUILD_DIR = "./build";
const WITNESS_FILE = `${BUILD_DIR}/witness.wtns`;
const PROOF_FILE = `${BUILD_DIR}/proof.json`;
const PUBLIC_FILE = `${BUILD_DIR}/public.json`;
const WASM_DIR = `${BUILD_DIR}/${CIRCUIT_NAME}_js`;
const ZKEY_FILE = `${BUILD_DIR}/${CIRCUIT_NAME}_final.zkey`;

async function main() {
  try {
    // Check if input file exists
    if (!fs.existsSync(INPUT_FILE)) {
      console.error(
        `❌ Input file ${INPUT_FILE} not found. Run generate-input-merkle.js first.`
      );
      return;
    }

    // Validate input file format
    const input = JSON.parse(fs.readFileSync(INPUT_FILE, "utf8"));
    console.log("📊 Input validation:");
    console.log("🌳 Merkle Root:", input.merkleRoot);
    console.log(
      "👤 Identity fields:",
      input.nik ? "✅" : "❌",
      input.nama ? "✅" : "❌",
      input.ttl ? "✅" : "❌",
      input.key ? "✅" : "❌"
    );
    console.log(
      "🌲 Path elements:",
      input.pathElements?.length || 0,
      "elements"
    );
    console.log("🧭 Path indices:", input.pathIndices?.length || 0, "indices");
    console.log("🧂 Salt:", input.salt ? "✅" : "❌");

    // Check if all build files exist
    const requiredFiles = [
      `${WASM_DIR}/${CIRCUIT_NAME}.wasm`,
      `${WASM_DIR}/generate_witness.js`,
      ZKEY_FILE,
    ];

    for (const file of requiredFiles) {
      if (!fs.existsSync(file)) {
        console.error(`❌ Required file ${file} not found. Run setup first.`);
        return;
      }
    }

    console.log("\n📥 Generating witness...");
    console.log(
      `Command: node ${WASM_DIR}/generate_witness.js ${WASM_DIR}/${CIRCUIT_NAME}.wasm ${INPUT_FILE} ${WITNESS_FILE}`
    );

    execSync(
      `node ${WASM_DIR}/generate_witness.js ${WASM_DIR}/${CIRCUIT_NAME}.wasm ${INPUT_FILE} ${WITNESS_FILE}`,
      {
        stdio: "inherit",
      }
    );

    console.log("\n🧾 Generating proof...");
    console.log(
      `Command: snarkjs groth16 prove ${ZKEY_FILE} ${WITNESS_FILE} ${PROOF_FILE} ${PUBLIC_FILE}`
    );

    execSync(
      `snarkjs groth16 prove ${ZKEY_FILE} ${WITNESS_FILE} ${PROOF_FILE} ${PUBLIC_FILE}`,
      {
        stdio: "inherit",
      }
    );

    // Validate output files
    if (!fs.existsSync(PROOF_FILE) || !fs.existsSync(PUBLIC_FILE)) {
      console.error("❌ Proof generation failed - output files not created");
      return;
    }

    // Display proof info
    const proof = JSON.parse(fs.readFileSync(PROOF_FILE, "utf8"));
    const publicSignals = JSON.parse(fs.readFileSync(PUBLIC_FILE, "utf8"));

    console.log("\n✅ Proof generated successfully!");
    console.log("📄 Files created:");
    console.log("  - Proof:", PROOF_FILE);
    console.log("  - Public signals:", PUBLIC_FILE);
    console.log("  - Witness:", WITNESS_FILE);

    console.log("\n📊 Proof Information:");
    console.log("🌳 Public Merkle Root:", publicSignals[0]);
    console.log("📏 Proof size:", JSON.stringify(proof).length, "characters");
    console.log("🔢 Public signals count:", publicSignals.length);

    // Verify proof structure
    if (proof.pi_a && proof.pi_b && proof.pi_c) {
      console.log("✅ Proof structure valid (pi_a, pi_b, pi_c present)");
    } else {
      console.log("❌ Invalid proof structure");
    }

    // Check if merkle root matches
    if (publicSignals[0] === input.merkleRoot) {
      console.log("✅ Merkle root matches input");
    } else {
      console.log("❌ Merkle root mismatch!");
      console.log("  Expected:", input.merkleRoot);
      console.log("  Got:", publicSignals[0]);
    }
  } catch (error) {
    console.error("❌ Error during proof generation:", error.message);

    // Additional error info
    if (error.message.includes("witness")) {
      console.error(
        "💡 Tip: Check if input format matches circuit expectations"
      );
    } else if (error.message.includes("zkey")) {
      console.error("💡 Tip: Run setup script to generate proper zkey file");
    }
  }
}

main();
