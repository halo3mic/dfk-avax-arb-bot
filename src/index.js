const { getAvaxRpcProvider, getDfkRpcProvider } = require('./utils/providers');
const { InstrManager, getPoolsForPaths } = require('./utils/instructions')
const { ReserveManager } = require('./utils/reserves')
const { ArbManager } = require('./arbitrage')
const { Listener } = require('./listener')

async function main() {
    const UNISWAP_SYNC_TOPIC = '0x1c411e9a96e071241c2f21f7726b17ae89e3cab4c78be50e062b03a9fffbbad1'
    const providers = {
        43114: getAvaxRpcProvider(),
        53935: getDfkRpcProvider(),
    }
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
    const arbMngr = new ArbManager(reserveMngr, instrMngr)
    await arbMngr.arbsSearch(instrMngr.paths)
    const listener = new Listener(providers)

    const activePools = getPoolsForPaths(instrMngr.paths)
    listener.addTrigger(
        43114, 
        { topics: [ UNISWAP_SYNC_TOPIC ], addresses: activePools }, 
        arbMngr.reserveUpdateHandler.bind(arbMngr)
    )
    listener.addTrigger(
        53935, 
        { topics: [ UNISWAP_SYNC_TOPIC ], addresses: activePools }, 
        arbMngr.reserveUpdateHandler.bind(arbMngr)
    )
    listener.listenForUpdates()
}

main()