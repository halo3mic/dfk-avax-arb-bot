const { utils, BigNumber } = require('ethers');
const { describe, it } = require('mocha');
const sinon = require('sinon')
const { expect } = require('chai')

const { TransactionManager } = require('../../utils/transactions');
const { getAmountOutByReserves } = require('../../utils/math');
const { InstrManager } = require('../../utils/instructions');
const { OppManager } = require('../../utils/opportunities');
const { ReserveManager } = require('../../utils/reserves');
const { 
    getAvaxRpcProvider, 
    getDfkRpcProvider 
} = require('../../utils/providers');

const { parseUnits } = utils;

function getDummyReserves() {
    const reservesRaw = require('../dummy-data/reserves.json')
    const reserves = {}
    for (let address in reservesRaw) {
        reserves[address] = reservesRaw[address].map(BigNumber.from)
    }
    return reserves
}

describe('opportunities', async () => {

    let reserveMngr
    let providers
    let oppMngr
    let sandbox

    before(async () => {
        providers = {
            43114: getAvaxRpcProvider(),
            53935: getDfkRpcProvider(),
        }
        const instrMngr = new InstrManager(
            require('../dummy-data/tokens.json'),
            require('../dummy-data/pools.json'),
            require('../dummy-data/paths.json'),
        )
        reserveMngr = new ReserveManager(
            providers, 
            instrMngr
        )
        // Set intial reserves
        reserveMngr.reserves = getDummyReserves()
        const txMngr = new TransactionManager(providers)
        oppMngr = new OppManager(reserveMngr, instrMngr, txMngr)
        sandbox = sinon.createSandbox()
    })

    afterEach(() => {
        sandbox.restore()
    })

    it('reserveUpdateHandler', async () => {
        // Create fakes for `updateReserves` and `arbsSearch`
        const updateReservesFake = sandbox.replace(
            oppMngr.reserveMngr, 
            "updateReserves", 
            sinon.fake()
        )
        const arbsSearchFake = sandbox.replace(
            oppMngr,
            "arbsSearch",
            sinon.fake()
        )
        // Create events
        const events = [
            { 
                address: '0xf3eabed6bd905e0fcd68fc3dbcd6e3a4aee55e98', 
                data: '0x01'
            },
            { 
                address: '0x04dec678825b8dfd2d0d9bd83b538be3fbda2926', 
                data: '0x02'
            },
        ]
        // Handle events
        oppMngr.reserveUpdateHandler(events)
        // Check updateReserves is called
        expect(updateReservesFake.getCall(0).args)
            .to.deep.eq(Object.values(events[0]))
        expect(updateReservesFake.getCall(1).args)
            .to.deep.eq(Object.values(events[1]))
        // Check arb-search is called with correct paths
        expect(arbsSearchFake.getCall(0).args[0].map(p => p.id)).to.deep.eq([
            '0xee5b69ee1d369aa930d669b8d2fe152f55296a29d', 
            '0x69430ad5a0ecb14cde475068e5500fdad81e0bb1b', 
        ])
    })

    it('getReservePath', () => {
        const reserves = [
            [1, 2],
            [2, 3],
            [3, 4],
            [4, 5],
            [5, 6],
        ]
        const stub = sandbox.stub(
            oppMngr.reserveMngr, 
            "getReserve"
        )
        reserves.forEach((r, i) => {
            stub.onCall(i).returns(r)
        })
        const path = oppMngr.instrMngr.paths[0]
        // JEWEL|WAVAX::PANGOLIN::43114 => JEWEL|WAVAX::JOE::43114 => WAVAX|USDC::JOE::43114 => USDC|WJEWEL::DFK-SWAP::53935 => AVAX|WJEWEL::DFK-SWAP::53935
        const expectedSwitches = [ 1, 0, 0, 0, 1 ]
        const reservePath = oppMngr.getReservePath(path)
        const actualSwitches = reserves.map((r, i) => {
            if (r[0] == reservePath[i*2] && r[1] == reservePath[i*2+1]) {
                return 0
            } else {
                return 1
            }
        })
        expect(actualSwitches).to.deep.eq(expectedSwitches)
    })

    describe('checkForArb', async () => {
        
        it('is accurate', async () => {
            const rA0 = parseUnits('0.1')
            const rA1 = parseUnits('0.3')
            const rB0 = parseUnits('1')
            const rB1 = parseUnits('2')
            sandbox.stub(oppMngr, "getReservePath")
                .returns([rA0, rA1, rB0, rB1])
            const path = oppMngr.instrMngr.paths[0]
            const arb = oppMngr.checkForArb(path)
            const amountOut = getAmountOutByReserves(
                arb.amounts[0], 
                [rA0, rA1, rB0, rB1]
            )
            expect(arb.grossProfit).to.equal(amountOut.sub(arb.amounts[0]))
            expect(arb.path).to.deep.eq(path)
        })

        it('returns false if intial try below min-profit', () => {
            const rA0 = parseUnits('0.1')
            const rA1 = parseUnits('0.3')
            const rB0 = parseUnits('1')
            const rB1 = parseUnits('2')
            const reservePath = [rA0, rA1, rB0, rB1]
            sandbox.stub(oppMngr, "getReservePath")
                .returns(reservePath)
            const minProfit = getAmountOutByReserves(oppMngr.minAmountIn, reservePath)
            oppMngr.minProfit = minProfit.mul(2)
            expect(oppMngr.checkForArb()).to.be.undefined
        })

    })
    
    it('getStepsFromOpportunity', async () => {
        const amounts = [
            parseUnits('0.1'),
            parseUnits('0.2'),
            parseUnits('0.3'),
            parseUnits('0.4'),
            parseUnits('0.5'),
            parseUnits('0.6'),
        ]
        const path = oppMngr.instrMngr.paths[0]
        const opportunity = {
            grossProfit: parseUnits('0.1'),
            amounts,
            path, 
        }
        const steps = oppMngr.getStepsFromOpportunity(opportunity)

        const step0 = path.steps[0]
        expect(steps[0].chainID).to.eq(43114)
        expect(steps[0].tkns).to.deep.eq(step0.tkns)
        expect(steps[0].pools).to.deep.eq(step0.pools)
        expect(steps[0].amounts).to.deep.eq(amounts.slice(0, 4))
        expect(steps[0].dexes).to.deep.eq(['pangolin', 'joe', 'joe'])

        const step1 = path.steps[1]
        expect(steps[1].chainID).to.eq(53935)
        expect(steps[1].tkns).to.deep.eq(step1.tkns)
        expect(steps[1].pools).to.deep.eq(step1.pools)
        expect(steps[1].amounts).to.deep.eq(amounts.slice(3))
        expect(steps[1].dexes).to.deep.eq(['dfk-swap', 'dfk-swap'])
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
        const arbs = await oppMngr.instrMngr.paths
            .map(p => oppMngr.checkForArb(p))
            .flat(_=>_)
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