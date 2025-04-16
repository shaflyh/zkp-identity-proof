pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";

/*
 * Circuit: IdentityPossessionProof
 * Purpose: Proves knowledge of identity data (e.g. NIK, Name, TTL)
 *          without revealing it, by matching against public hash H.
 * 
 * Public input:
 * - identityHash: Poseidon hash of [nik, nama, ttl]
 * 
 * Private inputs:
 * - nik: numeric representation of NIK
 * - nama: numeric representation of hashed name (or preprocessed)
 * - ttl: numeric timestamp of date of birth
 */

template IdentityPossessionProof() {
    // Public input
    signal input identityHash;

    // Private inputs
    signal input nik;
    signal input nama;
    signal input ttl;

    // Internal hasher
    component hasher = Poseidon(3);
    hasher.inputs[0] <== nik;
    hasher.inputs[1] <== nama;
    hasher.inputs[2] <== ttl;

    // Constrain hash match
    identityHash === hasher.out;
}

// Main circuit instantiation
component main { public [identityHash] } = IdentityPossessionProof();
