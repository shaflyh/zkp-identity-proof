const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("IdentityMerkleZKPModule", (m) => {
  // First deploy the verifier from IdentityMerkleVerifier.sol
  const verifier = m.contract(
    "contracts/IdentityMerkleVerifier.sol:Groth16Verifier"
  );

  // Then deploy the identity Merkle ZKP contract with the verifier address and initial root
  // Using bytes32(0) as initial root since it's optional and can be set later
  const identityMerkleZkp = m.contract("IdentityMerkleZKP", [
    verifier,
    "0x0000000000000000000000000000000000000000000000000000000000000000", // bytes32(0) as initial root
  ]);

  return { verifier, identityMerkleZkp };
});
