// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IdentityVerifier.sol";

contract IdentityZKP {
    Groth16Verifier private verifier;
    mapping(bytes32 => bool) public isVerified;

    event ProofVerified(bytes32 indexed userId);

    constructor(address _verifier) {
        verifier = Groth16Verifier(_verifier);
    }

    /**
     * @notice Submit a zero knowledge proof to verify identity possession
     * @param userId An abstract identifier (can be wallet address, NIK hash, etc.)
     * @param a zkSNARK proof part A
     * @param b zkSNARK proof part B
     * @param c zkSNARK proof part C
     * @param publicSignals Array containing the identity hash
     */
    function submitProof(
        bytes32 userId,
        uint[2] calldata a,
        uint[2][2] calldata b,
        uint[2] calldata c,
        uint[1] calldata publicSignals
    ) external {
        bool result = verifier.verifyProof(a, b, c, publicSignals);
        require(result, "Invalid ZK proof");

        isVerified[userId] = true;
        emit ProofVerified(userId);
    }
}
