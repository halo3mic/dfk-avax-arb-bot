const { solidity } = require('ethereum-waffle');
const { describe, it } = require('mocha');
const { utils } = require('ethers');
const chai = require('chai')

const { getOptimalAmountForPath, getAmountOutByReserves } = require('../utils/math');
const { getAvaxRpcProvider, getDfkRpcProvider } = require('../utils/providers');
const { InstrManager, getPoolsForPaths } = require('../utils/instructions');
const { ReserveManager } = require('../utils/reserves');
const { OppManager } = require('../utils/opportunities');
const { Listener } = require('../listener');
const { sleep } = require('../utils/utils');

chai.use(solidity)
const { expect } = chai;
const { parseUnits } = utils;

describe('arbitrage', async () => {

    const UNISWAP_SYNC_TOPIC = '0x1c411e9a96e071241c2f21f7726b17ae89e3cab4c78be50e062b03a9fffbbad1';

    let oppMngr
    let providers
    let instrMngr

    before(async () => {
        providers = {
            43114: getAvaxRpcProvider(),
            53935: getDfkRpcProvider(),
        }
        instrMngr = new InstrManager(
            require('./dummy-data/tokens.json'),
            require('./dummy-data/pools.json'),
            require('./dummy-data/paths.json'),
        )
        const reserveMngr = new ReserveManager(
            providers, 
            instrMngr
        )
        await reserveMngr.setInitialReserves(instrMngr.paths)
        oppMngr = new OppManager(reserveMngr, instrMngr)
    })

    it('Detects obvious arbitrage', async () => {
        // Set up arb opportunity
        const updatePool = '0xf3eabed6bd905e0fcd68fc3dbcd6e3a4aee55e98'
        const [ oldR0, oldR1 ] = oppMngr.reserveMngr.reserves[updatePool]
        const r0 = oldR0.mul(2)
        const r1 = oldR1.div(2)
        const data = utils.defaultAbiCoder.encode(
            ['uint256', 'uint256'],
            [r0, r1]
        )
        oppMngr.reserveMngr.updateReserves(updatePool, data)
        const arbs = await oppMngr.arbsSearch(oppMngr.instrMngr.paths)
        expect(arbs[0].grossProfit).gt(0)
    })

    // it.only('arb opp in block xx', async () => {
    //     const blockNumbers = { 43114: 13321455, 53935: 541425 }
    //     const reserveMngr = new ReserveManager(providers, instrMngr)
    //     await reserveMngr.setInitialReserves(instrMngr.paths, blockNumbers)
    //     const oppMngr = new OppManager(reserveMngr, instrMngr)
    //     const arbs = await oppMngr.arbsSearch(oppMngr.instrMngr.paths)
    //     console.log(arbs)
    // })

})