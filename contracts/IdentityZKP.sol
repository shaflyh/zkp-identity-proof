// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IdentityVerifier.sol";

contract IdentityZKP {
    Groth16Verifier private verifier;

    address public admin;

    mapping(bytes32 => uint256) public registeredHash;
    mapping(bytes32 => bool) public isRegistered;
    mapping(bytes32 => bool) public isVerified;

    event HashRegistered(bytes32 indexed userId, uint256 hash);
    event ProofVerified(bytes32 indexed userId);
    event AdminChanged(address indexed oldAdmin, address indexed newAdmin);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }

    constructor(address _verifier) {
        verifier = Groth16Verifier(_verifier);
        admin = msg.sender;
    }

    /**
     * @notice Change admin to a new address
     * @param newAdmin The new admin address
     */
    function setAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "Invalid new admin");
        emit AdminChanged(admin, newAdmin);
        admin = newAdmin;
    }

    /**
     * @notice Register or update identity hash for a specific userId (only admin)
     * @param userId An abstract identifier (wallet address, backend user ID, NIK, etc.)
     * @param hash The identity hash (public signal)
     */
    function registerHash(bytes32 userId, uint256 hash) external onlyAdmin {
        registeredHash[userId] = hash;
        isRegistered[userId] = true;
        emit HashRegistered(userId, hash);
    }

    /**
     * @notice Submit a zk-SNARK proof to verify possession of identity
     * @param userId The identifier corresponding to the registered hash
     * @param a zkSNARK proof component
     * @param b zkSNARK proof component
     * @param c zkSNARK proof component
     */
    function submitProof(
        bytes32 userId,
        uint[2] calldata a,
        uint[2][2] calldata b,
        uint[2] calldata c
    ) external {
        require(isRegistered[userId], "Hash not registered");

        uint[1] memory input;
        input[0] = registeredHash[userId];

        bool result = verifier.verifyProof(a, b, c, input);
        require(result, "Invalid ZK proof");

        isVerified[userId] = true;
        emit ProofVerified(userId);
    }
}
