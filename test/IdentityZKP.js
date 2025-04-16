const { expect } = require("chai");
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

describe("IdentityZKP", function () {
  let verifier;
  let identityZkp;
  let user;

  beforeEach(async () => {
    [user] = await ethers.getSigners();

    // Deploy the Groth16Verifier contract first
    const VerifierFactory = await ethers.getContractFactory("Groth16Verifier");
    verifier = await VerifierFactory.deploy();
    await verifier.waitForDeployment();

    // Deploy the IdentityZKP contract with verifier address
    const IdentityZKPFactory = await ethers.getContractFactory("IdentityZKP");
    identityZkp = await IdentityZKPFactory.deploy(await verifier.getAddress());
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

    // Format proof for Solidity - note the coordinate swap for pi_b
    const a = [proof.pi_a[0], proof.pi_a[1]];
    const b = [
      [proof.pi_b[0][1], proof.pi_b[0][0]], // Swap the coordinates for Solidity
      [proof.pi_b[1][1], proof.pi_b[1][0]], // Swap the coordinates for Solidity
    ];
    const c = [proof.pi_c[0], proof.pi_c[1]];
    const input = publicSignals;

    console.log("Submitting proof to contract:");
    console.log("a:", a);
    console.log("b:", b);
    console.log("c:", c);
    console.log("input:", input);

    // Listen for the DebugEvent
    const debugPromise = new Promise((resolve) => {
      identityZkp.on("DebugEvent", (message, result) => {
        console.log(`Debug: ${message} - Result: ${result}`);
        resolve(result);
      });
    });

    // Submit proof
    const tx = await identityZkp.connect(user).submitProof(a, b, c, input);
    const receipt = await tx.wait();

    // Wait for debug event
    const debugResult = await debugPromise;
    console.log("Verification result from event:", debugResult);

    // Check if verification succeeded
    const verifiedEvent = receipt.logs.find(
      (log) => identityZkp.interface.parseLog(log).name === "ProofVerified"
    );

    expect(verifiedEvent).to.not.be.undefined;

    // Assert user is verified
    const status = await identityZkp.isUserVerified(user.address);
    expect(status).to.equal(true);
  });
});
