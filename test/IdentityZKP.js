const { expect } = require("chai");
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

describe("IdentityZKP", function () {
  let verifier;
  let identityZkp;
  let admin, user, newAdmin;

  beforeEach(async () => {
    [admin, user, newAdmin] = await ethers.getSigners();

    const VerifierFactory = await ethers.getContractFactory("Groth16Verifier");
    verifier = await VerifierFactory.connect(admin).deploy();
    await verifier.waitForDeployment();

    const IdentityZKPFactory = await ethers.getContractFactory("IdentityZKP");
    identityZkp = await IdentityZKPFactory.connect(admin).deploy(
      await verifier.getAddress()
    );
    await identityZkp.waitForDeployment();
  });

  it("should allow user to submit hash and admin to approve it", async () => {
    const userId = ethers.keccak256(ethers.toUtf8Bytes("User1"));
    const fakeHash =
      "1234567890123456789012345678901234567890123456789012345678901234";

    await identityZkp.connect(user).submitHashByUser(userId, fakeHash);
    const storedHash = await identityZkp.submittedHash(userId);
    expect(storedHash).to.equal(fakeHash);

    await identityZkp.connect(admin).approveIdentity(userId);
    const registeredHash = await identityZkp.registeredHash(userId);
    expect(registeredHash).to.equal(fakeHash);
  });

  it("should verify valid proof and mark user as verified", async () => {
    const proof = JSON.parse(
      fs.readFileSync(path.join(__dirname, "../build/proof.json"))
    );
    const publicSignals = JSON.parse(
      fs.readFileSync(path.join(__dirname, "../build/public.json"))
    );

    const a = [proof.pi_a[0], proof.pi_a[1]];
    const b = [
      [proof.pi_b[0][1], proof.pi_b[0][0]],
      [proof.pi_b[1][1], proof.pi_b[1][0]],
    ];
    const c = [proof.pi_c[0], proof.pi_c[1]];

    const userId = ethers.keccak256(ethers.toUtf8Bytes("User1"));
    const hash = publicSignals[0];

    // 1. User submit hash
    await identityZkp.connect(user).submitHashByUser(userId, hash);

    // 2. Admin approve hash
    await identityZkp.connect(admin).approveIdentity(userId);

    // 3. User submit proof
    const tx = await identityZkp.connect(user).submitProof(userId, a, b, c);
    const receipt = await tx.wait();

    // 4. Check event emitted
    const event = receipt.logs.find(
      (log) => identityZkp.interface.parseLog(log).name === "ProofVerified"
    );
    expect(event).to.not.be.undefined;

    // 5. Check verification status
    const status = await identityZkp.isVerified(userId);
    expect(status).to.equal(true);
  });

  it("should allow admin to change admin", async () => {
    const tx = await identityZkp.connect(admin).setAdmin(newAdmin.address);
    await tx.wait();
    expect(await identityZkp.admin()).to.equal(newAdmin.address);
  });

  it("should reject non-admin from changing admin", async () => {
    await expect(
      identityZkp.connect(user).setAdmin(newAdmin.address)
    ).to.be.revertedWith("Only admin can perform this action");
  });
});
