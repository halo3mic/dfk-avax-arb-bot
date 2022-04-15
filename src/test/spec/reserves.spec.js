const { utils, BigNumber } = require('ethers');
const { describe, it } = require('mocha');
const { expect } = require('chai')

const { InstrManager, getPoolsForPaths } = require('../../utils/instructions');
const { ReserveManager } = require('../../utils/reserves');
const { 
    getAvaxRpcProvider, 
    getDfkRpcProvider 
} = require('../../utils/providers');

const { parseUnits } = utils;


describe('reserves', async () => {

    let reserveManager;

    before(() => {
        const providerDfk = getDfkRpcProvider()
        const providerAvax = getAvaxRpcProvider()
        const providers = {
            43114: providerAvax,
            53935: providerDfk,
        }
        const instrMngr = new InstrManager(
            require('../dummy-data/tokens.json'),
            require('../dummy-data/pools.json'),
            require('../dummy-data/paths.json'),
        )
        reserveManager = new ReserveManager(providers, instrMngr)
    })

    describe('formatReservesFromRaw', () => {

        it('decode call result', () => {
            const pool = '0x0e0100ab771e9288e0aa97e11557e6654c3a9665'
            const callRes = '0x0000000000000000000000000000000000000000000008f1e2075afe3f2fca4c000000000000000000000000000000000000000000000000000002da18a4bc64000000000000000000000000000000000000000000000000000000006254be0d'
            const [ r0, r1 ] = reserveManager.formatReservesFromRaw(pool, callRes)
            expect(r0).to.equal(parseUnits('42240884271346600626764', 0)) // no shift
            expect(r1).to.equal(parseUnits('3135739575396', 12)) // shifted for 12 points
        })
    
        it('decode event-log data', () => {
            const pool = '0x0e0100ab771e9288e0aa97e11557e6654c3a9665'
            const eventData = '0x0000000000000000000000000000000000000000000008f26200566b67983eba000000000000000000000000000000000000000000000000000002d9eff8f8a1'
            const [ r0, r1 ] = reserveManager.formatReservesFromRaw(pool, eventData)
            expect(r0).to.equal(parseUnits('42250105668029889658554', 0)) // no shift
            expect(r1).to.equal(parseUnits('3135057229985', 12)) // shifted for 12 points
        })

    })


    describe('fetchReservesRaw', async () => {

        it('dfk - present', async () => {
            const chainID = 53935
            const pool = reserveManager.instrMngr.pools
                .find(p => p.chainID === chainID).id
            const res = await reserveManager.fetchReservesRaw(pool)
            const [r0, r1] = reserveManager.formatReservesFromRaw(pool, res)
            expect(r0).gt(0)
            expect(r1).gt(0)
        })

        it('avax - present', async () => {
            const chainID = 43114
            const pool = reserveManager.instrMngr.pools
                .find(p => p.chainID === chainID).id
            const res = await reserveManager.fetchReservesRaw(pool)
            const [r0, r1] = reserveManager.formatReservesFromRaw(pool, res)
            expect(r0).gt(0)
            expect(r1).gt(0)
        })

        it('dfk - past', async () => {
            const chainID = 53935
            const pastBlock = {}
            pastBlock[chainID] = 426157
            const pool = reserveManager.instrMngr.pools
                .find(p => p.chainID === chainID).id
            const res = await reserveManager.fetchReservesRaw(pool, pastBlock)
            const [r0, r1] = reserveManager.formatReservesFromRaw(pool, res)
            expect(r0).gt(0)
            expect(r1).gt(0)
        })

        it('avax - past', async () => {
            const chainID = 43114
            const pastBlock = {}
            pastBlock[chainID] = 12931900
            const pool = reserveManager.instrMngr.pools
                .find(p => p.chainID === chainID).id
            const res = await reserveManager.fetchReservesRaw(pool, pastBlock)
            const [r0, r1] = reserveManager.formatReservesFromRaw(pool, res)
            expect(r0).gt(0)
            expect(r1).gt(0)
        })

    })

    it('fetchReservesForPaths', async () => {
        const paths = require('../dummy-data/paths.json')
        const reserves = await reserveManager.fetchReservesForPaths(paths)
        const targetPools = getPoolsForPaths(paths)
        expect(Object.keys(reserves)).to.deep.eq(targetPools)
    })

    it('setInitialReserves', async () => {
        const paths = require('../dummy-data/paths.json')
        await reserveManager.setInitialReserves(paths)
        const targetPools = getPoolsForPaths(paths)
        expect(Object.keys(reserveManager.reserves))
            .to.deep.eq(targetPools)
    })

    it('getReserves', () => {
        reserveManager.reserves = {
            '0xa': '1',
            '0xb': '2',
            '0xc': '3',
        }
        expect(reserveManager.getReserves(['0xa', '0xc']))
            .to.deep.eq({'0xa': '1', '0xc': '3'})
    })

    it('updateReserves', () => {
        reserveManager.reserves = {}
        const pool = '0x6ac38a4c112f125eac0ebdbadbed0bc8f4575d0d'
        const eventLogData = '0x000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000000003'
        reserveManager.updateReserves(pool, eventLogData)
        const [r0, r1] = reserveManager.reserves[pool]
        expect(r0).to.eq(BigNumber.from('0x0a'))
        expect(r1).to.eq(BigNumber.from('0x03'))
    })

})