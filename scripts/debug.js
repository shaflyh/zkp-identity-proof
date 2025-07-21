const fs = require("fs");
const poseidon = require("circomlibjs").buildPoseidon;

async function debugMerkleTreeLogic() {
  const poseidonLib = await poseidon();

  // Read the input file
  const input = JSON.parse(fs.readFileSync("input_merkle.json", "utf8"));

  console.log("🔍 Debugging Merkle Tree Logic...\n");

  // Step 1: Recreate identity hash
  const identityHash = poseidonLib.F.toObject(
    poseidonLib([
      BigInt(input.nik),
      BigInt(input.nama),
      BigInt(input.ttl),
      BigInt(input.key),
    ])
  );

  console.log("1️⃣ Identity Hash Verification:");
  console.log("Computed:", identityHash.toString());

  // Step 2: Recreate leaf hash
  const leafHash = poseidonLib.F.toObject(
    poseidonLib([
      identityHash,
      BigInt(input.salt),
      1n, // status
    ])
  );

  console.log("\n2️⃣ Leaf Hash Verification:");
  console.log("Computed:", leafHash.toString());

  // Step 3: Manual Merkle root computation (simulate circuit logic)
  console.log("\n3️⃣ Manual Merkle Root Computation:");
  console.log("Starting with leaf:", leafHash.toString());

  let currentHash = leafHash;

  for (let i = 0; i < input.pathElements.length; i++) {
    const pathElement = BigInt(input.pathElements[i]);
    const pathIndex = input.pathIndices[i];

    console.log(`\nLevel ${i}:`);
    console.log("Current hash:", currentHash.toString());
    console.log("Path element:", pathElement.toString());
    console.log("Path index:", pathIndex, "(0=right, 1=left)");

    let nextHash;
    if (pathIndex === 0) {
      // Current hash is on the right, path element on left
      nextHash = poseidonLib.F.toObject(
        poseidonLib([pathElement, currentHash])
      );
      console.log("Hash order: Poseidon(pathElement, currentHash)");
    } else {
      // Current hash is on the left, path element on right
      nextHash = poseidonLib.F.toObject(
        poseidonLib([currentHash, pathElement])
      );
      console.log("Hash order: Poseidon(currentHash, pathElement)");
    }

    currentHash = nextHash;
    console.log("Result hash:", currentHash.toString());
  }

  console.log("\n4️⃣ Final Comparison:");
  console.log("Computed root:", currentHash.toString());
  console.log("Expected root:", input.merkleRoot);
  console.log(
    "Match:",
    currentHash.toString() === input.merkleRoot ? "✅" : "❌"
  );

  // Step 4: Check circuit logic compatibility
  console.log("\n5️⃣ Circuit Logic Check:");
  console.log("This simulates exactly what the circuit should compute.");
  console.log(
    "If this doesn't match, there's a bug in our Merkle tree generation."
  );

  // Step 5: Test with smaller example
  console.log("\n6️⃣ Simple Test:");
  const testLeaf1 = 123n;
  const testLeaf2 = 456n;
  const testParent = poseidonLib.F.toObject(
    poseidonLib([testLeaf1, testLeaf2])
  );
  console.log("Test: Poseidon(123, 456) =", testParent.toString());

  // Check if the problem is with path indices interpretation
  console.log("\n7️⃣ Path Indices Analysis:");
  const nonZeroIndices = input.pathIndices.filter((idx, i) => idx !== 0).length;
  console.log("Non-zero path indices:", nonZeroIndices);
  console.log("All indices are 1, meaning our leaf is always on the left");
  console.log("This might be the issue - check tree building logic");

  return {
    computedRoot: currentHash.toString(),
    expectedRoot: input.merkleRoot,
    match: currentHash.toString() === input.merkleRoot,
  };
}

debugMerkleTreeLogic().catch(console.error);
