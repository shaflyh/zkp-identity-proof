const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");

/**
 * Generate a Merkle Tree and proofs for a list of identities
 * @param {string[]} identities - Array of user IDs (as hex strings)
 * @returns {Object} Merkle Tree info including root and ability to generate proofs
 */
function generateMerkleTree(identities) {
  // Hash each identity (already in bytes32 format)
  const leaves = identities.map((id) => keccak256(id));

  // Create Merkle Tree
  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });

  // Get root
  const root = tree.getHexRoot();

  return {
    tree,
    root,
    getProof: (userId) => {
      const leaf = keccak256(userId);
      return tree.getHexProof(leaf);
    },
    verifyProof: (userId, proof) => {
      const leaf = keccak256(userId);
      return tree.verify(proof, leaf, root);
    },
  };
}

// Example usage
const userIds = [
  "0x1234567890123456789012345678901234567890123456789012345678901234",
  "0x2345678901234567890123456789012345678901234567890123456789012345",
  // ... more user IDs
];

const merkleData = generateMerkleTree(userIds);
console.log("Merkle Root:", merkleData.root);

// Get proof for specific user
const userId = userIds[0];
const proof = merkleData.getProof(userId);
console.log("Proof for user:", proof);

// Verify proof
const isValid = merkleData.verifyProof(userId, proof);
console.log("Proof valid:", isValid);
