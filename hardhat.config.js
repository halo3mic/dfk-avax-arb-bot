require('dotenv').config();
require("@nomiclabs/hardhat-waffle");
require('hardhat-deploy-ethers');
require('hardhat-abi-exporter');
require('hardhat-deploy');

const { task } = require("hardhat/config");

task("approve-token", "Approves ERC20 token for spender (max approval only)")
  .addParam("token", "ERC20 token address")
  .addParam("spender", "Address of the spender")
  .setAction(
    async({token, spender}, hre) => {
      const { approveERC20, getERC20Allowance } = require('./src/test/helpers')
      
      const maxUint = hre.ethers.constants.MaxUint256
      const { trader: traderAdd } = await hre.getNamedAccounts()
      const trader = await hre.ethers.getSigner(traderAdd)
      console.log(`Approving spender ${spender} to spend ${token} of ${trader.address}`)

      await approveERC20(
          trader, 
          token, 
          spender, 
          maxUint
      )
      const allowance = await getERC20Allowance(
          trader, 
          token, 
          trader.address,
          spender
      )
      if (allowance.lt(maxUint)) {
          throw new Error(`${token} allowance is not maxUint`)
      }
    }
  )
task("approve-all", "Approves ERC20 tokens")
  .setAction(
    async({}, hre) => {
      const { approveERC20, getERC20Allowance } = require('./src/test/helpers')
      const maxUint = hre.ethers.constants.MaxUint256
      const { trader: traderAdd } = await hre.getNamedAccounts()
      const trader = await hre.ethers.getSigner(traderAdd)

      const chainID = await hre.getChainId()
      const tokens = require('./src/static/instructions/tokens.json')
        .filter(t => t.chainID == chainID)
        .map(t => t.id)
      let spender
      if (chainID == getEnvVar('DFK_CHAIN_ID', true)) {
        spender = require('./src/static/dexes.json').find(d => d.id == 'dfk-swap').router
      } else if (chainID == getEnvVar('AVAX_CHAIN_ID', true)) {
        spender = require('./src/static/config.json').yakrouter
      } else {
        throw new Error(`Unsupported chainID: ${chainID}`)
      }

      for (let token of tokens) {
        const allowance = await getERC20Allowance(
          trader, 
          token, 
          trader.address,
          spender
        )
        if (allowance.lt(maxUint)) {
          console.log(`Approving spender ${spender} to spend ${token} of ${trader.address}`)
          await approveERC20(
              trader, 
              token, 
              spender, 
              maxUint
          )
        }
      }
    }
  )

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
    'avax-mainnet': {
      chainId: 43114,
      gasPrice: 225000000000,
      url: getEnvVar('AVAX_RPC'),
      accounts: [
        getEnvVar('PK_LIVE_43114')
      ]
    },
    'dfk-mainnet': {
      chainId: 53935,
      gasPrice: 1000000000,
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