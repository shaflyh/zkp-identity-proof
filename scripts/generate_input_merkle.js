const fs = require("fs");
const poseidon = require("circomlibjs").buildPoseidon;

// Sample identity values (replace with real user input)
const nik = 3204280701000002n;
const namaHashed = 987654321n;
const ttl = 20000101n;
const key = 99999n;
const salt = 123456789n; // Random salt for leaf uniqueness

// Simple Merkle Tree implementation with Poseidon
class SimpleMerkleTree {
  constructor(leaves, levels = 16) {
    this.leaves = leaves.map(l => BigInt(l));
    this.levels = levels;
    this.tree = [];
    this.poseidonLib = null; // Will be set later
  }

  setPoseidon(poseidonLib) {
    this.poseidonLib = poseidonLib;
    this.buildTree(); // Build tree after setting poseidon
  }

  buildTree() {
    if (!this.poseidonLib) {
      throw new Error("Poseidon library not set. Call setPoseidon() first.");
    }

    // Initialize tree array
    for (let i = 0; i <= this.levels; i++) {
      this.tree[i] = [];
    }

    // Set leaves at level 0 (bottom)
    this.tree[0] = [...this.leaves];
    
    // Pad leaves to power of 2
    const maxLeaves = 2 ** this.levels;
    while (this.tree[0].length < maxLeaves) {
      this.tree[0].push(0n);
    }

    // Build tree from bottom to top
    for (let level = 0; level < this.levels; level++) {
      const currentLevel = this.tree[level];
      const nextLevel = [];
      
      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        const right = currentLevel[i + 1] || 0n;
        const parent = this.poseidonHash(left, right);
        nextLevel.push(parent);
      }
      
      this.tree[level + 1] = nextLevel;
    }
  }

  poseidonHash(left, right) {
    return this.poseidonLib.F.toObject(this.poseidonLib([BigInt(left), BigInt(right)]));
  }

  getRoot() {
    return this.tree[this.levels][0];
  }

  getProof(leafIndex) {
    const proof = {
      pathElements: [],
      pathIndices: []
    };

    let currentIndex = leafIndex;
    
    for (let level = 0; level < this.levels; level++) {
      const isRightNode = currentIndex % 2 === 1;
      const siblingIndex = isRightNode ? currentIndex - 1 : currentIndex + 1;
      
      // Get sibling hash (or 0 if doesn't exist)
      const sibling = this.tree[level][siblingIndex] || 0n;
      proof.pathElements.push(sibling);
      
      // FIXED: Path index should indicate where the sibling is
      // 0 = sibling is on left (current node on right)
      // 1 = sibling is on right (current node on left)
      proof.pathIndices.push(isRightNode ? 0 : 1);
      
      currentIndex = Math.floor(currentIndex / 2);
    }

    return proof;
  }

  verify(proof, leaf, root) {
    let computedHash = BigInt(leaf);
    
    for (let i = 0; i < proof.pathElements.length; i++) {
      const pathElement = BigInt(proof.pathElements[i]);
      
      if (proof.pathIndices[i] === 0) {
        // Current hash is on the right
        computedHash = this.poseidonHash(pathElement, computedHash);
      } else {
        // Current hash is on the left
        computedHash = this.poseidonHash(computedHash, pathElement);
      }
    }

    return computedHash.toString() === BigInt(root).toString();
  }
}

async function generateInputJson() {
  const poseidonLib = await poseidon();

  // Step 1: Generate identity hash (same as before)
  const identityInputs = [nik, namaHashed, ttl, key];
  const identityHash = poseidonLib.F.toObject(poseidonLib(identityInputs));

  // Step 2: Generate leaf hash with salt and status
  const leafInputs = [identityHash, salt, 1]; // status: 1 = active
  const leafHash = poseidonLib.F.toObject(poseidonLib(leafInputs));

  // Step 3: Create sample Merkle tree (simulate multiple users)
  console.log("🌳 Creating sample Merkle tree...");
  
  // Create dummy leaves (simulate other approved users)
  const allLeaves = [];
  for (let i = 0; i < 8; i++) {
    if (i === 0) {
      // Our user's leaf
      allLeaves.push(leafHash.toString());
    } else {
      // Dummy leaves for other users
      const dummyLeaf = poseidonLib.F.toObject(poseidonLib([BigInt(i * 1000), BigInt(i * 2000), 1n]));
      allLeaves.push(dummyLeaf.toString());
    }
  }

  // Create custom Merkle tree
  const merkleTree = new SimpleMerkleTree(allLeaves, 16);
  
  // Set poseidon function and build tree
  merkleTree.setPoseidon(poseidonLib);

  const merkleRoot = merkleTree.getRoot().toString();

  // Step 4: Generate Merkle proof for our user (leaf index 0)
  const proof = merkleTree.getProof(0);
  
  // Convert to string format for circuit
  const pathElements = proof.pathElements.map(p => p.toString());
  const pathIndices = proof.pathIndices;

  // Step 5: Create input object for circuit
  const inputObject = {
    // Public input
    merkleRoot: merkleRoot,
    
    // Private inputs - Identity
    nik: nik.toString(),
    nama: namaHashed.toString(),
    ttl: ttl.toString(),
    key: key.toString(),
    
    // Private inputs - Merkle proof
    pathElements: pathElements,
    pathIndices: pathIndices,
    salt: salt.toString()
  };

  fs.writeFileSync("input_merkle.json", JSON.stringify(inputObject, null, 2));
  
  console.log("✅ input_merkle.json generated successfully:");
  console.log("📊 Identity Hash:", identityHash.toString());
  console.log("🍃 Leaf Hash:", leafHash.toString());
  console.log("🌳 Merkle Root:", merkleRoot);
  console.log("📍 Tree Levels:", 16);
  console.log("🔍 Manual Verification:", merkleTree.verify(proof, leafHash, merkleRoot));
  
  // Debug: Show tree structure
  console.log("\n🌲 Tree Structure:");
  console.log("Leaves count:", allLeaves.length);
  console.log("User leaf (index 0):", leafHash.toString().substring(0, 20) + "...");
  console.log("Root:", merkleRoot.substring(0, 20) + "...");
  console.log("Path length:", pathElements.length);
}

generateInputJson().catch(console.error);