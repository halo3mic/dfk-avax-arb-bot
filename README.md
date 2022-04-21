# cross-chain-uni-arbbot

Arbitrage bot for cross-chain arbitrage written in Javascript.
Only supports Uniswap-like pools. 

## Current support

 * DFK => Avalanche
 * Avalanche => DFK

## Commands

#### Start the bot
```bash
yarn start
```

#### Start the bot with continious run
Session will be restarted if error occurs.
Errors are logged in `./logs/err.log` and all stdout in `./logs/out.log`.
Note that for this command the `forever` module needs to be installed globally with `yarn add global forever`.
```bash
yarn start-forever
```

#### Run tests
```bash
yarn test
```

#### Add pool 
```bash
yarn add-pool <pool-address> --dex <dex-id>
```

#### Add all pools for listed factories
Adds all pools for the factories listed in `./src/static/dexes.json`.
```bash
yarn add-all-pools <dex-id>
```

#### Generate paths
Generates paths for listed pools based on the rules specified in `./src/tools/path-gen.js`.
```bash
yarn gen-paths
```
