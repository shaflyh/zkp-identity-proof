const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("IdentityModule", (m) => {
  const identityZkp = m.contract("IdentityZKP");
  return { identityZkp };
});
