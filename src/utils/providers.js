require('dotenv').config()  // TODO: rm in prod (move into upper lvls)
const { providers } = require('ethers')
const { getEnvVar } = require('./utils')

const _getDfkRpcProvider = () => {
    return new providers.JsonRpcBatchProvider(getEnvVar('DFK_RPC'))
}
const _getAvaxRpcProvider = () => {
    return new providers.JsonRpcBatchProvider(getEnvVar('AVAX_RPC'))
}
module.exports.getDfkRpcProvider = _getDfkRpcProvider
module.exports.getAvaxRpcProvider = _getAvaxRpcProvider
module.exports.getRpcProviderByChainID = (chainID) => {
    switch (chainID) {
        case 53935:
            return _getDfkRpcProvider()
        case 43114:
            return _getAvaxRpcProvider()
        default:
            throw new Error(`Unsupported chainID: ${chainID}`)
    }
}