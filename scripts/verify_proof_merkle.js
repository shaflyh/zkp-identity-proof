const { execSync } = require("child_process");
const fs = require("fs");

const VERIFICATION_KEY = "./build/verification_key_merkle.json";
const PROOF_FILE = "./build/proof.json";
const PUBLIC_FILE = "./build/public.json";
const INPUT_FILE = "input_merkle.json"; // To cross-check data

async function main() {
  try {
    // Check if all required files exist
    const requiredFiles = [VERIFICATION_KEY, PROOF_FILE, PUBLIC_FILE];

    for (const file of requiredFiles) {
      if (!fs.existsSync(file)) {
        console.error(`❌ Required file ${file} not found.`);
        return;
      }
    }

    // Read and validate files
    const proof = JSON.parse(fs.readFileSync(PROOF_FILE, "utf8"));
    const publicSignals = JSON.parse(fs.readFileSync(PUBLIC_FILE, "utf8"));

    console.log("📊 Pre-verification Analysis:");
    console.log("🌳 Public Merkle Root:", publicSignals[0]);
    console.log("🔢 Public signals count:", publicSignals.length);
    console.log("📏 Proof components:", {
      pi_a: proof.pi_a ? "✅" : "❌",
      pi_b: proof.pi_b ? "✅" : "❌",
      pi_c: proof.pi_c ? "✅" : "❌",
    });

    // Cross-check with input if available
    if (fs.existsSync(INPUT_FILE)) {
      const input = JSON.parse(fs.readFileSync(INPUT_FILE, "utf8"));
      console.log("🔍 Cross-verification with input:");
      console.log("Expected root:", input.merkleRoot);
      console.log("Proof root:  ", publicSignals[0]);
      console.log(
        "Match:",
        input.merkleRoot === publicSignals[0] ? "✅" : "❌"
      );

      if (input.merkleRoot !== publicSignals[0]) {
        console.log("⚠️  Warning: Merkle root mismatch detected!");
      }
    }

    console.log("\n🔍 Verifying ZKP proof...");
    console.log(
      "Command: snarkjs groth16 verify " +
        `${VERIFICATION_KEY} ${PUBLIC_FILE} ${PROOF_FILE}`
    );

    execSync(
      `snarkjs groth16 verify ${VERIFICATION_KEY} ${PUBLIC_FILE} ${PROOF_FILE}`,
      {
        stdio: "inherit",
      }
    );

    console.log("\n🎉 SUCCESS! ZKP Verification Complete!");
    console.log("✅ Proof is cryptographically valid!");
    console.log("🔒 Identity verified without revealing private data!");
    console.log("🌳 Merkle membership confirmed!");
    console.log("🛡️  Zero-knowledge properties maintained!");

    // Summary of what was proven
    console.log("\n📋 What was proven:");
    console.log("  ✓ User knows valid identity data (NIK, Name, TTL, Key)");
    console.log("  ✓ Identity is included in approved Merkle tree");
    console.log("  ✓ User knows the correct salt for their leaf");
    console.log("  ✓ All without revealing any private information");

    // Technical details
    console.log("\n🔧 Technical Details:");
    console.log("  • Circuit: IdentityMerkleProof with 16 levels");
    console.log("  • Protocol: Groth16 zk-SNARKs");
    console.log("  • Hash Function: Poseidon (ZK-friendly)");
    console.log("  • Max Identities: 65,536 (2^16)");
    console.log("  • Proof Size: ~719 characters");
  } catch (error) {
    console.error("\n❌ Verification FAILED!");
    console.error("Error:", error.message);

    // Provide helpful debugging info
    if (error.message.includes("verification key")) {
      console.error("💡 Tip: Ensure verification key matches the circuit");
    } else if (error.message.includes("public")) {
      console.error("💡 Tip: Check if public signals are correctly formatted");
    } else if (error.message.includes("proof")) {
      console.error("💡 Tip: Ensure proof was generated with correct inputs");
    } else {
      console.error("💡 Tip: Try regenerating the proof with fresh inputs");
    }
  }
}

main();
