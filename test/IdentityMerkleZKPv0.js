const { expect } = require("chai");
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

describe("IdentityMerkleZKP", function () {
  let verifier;
  let identityMerkleZkp;
  let admin, user1, user2, newAdmin;
  let sampleMerkleRoot;
  let sampleIdentityHash;

  beforeEach(async () => {
    [admin, user1, user2, newAdmin] = await ethers.getSigners();

    // Deploy the Groth16Verifier (IdentityMerkleVerifier)
    const VerifierFactory = await ethers.getContractFactory(
      "contracts/IdentityMerkleVerifier.sol:Groth16Verifier"
    );
    verifier = await VerifierFactory.connect(admin).deploy();
    await verifier.waitForDeployment();

    // Sample Merkle root for testing
    sampleMerkleRoot = "0x" + "1".repeat(64); // Sample 32-byte hex
    sampleIdentityHash = "0x" + "2".repeat(64); // Sample identity hash

    // Deploy IdentityMerkleZKP contract
    const IdentityMerkleZKPFactory = await ethers.getContractFactory(
      "IdentityMerkleZKP"
    );
    identityMerkleZkp = await IdentityMerkleZKPFactory.connect(admin).deploy(
      await verifier.getAddress()
    );
    await identityMerkleZkp.waitForDeployment();
  });

  describe("Deployment", function () {
    it("should deploy with correct initial values", async () => {
      expect(await identityMerkleZkp.admin()).to.equal(admin.address);
      expect(await identityMerkleZkp.currentMerkleRoot()).to.equal(
        "0x" + "0".repeat(64)
      ); // Should be zero initially
      expect(await identityMerkleZkp.totalApprovedIdentities()).to.equal(0);
    });

    it("should reject deployment with invalid verifier", async () => {
      const IdentityMerkleZKPFactory = await ethers.getContractFactory(
        "IdentityMerkleZKP"
      );

      await expect(
        IdentityMerkleZKPFactory.connect(admin).deploy("0x" + "0".repeat(40))
      ).to.be.revertedWith("Invalid verifier address");
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

      // Check event emission
      const event = receipt.logs.find(
        (log) =>
          identityMerkleZkp.interface.parseLog(log)?.name ===
          "MerkleRootUpdated"
      );
      expect(event).to.not.be.undefined;
    });

    it("should reject invalid root updates", async () => {
      // Test zero root
      await expect(
        identityMerkleZkp.connect(admin).updateMerkleRoot("0x" + "0".repeat(64))
      ).to.be.revertedWith("Invalid root hash");

      // Set initial root first
      await identityMerkleZkp.connect(admin).updateMerkleRoot(sampleMerkleRoot);

      // Test same root
      await expect(
        identityMerkleZkp.connect(admin).updateMerkleRoot(sampleMerkleRoot)
      ).to.be.revertedWith("Root already current");
    });

    it("should reject non-admin root updates", async () => {
      const newRoot = "0x" + "4".repeat(64);

      await expect(
        identityMerkleZkp.connect(user1).updateMerkleRoot(newRoot)
      ).to.be.revertedWith("Only admin can perform this action");
    });
  });

  describe("Identity Management", function () {
    it("should allow admin to approve single identity", async () => {
      const tx = await identityMerkleZkp
        .connect(admin)
        .approveIdentity(sampleIdentityHash);
      const receipt = await tx.wait();

      expect(await identityMerkleZkp.isIdentityApproved(sampleIdentityHash)).to
        .be.true;
      expect(await identityMerkleZkp.totalApprovedIdentities()).to.equal(1);

      // Check event emission
      const event = receipt.logs.find(
        (log) =>
          identityMerkleZkp.interface.parseLog(log)?.name === "IdentityApproved"
      );
      expect(event).to.not.be.undefined;
    });

    it("should allow admin to update root with multiple identities", async () => {
      const identityHashes = [
        "0x" + "3".repeat(64),
        "0x" + "4".repeat(64),
        "0x" + "5".repeat(64),
      ];

      const tx = await identityMerkleZkp
        .connect(admin)
        .updateMerkleRootWithIdentities(sampleMerkleRoot, identityHashes);
      const receipt = await tx.wait();

      expect(await identityMerkleZkp.currentMerkleRoot()).to.equal(
        sampleMerkleRoot
      );
      expect(await identityMerkleZkp.totalApprovedIdentities()).to.equal(3);

      // Check all identities are approved
      for (const hash of identityHashes) {
        expect(await identityMerkleZkp.isIdentityApproved(hash)).to.be.true;
      }

      // Check events
      const events = receipt.logs.filter(
        (log) =>
          identityMerkleZkp.interface.parseLog(log)?.name === "IdentityApproved"
      );
      expect(events.length).to.equal(3);
    });

    it("should reject invalid identity operations", async () => {
      // Approve zero hash
      await expect(
        identityMerkleZkp.connect(admin).approveIdentity("0x" + "0".repeat(64))
      ).to.be.revertedWith("Invalid identity hash");

      // Approve same identity twice
      await identityMerkleZkp
        .connect(admin)
        .approveIdentity(sampleIdentityHash);
      await expect(
        identityMerkleZkp.connect(admin).approveIdentity(sampleIdentityHash)
      ).to.be.revertedWith("Already approved");

      // Update root with empty identities array
      await expect(
        identityMerkleZkp
          .connect(admin)
          .updateMerkleRootWithIdentities(sampleMerkleRoot, [])
      ).to.be.revertedWith("Empty identities array");

      // Update root with too many identities
      const tooManyIdentities = Array(101)
        .fill()
        .map((_, i) => "0x" + (i + 10).toString().repeat(32).substring(0, 64));
      await expect(
        identityMerkleZkp
          .connect(admin)
          .updateMerkleRootWithIdentities(sampleMerkleRoot, tooManyIdentities)
      ).to.be.revertedWith("Too many identities");
    });

    it("should allow admin to revoke identity", async () => {
      // First approve the identity
      await identityMerkleZkp
        .connect(admin)
        .approveIdentity(sampleIdentityHash);
      expect(await identityMerkleZkp.totalApprovedIdentities()).to.equal(1);

      // Then revoke it
      const tx = await identityMerkleZkp
        .connect(admin)
        .revokeIdentity(sampleIdentityHash);
      const receipt = await tx.wait();

      expect(await identityMerkleZkp.isIdentityApproved(sampleIdentityHash)).to
        .be.false;
      expect(await identityMerkleZkp.totalApprovedIdentities()).to.equal(0);

      // Check event emission
      const event = receipt.logs.find(
        (log) =>
          identityMerkleZkp.interface.parseLog(log)?.name === "IdentityRevoked"
      );
      expect(event).to.not.be.undefined;
    });

    it("should reject revoking non-approved identity", async () => {
      await expect(
        identityMerkleZkp.connect(admin).revokeIdentity(sampleIdentityHash)
      ).to.be.revertedWith("Identity not approved");
    });
  });

  describe("Identity Verification", function () {
    let proof, publicSignals, a, b, c, merkleRoot, identityHash;

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
        identityHash = "0x" + "2".repeat(64);

        // Make sure this root is set
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
        identityHash = sampleIdentityHash;

        // Set the root
        await identityMerkleZkp.connect(admin).updateMerkleRoot(merkleRoot);
      }
    });

    it("should verify valid proof and emit event", async function () {
      // Skip if using mock data (as it won't verify)
      if (!fs.existsSync(path.join(__dirname, "../build/proof.json"))) {
        this.skip();
        return;
      }

      const tx = await identityMerkleZkp
        .connect(user1)
        .verifyIdentity(a, b, c, identityHash);
      const receipt = await tx.wait();

      // Check event emission
      const event = receipt.logs.find(
        (log) =>
          identityMerkleZkp.interface.parseLog(log)?.name === "IdentityVerified"
      );
      expect(event).to.not.be.undefined;

      // Parse the event to verify it contains correct data
      const parsedEvent = identityMerkleZkp.interface.parseLog(event);
      expect(parsedEvent.args.verifier).to.equal(user1.address);
      expect(parsedEvent.args.identityHash).to.equal(identityHash);
    });

    it("should reject verification with no Merkle root set", async () => {
      // Deploy new contract without setting root
      const IdentityMerkleZKPFactory = await ethers.getContractFactory(
        "IdentityMerkleZKP"
      );
      const newContract = await IdentityMerkleZKPFactory.connect(admin).deploy(
        await verifier.getAddress()
      );
      await newContract.waitForDeployment();

      await expect(
        newContract.connect(user1).verifyIdentity(a, b, c, identityHash)
      ).to.be.revertedWith("No Merkle root set");
    });

    it("should allow multiple verifications from same user", async function () {
      // Skip if using mock data
      if (!fs.existsSync(path.join(__dirname, "../build/proof.json"))) {
        this.skip();
        return;
      }

      // First verification
      const tx1 = await identityMerkleZkp
        .connect(user1)
        .verifyIdentity(a, b, c, identityHash);
      const receipt1 = await tx1.wait();

      // Second verification should succeed (no restrictions)
      const tx2 = await identityMerkleZkp
        .connect(user1)
        .verifyIdentity(a, b, c, identityHash);
      const receipt2 = await tx2.wait();

      // Both should emit events
      const event1 = receipt1.logs.find(
        (log) =>
          identityMerkleZkp.interface.parseLog(log)?.name === "IdentityVerified"
      );
      const event2 = receipt2.logs.find(
        (log) =>
          identityMerkleZkp.interface.parseLog(log)?.name === "IdentityVerified"
      );

      expect(event1).to.not.be.undefined;
      expect(event2).to.not.be.undefined;
    });
  });

  describe("Admin Functions", function () {
    it("should allow admin transfer", async () => {
      const tx = await identityMerkleZkp
        .connect(admin)
        .transferAdmin(newAdmin.address);
      const receipt = await tx.wait();

      expect(await identityMerkleZkp.admin()).to.equal(newAdmin.address);

      // Check event emission
      const event = receipt.logs.find(
        (log) =>
          identityMerkleZkp.interface.parseLog(log)?.name === "AdminChanged"
      );
      expect(event).to.not.be.undefined;
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

    it("should reject non-admin operations", async () => {
      await expect(
        identityMerkleZkp.connect(user1).updateMerkleRoot(sampleMerkleRoot)
      ).to.be.revertedWith("Only admin can perform this action");

      await expect(
        identityMerkleZkp.connect(user1).approveIdentity(sampleIdentityHash)
      ).to.be.revertedWith("Only admin can perform this action");

      await expect(
        identityMerkleZkp.connect(user1).revokeIdentity(sampleIdentityHash)
      ).to.be.revertedWith("Only admin can perform this action");

      await expect(
        identityMerkleZkp.connect(user1).transferAdmin(user2.address)
      ).to.be.revertedWith("Only admin can perform this action");
    });
  });

  describe("View Functions", function () {
    beforeEach(async () => {
      // Set up some test data
      await identityMerkleZkp.connect(admin).updateMerkleRoot(sampleMerkleRoot);
      await identityMerkleZkp
        .connect(admin)
        .approveIdentity(sampleIdentityHash);
    });

    it("should return correct contract info", async () => {
      const [currentRoot, totalIdentities, contractAdmin] =
        await identityMerkleZkp.getContractInfo();

      expect(currentRoot).to.equal(sampleMerkleRoot);
      expect(totalIdentities).to.equal(1);
      expect(contractAdmin).to.equal(admin.address);
    });

    it("should return correct identity info", async () => {
      const [approved, approvalBlock] = await identityMerkleZkp.getIdentityInfo(
        sampleIdentityHash
      );

      expect(approved).to.be.true;
      expect(approvalBlock).to.be.gt(0);
    });

    it("should check identity approval correctly", async () => {
      expect(await identityMerkleZkp.isIdentityApproved(sampleIdentityHash)).to
        .be.true;

      const unapprovedHash = "0x" + "9".repeat(64);
      expect(await identityMerkleZkp.isIdentityApproved(unapprovedHash)).to.be
        .false;
    });

    it("should compute identity hash correctly", async () => {
      const nik = 123456789;
      const nama = ethers.encodeBytes32String("John Doe");
      const ttl = 19900101;
      const key = ethers.encodeBytes32String("secretkey123");

      const computedHash = await identityMerkleZkp.computeIdentityHash(
        nik,
        nama,
        ttl,
        key
      );

      // Verify it's a valid hash (32 bytes)
      expect(computedHash).to.have.length(66); // 0x + 64 hex chars
      expect(computedHash).to.match(/^0x[a-fA-F0-9]{64}$/);
    });
  });

  describe("Edge Cases and Security", function () {
    it("should handle duplicate identity approvals gracefully", async () => {
      const identityHashes = [sampleIdentityHash, sampleIdentityHash];

      // First approval
      await identityMerkleZkp
        .connect(admin)
        .approveIdentity(sampleIdentityHash);
      expect(await identityMerkleZkp.totalApprovedIdentities()).to.equal(1);

      // Update root with same identity - should not increment counter
      await identityMerkleZkp
        .connect(admin)
        .updateMerkleRootWithIdentities(sampleMerkleRoot, identityHashes);
      expect(await identityMerkleZkp.totalApprovedIdentities()).to.equal(1);
    });

    it("should handle identity revocation correctly", async () => {
      // Approve multiple identities
      const identityHashes = [
        "0x" + "3".repeat(64),
        "0x" + "4".repeat(64),
        "0x" + "5".repeat(64),
      ];

      await identityMerkleZkp
        .connect(admin)
        .updateMerkleRootWithIdentities(sampleMerkleRoot, identityHashes);
      expect(await identityMerkleZkp.totalApprovedIdentities()).to.equal(3);

      // Revoke one identity
      await identityMerkleZkp.connect(admin).revokeIdentity(identityHashes[1]);
      expect(await identityMerkleZkp.totalApprovedIdentities()).to.equal(2);
      expect(await identityMerkleZkp.isIdentityApproved(identityHashes[1])).to
        .be.false;
      expect(await identityMerkleZkp.isIdentityApproved(identityHashes[0])).to
        .be.true;
      expect(await identityMerkleZkp.isIdentityApproved(identityHashes[2])).to
        .be.true;
    });

    it("should reject operations from unauthorized users", async () => {
      await expect(
        identityMerkleZkp.connect(user1).updateMerkleRoot(sampleMerkleRoot)
      ).to.be.revertedWith("Only admin can perform this action");

      await expect(
        identityMerkleZkp.connect(user1).approveIdentity(sampleIdentityHash)
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

    it("should measure gas usage for identity approvals", async () => {
      const tx = await identityMerkleZkp
        .connect(admin)
        .approveIdentity(sampleIdentityHash);
      const receipt = await tx.wait();

      console.log(
        `Gas used for approveIdentity: ${receipt.gasUsed.toString()}`
      );
    });

    it("should measure gas usage for batch operations", async () => {
      const identityHashes = Array(10)
        .fill()
        .map((_, i) => "0x" + (i + 20).toString().repeat(32).substring(0, 64));

      const tx = await identityMerkleZkp
        .connect(admin)
        .updateMerkleRootWithIdentities(sampleMerkleRoot, identityHashes);
      const receipt = await tx.wait();

      console.log(
        `Gas used for updateMerkleRootWithIdentities (10 identities): ${receipt.gasUsed.toString()}`
      );
    });
  });
});
