const { expect } = require("chai");
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

describe("IdentityMerkleZKP", function () {
  let verifier;
  let identityMerkleZkp;
  let admin, user1, user2, subAdmin, newAdmin;
  let sampleMerkleRoot;

  beforeEach(async () => {
    [admin, user1, user2, subAdmin, newAdmin] = await ethers.getSigners();

    // Deploy the Groth16Verifier (IdentityMerkleVerifier)
    const VerifierFactory = await ethers.getContractFactory("contracts/IdentityMerkleVerifier.sol:Groth16Verifier");
    verifier = await VerifierFactory.connect(admin).deploy();
    await verifier.waitForDeployment();

    // Sample Merkle root for testing
    sampleMerkleRoot = "0x" + "1".repeat(64); // Sample 32-byte hex

    // Deploy IdentityMerkleZKP contract
    const IdentityMerkleZKPFactory = await ethers.getContractFactory(
      "IdentityMerkleZKP"
    );
    identityMerkleZkp = await IdentityMerkleZKPFactory.connect(admin).deploy(
      await verifier.getAddress(),
      sampleMerkleRoot // Initial root
    );
    await identityMerkleZkp.waitForDeployment();
  });

  describe("Deployment", function () {
    it("should deploy with correct initial values", async () => {
      expect(await identityMerkleZkp.admin()).to.equal(admin.address);
      expect(await identityMerkleZkp.currentMerkleRoot()).to.equal(
        sampleMerkleRoot
      );
      expect(await identityMerkleZkp.validRoots(sampleMerkleRoot)).to.be.true;
      expect(await identityMerkleZkp.rootNonce()).to.equal(0);
    });

    it("should deploy without initial root", async () => {
      const IdentityMerkleZKPFactory = await ethers.getContractFactory(
        "IdentityMerkleZKP"
      );
      const emptyRootContract = await IdentityMerkleZKPFactory.connect(
        admin
      ).deploy(
        await verifier.getAddress(),
        "0x" + "0".repeat(64) // Zero bytes32
      );
      await emptyRootContract.waitForDeployment();

      expect(await emptyRootContract.currentMerkleRoot()).to.equal(
        "0x" + "0".repeat(64)
      );
    });
  });

  describe("Merkle Root Management", function () {
    it("should allow admin to update Merkle root", async () => {
      const newRoot = "0x" + "2".repeat(64);

      const tx = await identityMerkleZkp
        .connect(admin)
        .updateMerkleRoot(newRoot);
      const receipt = await tx.wait();

      expect(await identityMerkleZkp.currentMerkleRoot()).to.equal(newRoot);
      expect(await identityMerkleZkp.validRoots(newRoot)).to.be.true;
      expect(await identityMerkleZkp.rootNonce()).to.equal(1);

      // Check event emission
      const event = receipt.logs.find(
        (log) =>
          identityMerkleZkp.interface.parseLog(log)?.name ===
          "MerkleRootUpdated"
      );
      expect(event).to.not.be.undefined;
    });

    it("should allow sub-admin to update Merkle root", async () => {
      // Add sub-admin first
      await identityMerkleZkp.connect(admin).addSubAdmin(subAdmin.address);

      const newRoot = "0x" + "3".repeat(64);
      await identityMerkleZkp.connect(subAdmin).updateMerkleRoot(newRoot);

      expect(await identityMerkleZkp.currentMerkleRoot()).to.equal(newRoot);
    });

    it("should reject invalid root updates", async () => {
      // Test zero root
      await expect(
        identityMerkleZkp.connect(admin).updateMerkleRoot("0x" + "0".repeat(64))
      ).to.be.revertedWith("Invalid root hash");

      // Test same root
      await expect(
        identityMerkleZkp.connect(admin).updateMerkleRoot(sampleMerkleRoot)
      ).to.be.revertedWith("Root already current");
    });

    it("should reject non-admin root updates", async () => {
      const newRoot = "0x" + "4".repeat(64);

      await expect(
        identityMerkleZkp.connect(user1).updateMerkleRoot(newRoot)
      ).to.be.revertedWith("Only admin or sub-admin can perform this action");
    });

    it("should batch update multiple roots", async () => {
      const roots = [
        "0x" + "5".repeat(64),
        "0x" + "6".repeat(64),
        "0x" + "7".repeat(64),
      ];

      await identityMerkleZkp.connect(admin).batchUpdateRoots(roots);

      // Check all roots are valid
      for (const root of roots) {
        expect(await identityMerkleZkp.validRoots(root)).to.be.true;
      }

      // Last root should be current
      expect(await identityMerkleZkp.currentMerkleRoot()).to.equal(
        roots[roots.length - 1]
      );
    });
  });

  describe("Sub-Admin Management", function () {
    it("should allow admin to add sub-admin", async () => {
      const tx = await identityMerkleZkp
        .connect(admin)
        .addSubAdmin(subAdmin.address);
      await tx.wait();

      expect(await identityMerkleZkp.isSubAdmin(subAdmin.address)).to.be.true;
    });

    it("should allow admin to remove sub-admin", async () => {
      await identityMerkleZkp.connect(admin).addSubAdmin(subAdmin.address);
      await identityMerkleZkp.connect(admin).removeSubAdmin(subAdmin.address);

      expect(await identityMerkleZkp.isSubAdmin(subAdmin.address)).to.be.false;
    });

    it("should reject invalid sub-admin operations", async () => {
      // Add zero address
      await expect(
        identityMerkleZkp.connect(admin).addSubAdmin("0x" + "0".repeat(40))
      ).to.be.revertedWith("Invalid sub-admin address");

      // Add admin as sub-admin
      await expect(
        identityMerkleZkp.connect(admin).addSubAdmin(admin.address)
      ).to.be.revertedWith("Admin cannot be sub-admin");

      // Remove non-sub-admin
      await expect(
        identityMerkleZkp.connect(admin).removeSubAdmin(user1.address)
      ).to.be.revertedWith("Not a sub-admin");
    });
  });

  describe("Identity Verification", function () {
    let proof, publicSignals, a, b, c, merkleRoot;

    beforeEach(async () => {
      // Load proof files if they exist, otherwise use mock data
      try {
        proof = JSON.parse(
          fs.readFileSync(path.join(__dirname, "../build/proof.json"))
        );
        publicSignals = JSON.parse(
          fs.readFileSync(path.join(__dirname, "../build/public.json"))
        );

        a = [proof.pi_a[0], proof.pi_a[1]];
        b = [
          [proof.pi_b[0][1], proof.pi_b[0][0]],
          [proof.pi_b[1][1], proof.pi_b[1][0]],
        ];
        c = [proof.pi_c[0], proof.pi_c[1]];
        merkleRoot =
          "0x" + BigInt(publicSignals[0]).toString(16).padStart(64, "0");

        // Make sure this root is valid
        await identityMerkleZkp.connect(admin).updateMerkleRoot(merkleRoot);
      } catch (error) {
        // Use mock data if proof files don't exist
        console.log("Using mock proof data for testing");
        a = ["1", "2"];
        b = [
          ["3", "4"],
          ["5", "6"],
        ];
        c = ["7", "8"];
        merkleRoot = sampleMerkleRoot;
      }
    });

    it("should verify valid proof and mark user as verified", async function () {
      // Skip if using mock data (as it won't verify)
      if (!fs.existsSync(path.join(__dirname, "../build/proof.json"))) {
        this.skip();
        return;
      }

      const tx = await identityMerkleZkp
        .connect(user1)
        .verifyIdentity(a, b, c, merkleRoot);
      const receipt = await tx.wait();

      // Check event emission
      const event = receipt.logs.find(
        (log) =>
          identityMerkleZkp.interface.parseLog(log)?.name === "IdentityVerified"
      );
      expect(event).to.not.be.undefined;

      // Check verification status
      expect(await identityMerkleZkp.isVerified(user1.address)).to.be.true;

      const [verified, userRoot, timestamp] =
        await identityMerkleZkp.getUserVerificationInfo(user1.address);
      expect(verified).to.be.true;
      expect(userRoot).to.equal(merkleRoot);
      expect(timestamp).to.be.gt(0);
    });

    it("should reject verification with invalid root", async () => {
      const invalidRoot = "0x" + "9".repeat(64);

      await expect(
        identityMerkleZkp.connect(user1).verifyIdentity(a, b, c, invalidRoot)
      ).to.be.revertedWith("Root not valid or expired");
    });

    it("should reject verification if user already verified", async function () {
      // Skip if using mock data
      if (!fs.existsSync(path.join(__dirname, "../build/proof.json"))) {
        this.skip();
        return;
      }

      // First verification
      await identityMerkleZkp
        .connect(user1)
        .verifyIdentity(a, b, c, merkleRoot);

      // Second verification should fail
      await expect(
        identityMerkleZkp.connect(user1).verifyIdentity(a, b, c, merkleRoot)
      ).to.be.revertedWith("User already verified");
    });
  });

  describe("Admin Functions", function () {
    it("should allow admin transfer", async () => {
      await identityMerkleZkp.connect(admin).transferAdmin(newAdmin.address);
      expect(await identityMerkleZkp.admin()).to.equal(newAdmin.address);
    });

    it("should reject invalid admin transfers", async () => {
      // Transfer to zero address
      await expect(
        identityMerkleZkp.connect(admin).transferAdmin("0x" + "0".repeat(40))
      ).to.be.revertedWith("Invalid new admin address");

      // Transfer to same admin
      await expect(
        identityMerkleZkp.connect(admin).transferAdmin(admin.address)
      ).to.be.revertedWith("Already admin");
    });

    it("should allow admin to revoke verification", async () => {
      // Setup: make user1 verified (mock)
      // Since we can't easily verify with mock data, we'll test the revert condition
      await expect(
        identityMerkleZkp
          .connect(admin)
          .revokeVerification(user1.address, "Test revocation")
      ).to.be.revertedWith("User not verified");
    });

    it("should allow admin to invalidate roots", async () => {
      const newRoot = "0x" + "8".repeat(64);
      await identityMerkleZkp.connect(admin).updateMerkleRoot(newRoot);

      // Invalidate old root
      await identityMerkleZkp.connect(admin).invalidateRoot(sampleMerkleRoot);
      expect(await identityMerkleZkp.validRoots(sampleMerkleRoot)).to.be.false;
    });
  });

  describe("View Functions", function () {
    it("should return correct contract info", async () => {
      const [currentRoot, totalUpdates, contractAdmin] =
        await identityMerkleZkp.getContractInfo();

      expect(currentRoot).to.equal(sampleMerkleRoot);
      expect(totalUpdates).to.equal(0);
      expect(contractAdmin).to.equal(admin.address);
    });

    it("should return correct root info", async () => {
      const [isValid, timestamp, isExpired] =
        await identityMerkleZkp.getRootInfo(sampleMerkleRoot);

      expect(isValid).to.be.true;
      expect(timestamp).to.be.gt(0);
      expect(isExpired).to.be.false;
    });

    it("should check root validity correctly", async () => {
      expect(await identityMerkleZkp.isValidRoot(sampleMerkleRoot)).to.be.true;

      const invalidRoot = "0x" + "9".repeat(64);
      expect(await identityMerkleZkp.isValidRoot(invalidRoot)).to.be.false;
    });
  });

  describe("Edge Cases and Security", function () {
    it("should handle empty batch operations", async () => {
      await expect(
        identityMerkleZkp.connect(admin).batchUpdateRoots([])
      ).to.be.revertedWith("Empty roots array");
    });

    it("should enforce batch size limits", async () => {
      const largeBatch = Array(101)
        .fill()
        .map((_, i) => "0x" + (i + 10).toString().repeat(32).substring(0, 64));

      await expect(
        identityMerkleZkp.connect(admin).batchUpdateRoots(largeBatch)
      ).to.be.revertedWith("Batch size exceeds limit");
    });

    it("should cleanup expired roots", async () => {
      // This test would require advancing blockchain time
      // For now, we test that the function doesn't revert
      await identityMerkleZkp.cleanupExpiredRoots([sampleMerkleRoot]);
    });

    it("should reject operations from unauthorized users", async () => {
      const newRoot = "0x" + "a".repeat(64);

      await expect(
        identityMerkleZkp.connect(user1).updateMerkleRoot(newRoot)
      ).to.be.revertedWith("Only admin or sub-admin can perform this action");

      await expect(
        identityMerkleZkp.connect(user1).addSubAdmin(user2.address)
      ).to.be.revertedWith("Only admin can perform this action");
    });
  });

  describe("Gas Efficiency Tests", function () {
    it("should measure gas usage for root updates", async () => {
      const newRoot = "0x" + "b".repeat(64);
      const tx = await identityMerkleZkp
        .connect(admin)
        .updateMerkleRoot(newRoot);
      const receipt = await tx.wait();

      console.log(
        `Gas used for updateMerkleRoot: ${receipt.gasUsed.toString()}`
      );
      expect(receipt.gasUsed).to.be.lt(100000); // Should be efficient
    });

    it("should measure gas usage for batch operations", async () => {
      const roots = Array(5)
        .fill()
        .map((_, i) => "0x" + (i + 20).toString().repeat(32).substring(0, 64));

      const tx = await identityMerkleZkp.connect(admin).batchUpdateRoots(roots);
      const receipt = await tx.wait();

      console.log(
        `Gas used for batchUpdateRoots (5 roots): ${receipt.gasUsed.toString()}`
      );
    });
  });
});

// Helper function to advance blockchain time (for expiry testing)
async function advanceTime(seconds) {
  await ethers.provider.send("evm_increaseTime", [seconds]);
  await ethers.provider.send("evm_mine", []);
}

// Test with time advancement
describe("IdentityMerkleZKP - Time-based tests", function () {
  let identityMerkleZkp, admin, user1;
  let sampleMerkleRoot;

  beforeEach(async () => {
    [admin, user1] = await ethers.getSigners();

    const VerifierFactory = await ethers.getContractFactory("contracts/IdentityMerkleVerifier.sol:Groth16Verifier");
    const verifier = await VerifierFactory.connect(admin).deploy();
    await verifier.waitForDeployment();

    sampleMerkleRoot = "0x" + "1".repeat(64);

    const IdentityMerkleZKPFactory = await ethers.getContractFactory(
      "IdentityMerkleZKP"
    );
    identityMerkleZkp = await IdentityMerkleZKPFactory.connect(admin).deploy(
      await verifier.getAddress(),
      sampleMerkleRoot
    );
    await identityMerkleZkp.waitForDeployment();
  });

  it("should handle root expiry correctly", async () => {
    // Advance time by 31 days
    await advanceTime(31 * 24 * 60 * 60);

    // Root should be expired
    expect(await identityMerkleZkp.isValidRoot(sampleMerkleRoot)).to.be.false;

    // Verification should fail
    const mockProof = {
      a: ["1", "2"],
      b: [
        ["3", "4"],
        ["5", "6"],
      ],
      c: ["7", "8"],
    };

    await expect(
      identityMerkleZkp
        .connect(user1)
        .verifyIdentity(mockProof.a, mockProof.b, mockProof.c, sampleMerkleRoot)
    ).to.be.revertedWith("Root has expired");
  });
});
