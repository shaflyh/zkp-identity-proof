pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";

/*
 * Circuit: IdentityMerkleProof
 * Purpose: Proves knowledge of identity data AND that this identity
 *          is included in a Merkle tree of approved identities.
 * 
 * Public input:
 * - merkleRoot: Root of the Merkle tree containing approved identities
 * 
 * Private inputs:
 * - nik: numeric representation of NIK
 * - nama: numeric representation of hashed name  
 * - ttl: numeric timestamp of date of birth
 * - key: numeric representation of key input from user
 * - pathElements[levels]: sibling hashes for Merkle proof
 * - pathIndices[levels]: direction indicators (0=left, 1=right)
 * - salt: random salt for leaf uniqueness
 */

template MerkleTreeInclusionProof(levels) {
    signal input leaf;
    signal input pathElements[levels];
    signal input pathIndices[levels];
    signal output root;

    // Declare all components at the beginning
    component leftHashers[levels];
    component rightHashers[levels];

    signal levelHashes[levels + 1];
    levelHashes[0] <== leaf;

    for (var i = 0; i < levels; i++) {
        // Constrain pathIndices to be 0 or 1
        pathIndices[i] * (pathIndices[i] - 1) === 0;
        
        // Initialize components
        leftHashers[i] = Poseidon(2);
        rightHashers[i] = Poseidon(2);
        
        // Calculate both possible hash orders
        // leftHashers: current hash on left, pathElement on right
        leftHashers[i].inputs[0] <== levelHashes[i];
        leftHashers[i].inputs[1] <== pathElements[i];
        
        // rightHashers: pathElement on left, current hash on right  
        rightHashers[i].inputs[0] <== pathElements[i];
        rightHashers[i].inputs[1] <== levelHashes[i];
        
        // Select the correct hash based on pathIndices[i]
        // pathIndices[i] = 0: pathElement is on left (use rightHashers)
        // pathIndices[i] = 1: pathElement is on right (use leftHashers)
        levelHashes[i + 1] <== rightHashers[i].out + pathIndices[i] * (leftHashers[i].out - rightHashers[i].out);
    }

    root <== levelHashes[levels];
}

template IdentityMerkleProof(levels) {
    // Public input
    signal input merkleRoot;

    // Private inputs - Identity data
    signal input nik;
    signal input nama;
    signal input ttl;
    signal input key;

    // Private inputs - Merkle proof
    signal input pathElements[levels];
    signal input pathIndices[levels];
    signal input salt;

    // Step 1: Compute identity hash (same as original circuit)
    component identityHasher = Poseidon(4);
    identityHasher.inputs[0] <== nik;
    identityHasher.inputs[1] <== nama;
    identityHasher.inputs[2] <== ttl;
    identityHasher.inputs[3] <== key;

    // Step 2: Create leaf hash with salt and status
    component leafHasher = Poseidon(3);
    leafHasher.inputs[0] <== identityHasher.out;
    leafHasher.inputs[1] <== salt;
    leafHasher.inputs[2] <== 1; // status: 1 = active, 0 = revoked

    // Step 3: Verify Merkle tree inclusion
    component merkleProof = MerkleTreeInclusionProof(levels);
    merkleProof.leaf <== leafHasher.out;
    for (var i = 0; i < levels; i++) {
        merkleProof.pathElements[i] <== pathElements[i];
        merkleProof.pathIndices[i] <== pathIndices[i];
    }

    // Step 4: Constraint that computed root matches expected root
    merkleRoot === merkleProof.root;
}

// Main circuit instantiation with 16 levels (supports up to 65,536 identities)
component main { public [merkleRoot] } = IdentityMerkleProof(16);