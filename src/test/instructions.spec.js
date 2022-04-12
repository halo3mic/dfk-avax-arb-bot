const { 
    filterPathsByTokens,
    filterPathsByPools,
    getPoolsForPaths,
    InstrManager,
} = require('../utils/instructions.js')
const { describe, it } = require('mocha');
const { expect } = require('chai');

describe('instructions', () => {

    describe('InstrManager', async () => {
        let instrManager

        before(() => {
            instrManager = new InstrManager(
                require('./dummy-data/tokens.json'),
                require('./dummy-data/pools.json'),
                require('./dummy-data/paths.json'),
            )
        })

        it('getPathInfo', () => {
            const id = '0xee5b69ee1d369aa930d669b8d2fe152f55296a29d'
            const info = instrManager.getPathInfo(id)
            expect(info).to.deep.eq(
                require('./dummy-data/paths.json').find(p => p.id == id)
            )
        })

        it('getPoolInfo', () => {
            const id = '0xee5b69ee1d369aa930d669b8d2fe152f55296a29d'
            const info = instrManager.getPoolInfo(id)
            expect(info).to.deep.eq(
                require('./dummy-data/pools.json').find(p => p.id == id)
            )
        })

        it('getTokenInfo', () => {
            const id = '0xee5b69ee1d369aa930d669b8d2fe152f55296a29d'
            const info = instrManager.getTokenInfo(id)
            expect(info).to.deep.eq(
                require('./dummy-data/tokens.json').find(p => p.id == id)
            )
        })

        it('getPoolsForPaths', () => {
            const pools = getPoolsForPaths(instrManager.paths)
            expect(pools).to.deep.eq([
                '0x9AA76aE9f804E7a70bA3Fb8395D0042079238E9C', 
                '0xE90E8B880Cbe62d3f2958C9280DbC139465BD9A1',
                '0xf4003f4efbe8691b60249e6afbd307abe7758adb',
                '0xcf329b34049033de26e4449aebcb41f1992724d3',
                '0xf3eabed6bd905e0fcd68fc3dbcd6e3a4aee55e98',
                '0x48658e69d741024b4686c8f7b236d3f1d291f386',
                '0x9f378f48d0c1328fd0c80d7ae544c6cadb5ba99e',
                '0x04dec678825b8dfd2d0d9bd83b538be3fbda2926'
            ])
        })

        it('filterPathsByPools', async () => {
            const paths = filterPathsByPools(
                instrManager.paths, 
                [ '0x48658e69d741024b4686c8f7b236d3f1d291f386' ]
            )
            expect(paths.map(p => p.id)).to.deep.eq([
                '0xdeefa3f013ca5d233b21c19b0ba4f95365beddc58',
                '0x69430ad5a0ecb14cde475068e5500fdad81e0bb1b'
            ])
        })

        it('filterPathsByTokens', async () => {
            const paths = filterPathsByTokens(
                instrManager.paths, 
                [ 
                    '0x04b9da42306b023f3572e106b11d82aad9d32ebb',
                    '0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7'
                ]
            )
            expect(paths.map(p => p.id)).to.deep.eq([
                '0xee5b69ee1d369aa930d669b8d2fe152f55296a29d',
                '0xdeefa3f013ca5d233b21c19b0ba4f95365beddc58',
                '0x69430ad5a0ecb14cde475068e5500fdad81e0bb1b',
            ])
        })
    })

})

