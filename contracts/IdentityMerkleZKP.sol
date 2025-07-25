// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IdentityMerkleVerifier.sol";

/**
 * @title IdentityMerkleZKP
 * @dev Simplified smart contract for identity verification using ZKP and Merkle Trees
 * @notice This version includes individual identity tracking for direct status checks
 */
contract IdentityMerkleZKP {
    Groth16Verifier private verifier;

    // Essential Merkle tree management
    bytes32 public currentMerkleRoot;

    // Individual identity tracking
    mapping(bytes32 => bool) public approvedIdentities;
    mapping(bytes32 => uint256) public identityApprovalBlock;
    uint256 public totalApprovedIdentities;

    // Administration
    address public admin;

    // Events
    event MerkleRootUpdated(bytes32 indexed oldRoot, bytes32 indexed newRoot);
    event IdentityApproved(bytes32 indexed identityHash);
    event IdentityRevoked(bytes32 indexed identityHash);
    event IdentityVerified(
        address indexed verifier,
        bytes32 indexed identityHash
    );
    event AdminChanged(address indexed oldAdmin, address indexed newAdmin);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }

    /**
     * @dev Constructor sets up the verifier and admin
     * @param _verifier Address of the Groth16Verifier contract
     */
    constructor(address _verifier) {
        require(_verifier != address(0), "Invalid verifier address");
        verifier = Groth16Verifier(_verifier);
        admin = msg.sender;
    }

    /**
     * @notice Update Merkle root and approve multiple identities
     * @dev This combines root update with identity approval for gas efficiency
     * @param newRoot New Merkle root hash
     * @param identityHashes Array of identity hashes to approve
     */
    function updateMerkleRootWithIdentities(
        bytes32 newRoot,
        bytes32[] calldata identityHashes
    ) external onlyAdmin {
        require(newRoot != bytes32(0), "Invalid root hash");
        require(identityHashes.length > 0, "Empty identities array");
        require(identityHashes.length <= 100, "Too many identities"); // Gas limit protection

        // Update Merkle root
        bytes32 oldRoot = currentMerkleRoot;
        currentMerkleRoot = newRoot;

        // Approve identities
        for (uint256 i = 0; i < identityHashes.length; i++) {
            bytes32 identityHash = identityHashes[i];
            require(identityHash != bytes32(0), "Invalid identity hash");

            if (!approvedIdentities[identityHash]) {
                approvedIdentities[identityHash] = true;
                identityApprovalBlock[identityHash] = block.number;
                totalApprovedIdentities++;
                emit IdentityApproved(identityHash);
            }
        }

        emit MerkleRootUpdated(oldRoot, newRoot);
    }

    /**
     * @notice Update only the Merkle root without approving new identities
     * @dev Use this when updating tree structure without new approvals
     * @param newRoot New Merkle root hash
     */
    function updateMerkleRoot(bytes32 newRoot) external onlyAdmin {
        require(newRoot != bytes32(0), "Invalid root hash");
        require(newRoot != currentMerkleRoot, "Root already current");

        bytes32 oldRoot = currentMerkleRoot;
        currentMerkleRoot = newRoot;

        emit MerkleRootUpdated(oldRoot, newRoot);
    }

    /**
     * @notice Verify identity using ZKP and Merkle inclusion proof
     * @dev Anyone can verify multiple times - no restrictions
     * @param a ZKP proof component a
     * @param b ZKP proof component b
     * @param c ZKP proof component c
     * @param identityHash The identity hash being verified (for event emission)
     */
    function verifyIdentity(
        uint[2] calldata a,
        uint[2][2] calldata b,
        uint[2] calldata c,
        bytes32 identityHash
    ) external returns (bool) {
        require(currentMerkleRoot != bytes32(0), "No Merkle root set");

        // Prepare public input for verifier (only merkleRoot)
        uint[1] memory input;
        input[0] = uint256(currentMerkleRoot);

        // Verify the ZKP proof
        bool result = verifier.verifyProof(a, b, c, input);
        require(result, "Invalid ZK proof");

        // Emit event for tracking
        emit IdentityVerified(msg.sender, identityHash);

        return true;
    }

    /**
     * @notice Approve a single identity without updating Merkle root
     * @dev Use this for individual approvals outside of batch updates
     * @param identityHash Identity hash to approve
     */
    function approveIdentity(bytes32 identityHash) external onlyAdmin {
        require(identityHash != bytes32(0), "Invalid identity hash");
        require(!approvedIdentities[identityHash], "Already approved");

        approvedIdentities[identityHash] = true;
        identityApprovalBlock[identityHash] = block.number;
        totalApprovedIdentities++;

        emit IdentityApproved(identityHash);
    }

    /**
     * @notice Revoke an approved identity
     * @dev This doesn't update the Merkle tree - handle that separately
     * @param identityHash Identity hash to revoke
     */
    function revokeIdentity(bytes32 identityHash) external onlyAdmin {
        require(approvedIdentities[identityHash], "Identity not approved");

        approvedIdentities[identityHash] = false;
        totalApprovedIdentities--;

        emit IdentityRevoked(identityHash);
    }

    /**
     * @notice Transfer admin role to new address
     * @param newAdmin New admin address
     */
    function transferAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "Invalid new admin address");
        require(newAdmin != admin, "Already admin");

        address oldAdmin = admin;
        admin = newAdmin;

        emit AdminChanged(oldAdmin, newAdmin);
    }

    // ==================== VIEW FUNCTIONS ====================

    /**
     * @notice Check if an identity is approved
     * @param identityHash Identity hash to check
     * @return bool True if identity is approved
     */
    function isIdentityApproved(
        bytes32 identityHash
    ) external view returns (bool) {
        return approvedIdentities[identityHash];
    }

    /**
     * @notice Get approval details for an identity
     * @param identityHash Identity hash to query
     * @return approved Whether identity is approved
     * @return approvalBlock Block number when approved (0 if never approved)
     */
    function getIdentityInfo(
        bytes32 identityHash
    ) external view returns (bool approved, uint256 approvalBlock) {
        return (
            approvedIdentities[identityHash],
            identityApprovalBlock[identityHash]
        );
    }

    /**
     * @notice Get contract statistics
     * @return merkleRoot Current Merkle root
     * @return totalIdentities Total number of approved identities
     * @return contractAdmin Admin address
     */
    function getContractInfo()
        external
        view
        returns (
            bytes32 merkleRoot,
            uint256 totalIdentities,
            address contractAdmin
        )
    {
        return (currentMerkleRoot, totalApprovedIdentities, admin);
    }

    /**
     * @notice Compute identity hash off-chain helper
     * @dev This is a pure function to help compute identity hashes
     * @param nik National Identity Number
     * @param nama Name (as bytes32)
     * @param ttl Date of birth (as number)
     * @param key Secret key (as bytes32)
     * @return The keccak256 hash of the identity data
     */
    function computeIdentityHash(
        uint256 nik,
        bytes32 nama,
        uint256 ttl,
        bytes32 key
    ) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(nik, nama, ttl, key));
    }
}
