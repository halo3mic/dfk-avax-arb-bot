const { utils } = require('ethers')
const { lowerEq } = require('./utils')

class InstrManager {

    constructor(tokens, pools, paths) {
        this.tokens = tokens
        this.pools = pools
        this.paths = paths
    }
    getPathInfo(id) {
        return this.paths.find(p => lowerEq(p.id, id))
    } 
    getPoolInfo(id) {
        return this.pools.find(p => lowerEq(p.id, id))
    }
    getTokenInfo(id) {
        return this.tokens.find(p => lowerEq(p.id, id))
    }

}

function getPoolsForPaths(_paths) {
    const pools = new Set()
    _paths.forEach(path => {
        path.steps.forEach(step => {
            step.pools.forEach(pool => {
                pools.add(pool)
            })
        })
    })
    return [...pools]
}

/**
 * Return only paths that include at least one of the pools
 * @param {Array} paths The paths that should be checked
 * @param {Array} pools The pool ids that paths should be filtered by
 * @returns 
 */
 function filterPathsByPools(paths, pools) {
    return paths.filter(path => {
        return path.steps.some(step => {
            return step.pools.some(pool => pools.includes(pool))
        })
    })
}

/**
 * Return only paths that include all tokens
 * @param {Array} paths The paths that should be checked
 * @param {Array} tokens The token ids paths should be filtered by
 * @returns 
 */
function filterPathsByTokens(paths, tokens) {
    return paths.filter(path => {
        return path.steps.some(step => {
            return step.tkns.some(tkn => tokens.includes(tkn))
        })
    })
}

// /**
//  * Set paths that fit configuration
//  */
//  function filterPathsByConfig(_paths) {
//      _paths = _paths.filter(path => {
//          const exchangePath = path.pools.map(poolId=>_poolById[poolId].exchange)
//          return (
//             path.tkns.filter(t => config.settings.arb.blacklistedTokens.includes(t)).length == 0 &&  // Exclude blacklisted tokens
//             path.tkns[0] == config.settings.arb.baseAsset &&  // Paths needs to start in BASE-ASSET
//             path.tkns[path.tkns.length - 1] == config.settings.arb.baseAsset &&  // Path needs to end in BASE-ASSET
//             path.enabled &&  // Path needs to be enabled
//             config.settings.arb.maxHops >= path.pools.length &&  // Filter path length
//             exchangePath.filter(dex=>!config.settings.arb.whitelistedDexes.includes(dex)).length == 0  // Filter dexes
//         )
//     })
//     console.log('Found ', _paths.length, ' valid paths')
//     return _paths
// }

// /**
//  * Filter out all paths that have an empty pool
//  */
//  function filterPathsWithEmptyPool(_paths, _reserves) {
//     _reserves = _reserves || {}
//     let threshold = config.settings.arb.emptyPoolThreshold
//     let validPools = Object.entries(_reserves).map(e => {
//         let [ poolId, reserves ] = e
//         let rVals = Object.values(reserves) 
//         if (rVals[0].gt(threshold) || rVals[1].gt(threshold)) {
//             return poolId
//         }
//     }).filter(e=>e)
//     _paths = _paths.filter(path=>path.pools.filter(
//             p=>validPools.includes(p)
//         ).length==path.pools.length
//     )
//     console.log('Found ', _paths.length, ' valid paths with non-empty pools')
//     return _paths
// }

async function getPoolsFromFactory(factoryAddress, provider) {
    // TODO: Try with multicall
    const poolCount = await provider.call({ 
        to: factoryAddress, 
        data: '0x574f2ba3' // allPairsLength()(uint)
    }).then(r => parseInt(r, 16))
    return Promise.all(Array.from(Array(poolCount).keys()).map(async i => {
        const methodSig = '0x1e3dd18b' // allPairs(uint)(address)
        const args = i.toString(16).padStart(64, '0')
        const pool = await provider.call({
            to: factoryAddress, 
            data: methodSig + args
        }).then(r => '0x' + r.slice(26))
        const tkns = await getPoolTokens(pool, provider)
        return { id: pool, tkn0: tkns[0], tkn1: tkns[1] }
    }))
}

async function getPoolTokens(pool, provider) {
    const [ tkn0, tkn1 ] = await Promise.all([
        provider.call({ to: pool, data: '0x0dfe1681' }), // token0()
        provider.call({ to: pool, data: '0xd21220a7' }), // token1()
    ]).then(r => r.map(r => '0x' + r.slice(26)))
    return [ tkn0, tkn1 ]
}

async function getTokenInfo(token, provider) {
    const [ symbol, decimals ] = await Promise.all([
        provider.call({ to: token, data: '0x95d89b41' }) // symbol()
            .then(r => utils.defaultAbiCoder.decode(['string'], r)[0]), 
        provider.call({ to: token, data: '0x313ce567' }) // decimals()
            .then(r => parseInt(r, 16)) 
    ])
    return { decimals, symbol }
}

module.exports = {
    InstrManager,
    getPoolsFromFactory,
    filterPathsByTokens,
    filterPathsByPools,
    filterPathsByPools,
    getPoolsForPaths,
    getPoolTokens,
    getTokenInfo,
}

