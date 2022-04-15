const { getAvaxRpcProvider, getDfkRpcProvider } = require('./utils/providers');
const { InstrManager, getPoolsForPaths } = require('./utils/instructions')
const { ReserveManager } = require('./utils/reserves')
const { getEnvVar } = require('./utils/utils')
const { OppManager } = require('./utils/opportunities')
const { Listener } = require('./listener')

async function main() {
    const UNISWAP_SYNC_TOPIC = getEnvVar('UNISWAP_SYNC_TOPIC')
    const AVAX_CHAIN_ID = getEnvVar('AVAX_CHAIN_ID', true)
    const DFK_CHAIN_ID = getEnvVar('DFK_CHAIN_ID', true)

    const providers = Object.fromEntries([
        [AVAX_CHAIN_ID, getAvaxRpcProvider()],
        [DFK_CHAIN_ID, getDfkRpcProvider()],
    ])
    const instrMngr = new InstrManager(
        require('./static/instructions/tokens.json'),
        require('./static/instructions/pools.json'),
        require('./static/instructions/paths.json'),
    )
    const reserveMngr = new ReserveManager(
        providers, 
        instrMngr
    )
    await reserveMngr.setInitialReserves(instrMngr.paths)
    const oppMngr = new OppManager(reserveMngr, instrMngr)
    const intialArbs = await oppMngr.arbsSearch(instrMngr.paths)
    console.log('Initial arbitrage opportunities:', intialArbs)
    const listener = new Listener(providers)

    const activePools = getPoolsForPaths(instrMngr.paths)
    listener.addTrigger(
        AVAX_CHAIN_ID, 
        { topics: [ UNISWAP_SYNC_TOPIC ], addresses: activePools }, 
        oppMngr.reserveUpdateHandler.bind(oppMngr)
    )
    listener.addTrigger(
        DFK_CHAIN_ID, 
        { topics: [ UNISWAP_SYNC_TOPIC ], addresses: activePools }, 
        oppMngr.reserveUpdateHandler.bind(oppMngr)
    )
    listener.listenForUpdates()
}

main()