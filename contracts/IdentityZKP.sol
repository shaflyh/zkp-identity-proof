// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IdentityVerifier.sol";

contract IdentityZKP {
    Groth16Verifier private verifier;
    mapping(address => bool) public isVerified;

    event ProofVerified(address indexed user);
    event DebugEvent(string message, bool result);

    constructor(address _verifier) {
        verifier = Groth16Verifier(_verifier);
    }

    /**
     * @notice Submit a zero knowledge proof to verify identity possession
     * @param a zkSNARK proof part A
     * @param b zkSNARK proof part B
     * @param c zkSNARK proof part C
     * @param publicSignals Array containing the identity hash
     */
    function submitProof(
        uint[2] calldata a,
        uint[2][2] calldata b,
        uint[2] calldata c,
        uint[1] calldata publicSignals
    ) external {
        bool result = verifier.verifyProof(a, b, c, publicSignals);
        emit DebugEvent("Verification result", result);

        require(result, "Invalid ZK proof");
        isVerified[msg.sender] = true;
        emit ProofVerified(msg.sender);
    }

    function isUserVerified(address user) external view returns (bool) {
        return isVerified[user];
    }
}
