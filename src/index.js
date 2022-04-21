const { getAvaxRpcProvider, getDfkRpcProvider } = require('./utils/providers');
const { InstrManager, getPoolsForPaths } = require('./utils/instructions')
const { TransactionManager } = require('./utils/transactions') 
const { InventoryManager } = require('./utils/inventory') 
const { OppManager } = require('./utils/opportunities')
const { ReserveManager } = require('./utils/reserves')
const { getEnvVar } = require('./utils/utils')
const { Listener } = require('./listener')

async function main() {
    const UNISWAP_SYNC_TOPIC = getEnvVar('UNISWAP_SYNC_TOPIC')
    const ERC20_TRANSFER_TOPIC = getEnvVar('ERC20_TRANSFER_TOPIC')
    const AVAX_CHAIN_ID = getEnvVar('AVAX_CHAIN_ID', true)
    const DFK_CHAIN_ID = getEnvVar('DFK_CHAIN_ID', true)

    const providers = Object.fromEntries([
        [AVAX_CHAIN_ID, getAvaxRpcProvider()],
        [DFK_CHAIN_ID, getDfkRpcProvider()],
    ])
    const txMngr = new TransactionManager(providers)
    const chainToHolders = Object.fromEntries(
        Object.entries(txMngr.signers).map(([k, v]) => [k, [v.address]])
    )
    const inventoryMngr = new InventoryManager(
        providers, 
        chainToHolders
    )
    await inventoryMngr.setInitialBals()
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
    const oppMngr = new OppManager(
        reserveMngr, 
        instrMngr, 
        txMngr,
        inventoryMngr, 
        true
    )
    const intialArbs = await oppMngr.arbsSearch(instrMngr.paths)
    console.log('Initial arbitrage opportunities:', intialArbs)
    const listener = new Listener(providers)

    const activePools = getPoolsForPaths(instrMngr.paths)
    // Lister for Uniswap Sync events
    listener.addTrigger(
        AVAX_CHAIN_ID, 
        { topics: [ 
            UNISWAP_SYNC_TOPIC ], 
            addresses: activePools.map(a => a.toLowerCase())
        }, 
        oppMngr.reserveUpdateHandler.bind(oppMngr)
    )
    listener.addTrigger(
        DFK_CHAIN_ID, 
        { 
            topics: [ UNISWAP_SYNC_TOPIC ], 
            addresses: activePools.map(a => a.toLowerCase())
        }, 
        oppMngr.reserveUpdateHandler.bind(oppMngr)
    )
    // Lister for ERC20 Transfer events
    listener.addTrigger(
        AVAX_CHAIN_ID, 
        { 
            addresses: instrMngr.tokens.map(t => t.id.toLowerCase()),
            topics: [ 
                ERC20_TRANSFER_TOPIC, // topic-0 must be Transfer sig
            ], 
        }, 
        inventoryMngr.balanceUpdateHandler.bind(inventoryMngr)
    )
    listener.addTrigger(
        DFK_CHAIN_ID, 
        { 
            addresses: instrMngr.tokens.map(t => t.id.toLowerCase()),
            topics: [ 
                ERC20_TRANSFER_TOPIC, // topic-0 must be Transfer sig
            ], 
        }, 
        inventoryMngr.balanceUpdateHandler.bind(inventoryMngr)
    )
    // // Lister for ERC20 transfer events from holders
    // listener.addTrigger(
    //     AVAX_CHAIN_ID, 
    //     { 
    //         addresses: instrMngr.tokens.map(t => t.id),
    //         topics: [ 
    //             ERC20_TRANSFER_TOPIC, // topic-0 must be Transfer sig
    //             chainToHolders[AVAX_CHAIN_ID],  // topic-1 (from) must be holder
    //         ], 
    //     }, 
    //     inventoryMngr.balanceUpdateHandler.bind(inventoryMngr)
    // )
    // listener.addTrigger(
    //     DFK_CHAIN_ID, 
    //     { 
    //         addresses: instrMngr.tokens.map(t => t.id),
    //         topics: [ 
    //             ERC20_TRANSFER_TOPIC, // topic-0 must be Transfer sig
    //             chainToHolders[DFK_CHAIN_ID],  // topic-1 (from) must be holder
    //         ], 
    //     }, 
    //     inventoryMngr.balanceUpdateHandler.bind(inventoryMngr)
    // )
    // // Lister for ERC20 transfer events to holders
    // listener.addTrigger(
    //     AVAX_CHAIN_ID, 
    //     { 
    //         addresses: instrMngr.tokens.map(t => t.id),
    //         topics: [ 
    //             ERC20_TRANSFER_TOPIC, // topic-0 must be Transfer sig
    //             [],
    //             chainToHolders[AVAX_CHAIN_ID],  // topic-2 (to) must be holder
    //         ], 
    //     }, 
    //     inventoryMngr.balanceUpdateHandler.bind(inventoryMngr)
    // )
    // listener.addTrigger(
    //     DFK_CHAIN_ID, 
    //     { 
    //         addresses: instrMngr.tokens.map(t => t.id),
    //         topics: [ 
    //             ERC20_TRANSFER_TOPIC, // topic-0 must be Transfer sig
    //             [],
    //             chainToHolders[DFK_CHAIN_ID],  // topic-2 (to) must be holder
    //         ], 
    //     }, 
    //     inventoryMngr.balanceUpdateHandler.bind(inventoryMngr)
    // )
    listener.listenForUpdates()
}

main()