// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IdentityMerkleVerifier.sol";

/**
 * @title IdentityMerkleZKP
 * @dev Smart contract for scalable identity verification using Zero Knowledge Proofs and Merkle Trees
 * @notice This contract allows identity verification without exposing private data while supporting unlimited users
 */
contract IdentityMerkleZKP {
    Groth16Verifier private verifier;

    // Merkle tree management
    bytes32 public currentMerkleRoot;
    mapping(bytes32 => bool) public validRoots;
    mapping(bytes32 => uint256) public rootTimestamp;
    uint256 public rootNonce;

    // Administration
    address public admin;
    mapping(address => bool) public subAdmins;

    // User verification tracking
    mapping(address => bool) public isVerified;
    mapping(address => bytes32) public userMerkleRoot;
    mapping(address => uint256) public verificationTimestamp;

    // Constants
    uint256 public constant ROOT_EXPIRY_TIME = 30 days; // Merkle roots expire after 30 days
    uint256 public constant MAX_BATCH_SIZE = 100; // Maximum batch operations

    // Events
    event MerkleRootUpdated(
        bytes32 indexed oldRoot,
        bytes32 indexed newRoot,
        uint256 nonce,
        uint256 timestamp
    );
    event IdentityVerified(
        address indexed user,
        bytes32 indexed merkleRoot,
        uint256 timestamp
    );
    event SubAdminAdded(address indexed subAdmin);
    event SubAdminRemoved(address indexed subAdmin);
    event AdminChanged(address indexed oldAdmin, address indexed newAdmin);
    event VerificationRevoked(address indexed user, string reason);
    event RootExpired(bytes32 indexed root, uint256 expiredAt);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }

    modifier onlyAdminOrSubAdmin() {
        require(
            msg.sender == admin || subAdmins[msg.sender],
            "Only admin or sub-admin can perform this action"
        );
        _;
    }

    modifier validMerkleRoot(bytes32 root) {
        require(root != bytes32(0), "Invalid root hash");
        require(validRoots[root], "Root not valid or expired");
        require(
            block.timestamp <= rootTimestamp[root] + ROOT_EXPIRY_TIME,
            "Root has expired"
        );
        _;
    }

    /**
     * @dev Constructor sets up the verifier and initial admin
     * @param _verifier Address of the Groth16Verifier contract
     * @param _initialRoot Initial Merkle root (optional, can be bytes32(0))
     */
    constructor(address _verifier, bytes32 _initialRoot) {
        require(_verifier != address(0), "Invalid verifier address");

        verifier = Groth16Verifier(_verifier);
        admin = msg.sender;

        // Set initial root if provided
        if (_initialRoot != bytes32(0)) {
            currentMerkleRoot = _initialRoot;
            validRoots[_initialRoot] = true;
            rootTimestamp[_initialRoot] = block.timestamp;

            emit MerkleRootUpdated(
                bytes32(0),
                _initialRoot,
                0,
                block.timestamp
            );
        }
    }

    /**
     * @notice Update Merkle root with batch of new approved identities
     * @dev Only admin or sub-admin can update the root
     * @param newRoot New Merkle root hash
     */
    function updateMerkleRoot(bytes32 newRoot) external onlyAdminOrSubAdmin {
        require(newRoot != bytes32(0), "Invalid root hash");
        require(newRoot != currentMerkleRoot, "Root already current");

        bytes32 oldRoot = currentMerkleRoot;
        currentMerkleRoot = newRoot;
        validRoots[newRoot] = true;
        rootTimestamp[newRoot] = block.timestamp;
        rootNonce++;

        emit MerkleRootUpdated(oldRoot, newRoot, rootNonce, block.timestamp);
    }

    /**
     * @notice Verify user identity using ZKP and Merkle inclusion proof
     * @dev User must provide valid ZKP proof that includes Merkle inclusion
     * @param a ZKP proof component a
     * @param b ZKP proof component b
     * @param c ZKP proof component c
     * @param merkleRoot The Merkle root that user is proving inclusion in
     */
    function verifyIdentity(
        uint[2] calldata a,
        uint[2][2] calldata b,
        uint[2] calldata c,
        bytes32 merkleRoot
    ) external validMerkleRoot(merkleRoot) returns (bool) {
        require(!isVerified[msg.sender], "User already verified");

        // Prepare public input for verifier (only merkleRoot)
        uint[1] memory input;
        input[0] = uint256(merkleRoot);

        // Verify the ZKP proof
        bool result = verifier.verifyProof(a, b, c, input);
        require(result, "Invalid ZK proof");

        // Update user verification status
        isVerified[msg.sender] = true;
        userMerkleRoot[msg.sender] = merkleRoot;
        verificationTimestamp[msg.sender] = block.timestamp;

        emit IdentityVerified(msg.sender, merkleRoot, block.timestamp);
        return true;
    }

    /**
     * @notice Batch update multiple Merkle roots for migration or multiple approvals
     * @dev Useful for migrating from old roots or handling multiple approval batches
     * @param roots Array of new valid roots
     */
    function batchUpdateRoots(bytes32[] calldata roots) external onlyAdmin {
        require(roots.length > 0, "Empty roots array");
        require(roots.length <= MAX_BATCH_SIZE, "Batch size exceeds limit");

        for (uint i = 0; i < roots.length; i++) {
            require(roots[i] != bytes32(0), "Invalid root in batch");
            validRoots[roots[i]] = true;
            rootTimestamp[roots[i]] = block.timestamp;
        }

        // Set the last root as current
        bytes32 oldRoot = currentMerkleRoot;
        currentMerkleRoot = roots[roots.length - 1];
        rootNonce++;

        emit MerkleRootUpdated(
            oldRoot,
            currentMerkleRoot,
            rootNonce,
            block.timestamp
        );
    }

    /**
     * @notice Add sub-administrator with limited permissions
     * @param subAdmin Address to add as sub-admin
     */
    function addSubAdmin(address subAdmin) external onlyAdmin {
        require(subAdmin != address(0), "Invalid sub-admin address");
        require(subAdmin != admin, "Admin cannot be sub-admin");
        require(!subAdmins[subAdmin], "Already a sub-admin");

        subAdmins[subAdmin] = true;
        emit SubAdminAdded(subAdmin);
    }

    /**
     * @notice Remove sub-administrator
     * @param subAdmin Address to remove from sub-admin
     */
    function removeSubAdmin(address subAdmin) external onlyAdmin {
        require(subAdmins[subAdmin], "Not a sub-admin");

        subAdmins[subAdmin] = false;
        emit SubAdminRemoved(subAdmin);
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

    /**
     * @notice Revoke user verification (emergency function)
     * @param user User address to revoke
     * @param reason Reason for revocation
     */
    function revokeVerification(
        address user,
        string calldata reason
    ) external onlyAdmin {
        require(isVerified[user], "User not verified");

        isVerified[user] = false;
        delete userMerkleRoot[user];
        delete verificationTimestamp[user];

        emit VerificationRevoked(user, reason);
    }

    /**
     * @notice Invalidate old Merkle root (security function)
     * @param oldRoot Root to invalidate
     */
    function invalidateRoot(bytes32 oldRoot) external onlyAdmin {
        require(validRoots[oldRoot], "Root not valid");
        require(oldRoot != currentMerkleRoot, "Cannot invalidate current root");

        validRoots[oldRoot] = false;
        emit RootExpired(oldRoot, block.timestamp);
    }

    /**
     * @notice Clean up expired roots (maintenance function)
     * @param roots Array of potentially expired roots to check and clean
     */
    function cleanupExpiredRoots(bytes32[] calldata roots) external {
        for (uint i = 0; i < roots.length && i < MAX_BATCH_SIZE; i++) {
            bytes32 root = roots[i];
            if (
                validRoots[root] &&
                block.timestamp > rootTimestamp[root] + ROOT_EXPIRY_TIME &&
                root != currentMerkleRoot
            ) {
                validRoots[root] = false;
                emit RootExpired(root, block.timestamp);
            }
        }
    }

    // ==================== VIEW FUNCTIONS ====================

    /**
     * @notice Check if a root is valid and not expired
     * @param root Root to check
     * @return bool True if root is valid and not expired
     */
    function isValidRoot(bytes32 root) external view returns (bool) {
        return
            validRoots[root] &&
            block.timestamp <= rootTimestamp[root] + ROOT_EXPIRY_TIME;
    }

    /**
     * @notice Get comprehensive user verification information
     * @param user User address to query
     * @return verified Whether user is verified
     * @return merkleRoot The Merkle root used for verification
     * @return timestamp When verification occurred
     */
    function getUserVerificationInfo(
        address user
    )
        external
        view
        returns (bool verified, bytes32 merkleRoot, uint256 timestamp)
    {
        return (
            isVerified[user],
            userMerkleRoot[user],
            verificationTimestamp[user]
        );
    }

    /**
     * @notice Check if address is sub-admin
     * @param account Address to check
     * @return bool True if address is sub-admin
     */
    function isSubAdmin(address account) external view returns (bool) {
        return subAdmins[account];
    }

    /**
     * @notice Get root information
     * @param root Root to query
     * @return isValid Whether root is valid
     * @return timestamp When root was created
     * @return isExpired Whether root has expired
     */
    function getRootInfo(
        bytes32 root
    ) external view returns (bool isValid, uint256 timestamp, bool isExpired) {
        return (
            validRoots[root],
            rootTimestamp[root],
            block.timestamp > rootTimestamp[root] + ROOT_EXPIRY_TIME
        );
    }

    /**
     * @notice Get contract statistics
     * @return currentRoot Current Merkle root
     * @return totalRootUpdates Total number of root updates
     * @return contractAdmin Admin address
     */
    function getContractInfo()
        external
        view
        returns (
            bytes32 currentRoot,
            uint256 totalRootUpdates,
            address contractAdmin
        )
    {
        return (currentMerkleRoot, rootNonce, admin);
    }
}
