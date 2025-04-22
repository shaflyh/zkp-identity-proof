const { expect } = require("chai");
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

describe("IdentityZKP", function () {
  let verifier;
  let identityZkp;

  beforeEach(async () => {
    [admin, user] = await ethers.getSigners();

    // Deploy the Groth16Verifier contract first
    const VerifierFactory = await ethers.getContractFactory("Groth16Verifier");
    verifier = await VerifierFactory.connect(admin).deploy();
    await verifier.waitForDeployment();

    // Deploy the IdentityZKP contract with verifier address
    const IdentityZKPFactory = await ethers.getContractFactory("IdentityZKP");
    identityZkp = await IdentityZKPFactory.connect(admin).deploy(
      await verifier.getAddress()
    );
    await identityZkp.waitForDeployment();
  });

  it("should verify valid proof and mark user as verified", async () => {
    // Load proof & public signals
    const proof = JSON.parse(
      fs.readFileSync(path.join(__dirname, "../build/proof.json"))
    );
    const publicSignals = JSON.parse(
      fs.readFileSync(path.join(__dirname, "../build/public.json"))
    );

    // Format proof for Solidity - swap coordinates for pi_b
    const a = [proof.pi_a[0], proof.pi_a[1]];
    const b = [
      [proof.pi_b[0][1], proof.pi_b[0][0]],
      [proof.pi_b[1][1], proof.pi_b[1][0]],
    ];
    const c = [proof.pi_c[0], proof.pi_c[1]];

    const userId = ethers.keccak256(ethers.toUtf8Bytes("User1"));
    const hash = publicSignals[0];

    // Admin registers the identity hash
    await identityZkp.connect(admin).registerHash(userId, hash);

    // User submits proof (no longer sending publicSignals)
    const tx = await identityZkp.connect(user).submitProof(userId, a, b, c);
    const receipt = await tx.wait();

    // Check if ProofVerified event was emitted
    const event = receipt.logs.find(
      (log) => identityZkp.interface.parseLog(log).name === "ProofVerified"
    );

    expect(event).to.not.be.undefined;

    // Assert user is marked as verified
    const status = await identityZkp.isVerified(userId);
    expect(status).to.equal(true);
  });

  it("should allow admin to change admin", async () => {
    const [admin, user, newAdmin] = await ethers.getSigners();

    // Set new admin
    const tx = await identityZkp.connect(admin).setAdmin(newAdmin.address);
    await tx.wait();

    // Confirm admin was updated
    expect(await identityZkp.admin()).to.equal(newAdmin.address);
  });

  it("should reject non-admin from changing admin", async () => {
    const [admin, user, newAdmin] = await ethers.getSigners();

    await expect(
      identityZkp.connect(user).setAdmin(newAdmin.address)
    ).to.be.revertedWith("Only admin can perform this action");
  });
});
