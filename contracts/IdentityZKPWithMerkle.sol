// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IdentityVerifier.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract IdentityZKPWithMerkle {
    Groth16Verifier private verifier;
    address public admin;

    // Existing mappings
    mapping(bytes32 => uint256) public submittedHash;
    mapping(bytes32 => bool) public hasSubmitted;
    mapping(bytes32 => bool) public isApproved;
    mapping(bytes32 => bool) public isVerified;

    // Merkle root untuk set identitas yang disetujui
    bytes32 public approvedIdentitiesRoot;

    // Merkle root untuk set identitas yang direvokasi
    bytes32 public revokedIdentitiesRoot;

    // Events
    event HashSubmitted(bytes32 indexed userId, uint256 hash);
    event IdentityApproved(bytes32 indexed userId, uint256 hash);
    event ProofVerified(bytes32 indexed userId);
    event AdminChanged(address indexed oldAdmin, address indexed newAdmin);
    event IdentityRevoked(bytes32 indexed userId, uint8 reason);
    event ApprovedMerkleRootUpdated(bytes32 oldRoot, bytes32 newRoot);
    event RevokedMerkleRootUpdated(bytes32 oldRoot, bytes32 newRoot);
    event BatchApproval(uint256 count, bytes32 merkleRoot);
    event BatchRevocation(uint256 count, bytes32 merkleRoot);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }

    constructor(address _verifier) {
        verifier = Groth16Verifier(_verifier);
        admin = msg.sender;
    }

    // Existing functions...

    /**
     * @notice Update the Merkle root for approved identities
     * @param newRoot The new Merkle root
     */
    function updateApprovedMerkleRoot(bytes32 newRoot) external onlyAdmin {
        emit ApprovedMerkleRootUpdated(approvedIdentitiesRoot, newRoot);
        approvedIdentitiesRoot = newRoot;
    }

    /**
     * @notice Update the Merkle root for revoked identities
     * @param newRoot The new Merkle root
     */
    function updateRevokedMerkleRoot(bytes32 newRoot) external onlyAdmin {
        emit RevokedMerkleRootUpdated(revokedIdentitiesRoot, newRoot);
        revokedIdentitiesRoot = newRoot;
    }

    /**
     * @notice Register a batch of approved identities by setting a new Merkle root
     * @param newRoot The new Merkle root containing all approved identities
     * @param count Approximate number of identities in the batch (for event only)
     */
    function batchApproveIdentities(
        bytes32 newRoot,
        uint256 count
    ) external onlyAdmin {
        approvedIdentitiesRoot = newRoot;
        emit BatchApproval(count, newRoot);
    }

    /**
     * @notice Register a batch of revoked identities by setting a new Merkle root
     * @param newRoot The new Merkle root containing all revoked identities
     * @param count Approximate number of identities in the batch (for event only)
     */
    function batchRevokeIdentities(
        bytes32 newRoot,
        uint256 count
    ) external onlyAdmin {
        revokedIdentitiesRoot = newRoot;
        emit BatchRevocation(count, newRoot);
    }

    /**
     * @notice Check if an identity is approved using Merkle proof
     * @param userId The ID of the user
     * @param proof Merkle proof showing user is in the approved set
     * @return True if user is in the approved set
     */
    function verifyApprovedWithMerkle(
        bytes32 userId,
        bytes32[] calldata proof
    ) public view returns (bool) {
        return
            MerkleProof.verify(
                proof,
                approvedIdentitiesRoot,
                keccak256(abi.encodePacked(userId))
            );
    }

    /**
     * @notice Check if an identity is revoked using Merkle proof
     * @param userId The ID of the user
     * @param proof Merkle proof showing user is in the revoked set
     * @return True if user is in the revoked set
     */
    function verifyRevokedWithMerkle(
        bytes32 userId,
        bytes32[] calldata proof
    ) public view returns (bool) {
        return
            MerkleProof.verify(
                proof,
                revokedIdentitiesRoot,
                keccak256(abi.encodePacked(userId))
            );
    }

    /**
     * @notice Submit ZKP proof with Merkle verification
     * @dev Verifies that the user is approved (via Merkle proof) and not revoked
     */
    function submitProofWithMerkle(
        bytes32 userId,
        uint[2] calldata a,
        uint[2][2] calldata b,
        uint[2] calldata c,
        bytes32[] calldata approvalProof,
        bytes32[] calldata revocationProof
    ) external {
        // Verify user is in approved set
        require(
            verifyApprovedWithMerkle(userId, approvalProof),
            "User not in approved set"
        );

        // Verify user is NOT in revoked set
        require(
            !verifyRevokedWithMerkle(userId, revocationProof),
            "User has been revoked"
        );

        uint[1] memory input;
        input[0] = submittedHash[userId];

        bool result = verifier.verifyProof(a, b, c, input);
        require(result, "Invalid ZK proof");

        isVerified[userId] = true;
        emit ProofVerified(userId);
    }

    /**
     * @notice Get batch verification status
     * @param userIds Array of user IDs to check
     * @param approvalProofs Array of Merkle proofs for approval
     * @return Array of boolean values indicating verification status
     */
    function batchVerificationStatus(
        bytes32[] calldata userIds,
        bytes32[][] calldata approvalProofs
    ) external view returns (bool[] memory) {
        require(
            userIds.length == approvalProofs.length,
            "Array length mismatch"
        );

        bool[] memory results = new bool[](userIds.length);

        for (uint256 i = 0; i < userIds.length; i++) {
            // User is verified if:
            // 1. They've been individually verified in the contract
            // 2. OR they can prove they're in the approved Merkle tree
            results[i] =
                isVerified[userIds[i]] ||
                verifyApprovedWithMerkle(userIds[i], approvalProofs[i]);
        }

        return results;
    }
}
