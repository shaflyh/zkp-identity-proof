const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("IdentityModule", (m) => {
  // First deploy the verifier
  const verifier = m.contract("Groth16Verifier");

  // Then deploy the identity ZKP contract with the verifier address as constructor argument
  const identityZkp = m.contract("IdentityZKP", [verifier]);

  return { verifier, identityZkp };
});
