const { expect } = require("chai");
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

describe("Gas Fee Comparison: IdentityZKP vs IdentityMerkleZKP", function () {
  let verifier;
  let identityZkp;
  let identityMerkleZkp;
  let admin, user1, user2, user3, newAdmin;

  // Test data
  let proofZKP, publicSignalsZKP, aZKP, bZKP, cZKP;
  let proofMerkle, publicSignalsMerkle, aMerkle, bMerkle, cMerkle;
  let sampleMerkleRoot;
  let sampleIdentityHash;

  // Gas tracking
  let gasResults = {
    identityZKP: {},
    identityMerkleZKP: {},
  };

  before(async () => {
    [admin, user1, user2, user3, newAdmin] = await ethers.getSigners();

    // Load proof data for IdentityZKP
    try {
      proofZKP = JSON.parse(
        fs.readFileSync(path.join(__dirname, "../build/proof_zkp.json"))
      );
      publicSignalsZKP = JSON.parse(
        fs.readFileSync(path.join(__dirname, "../build/public_zkp.json"))
      );

      aZKP = [proofZKP.pi_a[0], proofZKP.pi_a[1]];
      bZKP = [
        [proofZKP.pi_b[0][1], proofZKP.pi_b[0][0]],
        [proofZKP.pi_b[1][1], proofZKP.pi_b[1][0]],
      ];
      cZKP = [proofZKP.pi_c[0], proofZKP.pi_c[1]];
    } catch (error) {
      console.log("Warning: Using mock proof data for IdentityZKP testing");
      // Mock data for testing
      aZKP = ["1", "2"];
      bZKP = [
        ["3", "4"],
        ["5", "6"],
      ];
      cZKP = ["7", "8"];
      publicSignalsZKP = [
        "12345678901234567890123456789012345678901234567890123456789012",
      ];
    }

    // Load proof data for IdentityMerkleZKP
    try {
      proofMerkle = JSON.parse(
        fs.readFileSync(path.join(__dirname, "../build/proof_merkle.json"))
      );
      publicSignalsMerkle = JSON.parse(
        fs.readFileSync(path.join(__dirname, "../build/public_merkle.json"))
      );

      aMerkle = [proofMerkle.pi_a[0], proofMerkle.pi_a[1]];
      bMerkle = [
        [proofMerkle.pi_b[0][1], proofMerkle.pi_b[0][0]],
        [proofMerkle.pi_b[1][1], proofMerkle.pi_b[1][0]],
      ];
      cMerkle = [proofMerkle.pi_c[0], proofMerkle.pi_c[1]];
    } catch (error) {
      console.log(
        "Warning: Using mock proof data for IdentityMerkleZKP testing"
      );
      // Mock data for testing
      aMerkle = ["1", "2"];
      bMerkle = [
        ["3", "4"],
        ["5", "6"],
      ];
      cMerkle = ["7", "8"];
      publicSignalsMerkle = [
        "12345678901234567890123456789012345678901234567890123456789012",
      ];
    }

    sampleMerkleRoot =
      "0x" + BigInt(publicSignalsMerkle[0]).toString(16).padStart(64, "0");
    sampleIdentityHash = "0x" + "2".repeat(64);
  });

  beforeEach(async () => {
    // Deploy verifier
    const VerifierFactory = await ethers.getContractFactory(
      "contracts/IdentityVerifier.sol:Groth16Verifier"
    );
    const MerkleVerifierFactory = await ethers.getContractFactory(
      "contracts/IdentityMerkleVerifier.sol:Groth16Verifier"
    );

    verifier = await VerifierFactory.connect(admin).deploy();
    await verifier.waitForDeployment();

    const merkleVerifier = await MerkleVerifierFactory.connect(admin).deploy();
    await merkleVerifier.waitForDeployment();

    // Deploy IdentityZKP
    const IdentityZKPFactory = await ethers.getContractFactory("IdentityZKP");
    identityZkp = await IdentityZKPFactory.connect(admin).deploy(
      await verifier.getAddress()
    );
    await identityZkp.waitForDeployment();

    // Deploy IdentityMerkleZKP
    const IdentityMerkleZKPFactory = await ethers.getContractFactory(
      "IdentityMerkleZKP"
    );
    identityMerkleZkp = await IdentityMerkleZKPFactory.connect(admin).deploy(
      await merkleVerifier.getAddress()
    );
    await identityMerkleZkp.waitForDeployment();
  });

  describe("Deployment Gas Comparison", function () {
    it("should compare deployment costs", async () => {
      // Re-deploy to measure gas
      const VerifierFactory = await ethers.getContractFactory(
        "contracts/IdentityVerifier.sol:Groth16Verifier"
      );
      const verifierDeploy = await VerifierFactory.connect(admin).deploy();
      const verifierReceipt = await verifierDeploy
        .deploymentTransaction()
        .wait();

      const IdentityZKPFactory = await ethers.getContractFactory("IdentityZKP");
      const zkpDeploy = await IdentityZKPFactory.connect(admin).deploy(
        await verifier.getAddress()
      );
      const zkpReceipt = await zkpDeploy.deploymentTransaction().wait();

      const IdentityMerkleZKPFactory = await ethers.getContractFactory(
        "IdentityMerkleZKP"
      );
      const merkleDeploy = await IdentityMerkleZKPFactory.connect(admin).deploy(
        await verifier.getAddress()
      );
      const merkleReceipt = await merkleDeploy.deploymentTransaction().wait();

      gasResults.deployment = {
        verifier: verifierReceipt.gasUsed.toString(),
        identityZKP: zkpReceipt.gasUsed.toString(),
        identityMerkleZKP: merkleReceipt.gasUsed.toString(),
      };

      console.log("\n📊 Deployment Gas Costs:");
      console.log("├─ Verifier:", gasResults.deployment.verifier);
      console.log("├─ IdentityZKP:", gasResults.deployment.identityZKP);
      console.log(
        "└─ IdentityMerkleZKP:",
        gasResults.deployment.identityMerkleZKP
      );
    });
  });

  describe("Identity Submission/Approval Gas Comparison", function () {
    it("should compare identity submission costs", async () => {
      const userId = ethers.keccak256(ethers.toUtf8Bytes("User1"));
      const hash = publicSignalsZKP[0];

      // IdentityZKP: Submit hash by user
      const zkpSubmitTx = await identityZkp
        .connect(user1)
        .submitHashByUser(userId, hash);
      const zkpSubmitReceipt = await zkpSubmitTx.wait();
      gasResults.identityZKP.submitHash = zkpSubmitReceipt.gasUsed.toString();

      // IdentityMerkleZKP: Update root with identities (batch operation)
      const identityHashes = [sampleIdentityHash];
      const merkleUpdateTx = await identityMerkleZkp
        .connect(admin)
        .updateMerkleRootWithIdentities(sampleMerkleRoot, identityHashes);
      const merkleUpdateReceipt = await merkleUpdateTx.wait();
      gasResults.identityMerkleZKP.updateRootWithIdentity =
        merkleUpdateReceipt.gasUsed.toString();

      // IdentityMerkleZKP: Single identity approval
      const singleHash = "0x" + "3".repeat(64);
      const merkleSingleTx = await identityMerkleZkp
        .connect(admin)
        .approveIdentity(singleHash);
      const merkleSingleReceipt = await merkleSingleTx.wait();
      gasResults.identityMerkleZKP.approveSingleIdentity =
        merkleSingleReceipt.gasUsed.toString();

      console.log("\n📊 Identity Submission Gas Costs:");
      console.log(
        "├─ IdentityZKP - Submit Hash:",
        gasResults.identityZKP.submitHash
      );
      console.log(
        "├─ IdentityMerkleZKP - Update Root + 1 Identity:",
        gasResults.identityMerkleZKP.updateRootWithIdentity
      );
      console.log(
        "└─ IdentityMerkleZKP - Approve Single Identity:",
        gasResults.identityMerkleZKP.approveSingleIdentity
      );
    });

    it("should compare approval costs", async () => {
      const userId = ethers.keccak256(ethers.toUtf8Bytes("User1"));
      const hash = publicSignalsZKP[0];

      // Setup: Submit hash first
      await identityZkp.connect(user1).submitHashByUser(userId, hash);

      // IdentityZKP: Admin approval
      const zkpApproveTx = await identityZkp
        .connect(admin)
        .approveIdentity(userId);
      const zkpApproveReceipt = await zkpApproveTx.wait();
      gasResults.identityZKP.approveIdentity =
        zkpApproveReceipt.gasUsed.toString();

      // IdentityMerkleZKP: Just update root (approval is implicit)
      const newRoot = "0x" + "4".repeat(64);
      const merkleRootTx = await identityMerkleZkp
        .connect(admin)
        .updateMerkleRoot(newRoot);
      const merkleRootReceipt = await merkleRootTx.wait();
      gasResults.identityMerkleZKP.updateRootOnly =
        merkleRootReceipt.gasUsed.toString();

      console.log("\n📊 Approval Gas Costs:");
      console.log(
        "├─ IdentityZKP - Approve Identity:",
        gasResults.identityZKP.approveIdentity
      );
      console.log(
        "└─ IdentityMerkleZKP - Update Root Only:",
        gasResults.identityMerkleZKP.updateRootOnly
      );
    });

    it("should compare batch operations", async () => {
      // IdentityZKP doesn't support batch, so we'll do multiple transactions
      const userIds = Array(10)
        .fill()
        .map((_, i) => ethers.keccak256(ethers.toUtf8Bytes(`User${i}`)));
      const hash = publicSignalsZKP[0];

      // Submit all hashes first
      for (let i = 0; i < userIds.length; i++) {
        await identityZkp.connect(user1).submitHashByUser(userIds[i], hash);
      }

      // Measure 10 individual approvals for IdentityZKP
      let totalGasZKP = 0n;
      for (let i = 0; i < userIds.length; i++) {
        const tx = await identityZkp.connect(admin).approveIdentity(userIds[i]);
        const receipt = await tx.wait();
        totalGasZKP += receipt.gasUsed;
      }
      gasResults.identityZKP.approve10Identities = totalGasZKP.toString();

      // IdentityMerkleZKP: Batch update with 10 identities
      const identityHashes = Array(10)
        .fill()
        .map((_, i) => "0x" + (i + 10).toString().repeat(32).substring(0, 64));
      const merkleBatchTx = await identityMerkleZkp
        .connect(admin)
        .updateMerkleRootWithIdentities(sampleMerkleRoot, identityHashes);
      const merkleBatchReceipt = await merkleBatchTx.wait();
      gasResults.identityMerkleZKP.batchApprove10 =
        merkleBatchReceipt.gasUsed.toString();

      console.log("\n📊 Batch Operations Gas Costs (10 identities):");
      console.log(
        "├─ IdentityZKP - 10 Individual Approvals:",
        gasResults.identityZKP.approve10Identities
      );
      console.log(
        "├─ IdentityMerkleZKP - Batch Approve 10:",
        gasResults.identityMerkleZKP.batchApprove10
      );
      console.log(
        "└─ Savings:",
        (
          BigInt(gasResults.identityZKP.approve10Identities) -
          BigInt(gasResults.identityMerkleZKP.batchApprove10)
        ).toString(),
        `(${(
          (1 -
            Number(gasResults.identityMerkleZKP.batchApprove10) /
              Number(gasResults.identityZKP.approve10Identities)) *
          100
        ).toFixed(2)}%)`
      );
    });
  });

  describe("Verification Gas Comparison", function () {
    it("should compare verification costs", async function () {
      // Skip if using mock data
      if (
        !fs.existsSync(path.join(__dirname, "../build/proof_zkp.json")) ||
        !fs.existsSync(path.join(__dirname, "../build/proof_merkle.json"))
      ) {
        this.skip();
        return;
      }

      // Setup IdentityZKP
      const userId = ethers.keccak256(ethers.toUtf8Bytes("User1"));
      const hash = publicSignalsZKP[0];
      await identityZkp.connect(user1).submitHashByUser(userId, hash);
      await identityZkp.connect(admin).approveIdentity(userId);

      // Setup IdentityMerkleZKP
      await identityMerkleZkp.connect(admin).updateMerkleRoot(sampleMerkleRoot);

      // IdentityZKP: Submit proof
      const zkpProofTx = await identityZkp
        .connect(user1)
        .submitProof(userId, aZKP, bZKP, cZKP);
      const zkpProofReceipt = await zkpProofTx.wait();
      gasResults.identityZKP.submitProof = zkpProofReceipt.gasUsed.toString();

      // IdentityMerkleZKP: Verify identity
      const merkleVerifyTx = await identityMerkleZkp
        .connect(user1)
        .verifyIdentity(aMerkle, bMerkle, cMerkle, sampleIdentityHash);
      const merkleVerifyReceipt = await merkleVerifyTx.wait();
      gasResults.identityMerkleZKP.verifyIdentity =
        merkleVerifyReceipt.gasUsed.toString();

      console.log("\n📊 Verification Gas Costs:");
      console.log(
        "├─ IdentityZKP - Submit Proof:",
        gasResults.identityZKP.submitProof
      );
      console.log(
        "└─ IdentityMerkleZKP - Verify Identity:",
        gasResults.identityMerkleZKP.verifyIdentity
      );
    });

    it("should compare multiple verifications", async function () {
      // Skip if using mock data
      if (
        !fs.existsSync(path.join(__dirname, "../build/proof_zkp.json")) ||
        !fs.existsSync(path.join(__dirname, "../build/proof_merkle.json"))
      ) {
        this.skip();
        return;
      }

      // Setup
      const userId = ethers.keccak256(ethers.toUtf8Bytes("User1"));
      const hash = publicSignalsZKP[0];
      await identityZkp.connect(user1).submitHashByUser(userId, hash);
      await identityZkp.connect(admin).approveIdentity(userId);
      await identityMerkleZkp.connect(admin).updateMerkleRoot(sampleMerkleRoot);

      // First verification (already done)
      await identityZkp.connect(user1).submitProof(userId, aZKP, bZKP, cZKP);

      // IdentityZKP: Second verification attempt should fail
      try {
        await identityZkp.connect(user1).submitProof(userId, aZKP, bZKP, cZKP);
      } catch (error) {
        console.log("\n⚠️  IdentityZKP: Cannot verify same identity twice");
      }

      // IdentityMerkleZKP: Multiple verifications allowed
      let totalGasMerkle = 0n;
      for (let i = 0; i < 3; i++) {
        const tx = await identityMerkleZkp
          .connect(user1)
          .verifyIdentity(aMerkle, bMerkle, cMerkle, sampleIdentityHash);
        const receipt = await tx.wait();
        totalGasMerkle += receipt.gasUsed;
      }
      gasResults.identityMerkleZKP.verify3Times = totalGasMerkle.toString();

      console.log("\n📊 Multiple Verification Costs:");
      console.log("├─ IdentityZKP: Not supported (one-time verification)");
      console.log(
        "└─ IdentityMerkleZKP - 3 Verifications:",
        gasResults.identityMerkleZKP.verify3Times
      );
    });
  });

  describe("Administrative Operations Gas Comparison", function () {
    it("should compare revocation costs", async () => {
      // Setup
      const userId = ethers.keccak256(ethers.toUtf8Bytes("User1"));
      const hash = publicSignalsZKP[0];
      await identityZkp.connect(user1).submitHashByUser(userId, hash);
      await identityZkp.connect(admin).approveIdentity(userId);

      await identityMerkleZkp
        .connect(admin)
        .approveIdentity(sampleIdentityHash);

      // IdentityZKP: Revoke
      const zkpRevokeTx = await identityZkp
        .connect(admin)
        .revokeApprovedIdentity(userId, 1); // reason code 1
      const zkpRevokeReceipt = await zkpRevokeTx.wait();
      gasResults.identityZKP.revokeIdentity =
        zkpRevokeReceipt.gasUsed.toString();

      // IdentityMerkleZKP: Revoke
      const merkleRevokeTx = await identityMerkleZkp
        .connect(admin)
        .revokeIdentity(sampleIdentityHash);
      const merkleRevokeReceipt = await merkleRevokeTx.wait();
      gasResults.identityMerkleZKP.revokeIdentity =
        merkleRevokeReceipt.gasUsed.toString();

      console.log("\n📊 Revocation Gas Costs:");
      console.log(
        "├─ IdentityZKP - Revoke Identity:",
        gasResults.identityZKP.revokeIdentity
      );
      console.log(
        "└─ IdentityMerkleZKP - Revoke Identity:",
        gasResults.identityMerkleZKP.revokeIdentity
      );
    });

    it("should compare admin transfer costs", async () => {
      // IdentityZKP: Set admin
      const zkpAdminTx = await identityZkp
        .connect(admin)
        .setAdmin(newAdmin.address);
      const zkpAdminReceipt = await zkpAdminTx.wait();
      gasResults.identityZKP.changeAdmin = zkpAdminReceipt.gasUsed.toString();

      // IdentityMerkleZKP: Transfer admin
      const merkleAdminTx = await identityMerkleZkp
        .connect(admin)
        .transferAdmin(newAdmin.address);
      const merkleAdminReceipt = await merkleAdminTx.wait();
      gasResults.identityMerkleZKP.changeAdmin =
        merkleAdminReceipt.gasUsed.toString();

      console.log("\n📊 Admin Change Gas Costs:");
      console.log(
        "├─ IdentityZKP - Set Admin:",
        gasResults.identityZKP.changeAdmin
      );
      console.log(
        "└─ IdentityMerkleZKP - Transfer Admin:",
        gasResults.identityMerkleZKP.changeAdmin
      );
    });
  });

  describe("Storage Pattern Analysis", function () {
    it("should analyze storage costs for different scales", async () => {
      console.log("\n📊 Storage Pattern Analysis:");
      console.log("\nIdentityZKP Storage (per identity):");
      console.log("├─ submittedHash: 1 slot (32 bytes)");
      console.log("├─ hasSubmitted: 1 slot (bool packed)");
      console.log("├─ isApproved: 1 slot (bool packed)");
      console.log("├─ isVerified: 1 slot (bool packed)");
      console.log("└─ Total: ~4 storage slots per identity");

      console.log("\nIdentityMerkleZKP Storage:");
      console.log("├─ currentMerkleRoot: 1 slot (32 bytes)");
      console.log("├─ approvedIdentities: 1 slot per identity (bool)");
      console.log("├─ identityApprovalBlock: 1 slot per identity (uint256)");
      console.log("└─ Total: 1 global slot + 2 slots per tracked identity");

      console.log("\nScaling Analysis:");
      console.log("├─ 100 identities - IdentityZKP: ~400 slots");
      console.log("├─ 100 identities - IdentityMerkleZKP: 1 + 200 = 201 slots");
      console.log("├─ 1000 identities - IdentityZKP: ~4000 slots");
      console.log(
        "└─ 1000 identities - IdentityMerkleZKP: 1 + 2000 = 2001 slots"
      );
    });
  });

  after(function () {
    console.log("\n\n========================================");
    console.log("📊 FINAL GAS COMPARISON SUMMARY");
    console.log("========================================\n");

    console.log("Key Findings:");
    console.log(
      "1. Batch Operations: IdentityMerkleZKP shows significant savings for bulk approvals"
    );
    console.log(
      "2. Individual Operations: Similar gas costs for single identity operations"
    );
    console.log(
      "3. Verification: IdentityMerkleZKP allows multiple verifications (more flexible)"
    );
    console.log(
      "4. Storage: IdentityMerkleZKP uses ~50% less storage per identity"
    );

    console.log("\nRecommendations:");
    console.log(
      "- Use IdentityZKP for: Small-scale, one-time verification scenarios"
    );
    console.log(
      "- Use IdentityMerkleZKP for: Large-scale deployments, batch operations, recurring verifications"
    );

    // Export results to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `gas-comparison-${timestamp}.json`;
    fs.writeFileSync(
      path.join(__dirname, filename),
      JSON.stringify(gasResults, null, 2)
    );
    console.log(`\n💾 Results saved to: ${filename}`);
  });
});
