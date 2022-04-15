require('dotenv').config();
require("@nomiclabs/hardhat-waffle");
require('hardhat-deploy-ethers');
require('hardhat-abi-exporter');
require('hardhat-deploy');

// TODO: Add task to approve tokens 
// const { task } = require("hardhat/config");

const { getEnvVar } = require('./src/utils/utils');

module.exports = {
  mocha: {
    timeout: 1e6,
    recursive: true,
    spec: ['./src/test/spec/**/*.spec.js']
  },
  solidity: {
      version: "0.8.0", 
      settings: {
        optimizer: {
          enabled: true,
          runs: 999
        }  
      }
  },
  namedAccounts: {
    trader: {
      43114: 0,
      53935: 0,
    }
  },
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {
      chainId: 53935,
      forking: {
        url: getEnvVar('DFK_RPC'), 
        blockNumber: 636148
      },
      accounts: {
        accountsBalance: "10000000000000000000000000", 
        count: 20
      }
    }, 
    mainnetAVAX: {
      chainId: 43114,
      gasPrice: 225000000000,
      url: getEnvVar('AVAX_RPC'),
      accounts: [
        getEnvVar('PK_LIVE_43114')
      ]
    },
    mainnetDFK: {
      chainId: 53935,
      gasPrice: 1,
      url: getEnvVar('DFK_RPC'),
      accounts: [
        getEnvVar('PK_LIVE_53935')
      ]
    }
  },
  paths: {
    deployments: 'deployments',
    deploy: 'deploy',
  },
  abiExporter: {
    path: './src/static/abis',
    clear: false,
    flat: true
  }
};