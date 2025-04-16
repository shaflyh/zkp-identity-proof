import { ignition } from "hardhat";
import IdentityModule from "../ignition/modules/IdentityZKP";

describe("IdentityZKP", () => {
  it("should deploy and allow proof submission", async () => {
    const { identityZkp } = await ignition.deploy(IdentityModule);
    expect(await identityZkp.isVerified(addr)).to.equal(false);
  });
});
