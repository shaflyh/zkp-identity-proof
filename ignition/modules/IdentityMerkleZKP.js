const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("IdentityMerkleZKPModule", (m) => {
  // First deploy the verifier from IdentityMerkleVerifier.sol
  const verifier = m.contract(
    "contracts/IdentityMerkleVerifier.sol:Groth16Verifier"
  );

  // Then deploy the identity Merkle ZKP contract with the verifier address
  const identityMerkleZkp = m.contract("IdentityMerkleZKP", [verifier]);

  return { verifier, identityMerkleZkp };
});
