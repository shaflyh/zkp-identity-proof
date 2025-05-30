require("dotenv").config();
require("@nomicfoundation/hardhat-toolbox");

const {
  PRIVATE_KEY,
  POLYGON_AMOY_RPC,
  POLYGON_MAINNET_RPC,
  POLYGONSCAN_API_KEY,
} = process.env;

module.exports = {
  solidity: "0.8.20",
  networks: {
    polygonAmoy: {
      url: POLYGON_AMOY_RPC,
      accounts: [PRIVATE_KEY],
    },
    polygonMainnet: {
      url: POLYGON_MAINNET_RPC,
      accounts: [PRIVATE_KEY],
    },
  },
  etherscan: {
    apiKey: {
      polygonAmoy: POLYGONSCAN_API_KEY,
      polygon: POLYGONSCAN_API_KEY,
    },
  },
};
