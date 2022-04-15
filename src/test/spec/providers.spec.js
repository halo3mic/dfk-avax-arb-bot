const {
    getAvaxRpcProvider,
    getDfkRpcProvider, 
} = require('../../utils/providers.js');
const { describe, it } = require('mocha');
const { expect } = require('chai');

describe('providers', () => {

    it('getAvaxRpcProvider', async () => {
        const provider = getAvaxRpcProvider()
        expect(await provider.getNetwork().then(r => r.chainId)).to.eq(43114)
    })

    it('getDfkRpcProvider', async () => {
        const provider = getDfkRpcProvider()
        expect(await provider.getNetwork().then(r => r.chainId)).to.eq(53935)
    })

})

