const { execSync } = require("child_process");

const VERIFICATION_KEY = "./build/verification_key.json";
const PROOF_FILE = "./build/proof.json";
const PUBLIC_FILE = "./build/public.json";

try {
  console.log("\n🔍 Verifying proof...");
  execSync(
    `snarkjs groth16 verify ${VERIFICATION_KEY} ${PUBLIC_FILE} ${PROOF_FILE}`,
    {
      stdio: "inherit",
    }
  );

  console.log("\n✅ Proof is valid!");
} catch (error) {
  console.error("❌ Invalid proof or verification failed:", error);
}
