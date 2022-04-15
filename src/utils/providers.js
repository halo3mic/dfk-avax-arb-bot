require('dotenv').config()  // TODO: rm in prod (move into upper lvls)
const { providers } = require('ethers')
const { getEnvVar } = require('./utils')

const AVAX_CHAIN_ID = getEnvVar('AVAX_CHAIN_ID', true)
const DFK_CHAIN_ID = getEnvVar('DFK_CHAIN_ID', true)

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
        case DFK_CHAIN_ID:
            return _getDfkRpcProvider()
        case AVAX_CHAIN_ID:
            return _getAvaxRpcProvider()
        default:
            throw new Error(`Unsupported chainID: ${chainID}`)
    }
}