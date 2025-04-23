// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IdentityVerifier.sol";

contract IdentityZKP {
    Groth16Verifier private verifier;

    address public admin;

    mapping(bytes32 => uint256) public submittedHash; // hash yang dikirim user
    mapping(bytes32 => bool) public hasSubmitted; // status: apakah user pernah submit
    mapping(bytes32 => bool) public isApproved; // status: apakah hash disetujui admin

    mapping(bytes32 => uint256) public registeredHash; // hash yang disahkan
    mapping(bytes32 => bool) public isRegistered; // status: sudah terdaftar secara resmi
    mapping(bytes32 => bool) public isVerified; // status: proof valid

    event HashSubmitted(bytes32 indexed userId, uint256 hash);
    event IdentityApproved(bytes32 indexed userId, uint256 hash);
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
     */
    function setAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "Invalid new admin");
        emit AdminChanged(admin, newAdmin);
        admin = newAdmin;
    }

    /**
     * @notice User submits their own identity hash
     */
    function submitHashByUser(bytes32 userId, uint256 hash) external {
        submittedHash[userId] = hash;
        hasSubmitted[userId] = true;

        emit HashSubmitted(userId, hash);
    }

    /**
     * @notice Admin approves submitted hash and registers it for verification
     */
    function approveIdentity(bytes32 userId) external onlyAdmin {
        require(hasSubmitted[userId], "Hash not submitted by user");

        uint256 hash = submittedHash[userId];
        registeredHash[userId] = hash;
        isRegistered[userId] = true;
        isApproved[userId] = true;

        emit IdentityApproved(userId, hash);
    }

    /**
     * @notice User submits ZKP proof for their approved identity
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
