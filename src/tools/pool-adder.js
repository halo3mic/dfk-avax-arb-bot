const { writeFileSync } = require('fs')
const { resolve } = require('path')

const { 
    getPoolsFromFactory,
    getPoolTokens,
    getTokenInfo,
} = require('../utils/instructions')
const { getRpcProviderByChainID } = require('../utils/providers')
const dexes = require('../static/dexes.json')

const POOL_FILE_PATH = resolve(__dirname, '../static/instructions/pools.json')
const TKN_FILE_PATH = resolve(__dirname, '../static/instructions/tokens.json')

function safeCall(call, defaultReturn) {
    try {
        return call()
    } catch {
        return defaultReturn
    }
}

const tokens = safeCall(() => require(TKN_FILE_PATH), [])


function writePools(pools, replace=false) {
    if (!replace) {
        const current = safeCall(() => require(POOL_FILE_PATH), [])
        pools = [ ...current, ...pools ]
    }
    writeFileSync(POOL_FILE_PATH, JSON.stringify(pools, null, 2))
}

function writeTokens(tkns, replace=false) {
    if (!replace) {
        const current = safeCall(() => require(TKN_FILE_PATH), [])
        tkns = [ ...current, ...tkns ]
    }
    writeFileSync(TKN_FILE_PATH, JSON.stringify(tkns, null, 2))
}

function getTknInfo(token) {
    return tokens.find(tkn => tkn.id.toLowerCase() === token.toLowerCase())
}

async function addTkn(token, chainID, provider) {
    const info = await getTokenInfo(token, provider)
    info.id = token
    info.chainID = chainID
    writeTokens([info])
    return info
}

async function getInfoForTokens(tkns, chainID, provider) {
    return Promise.all(tkns.map(async tkn => {
        let info = getTknInfo(tkn)
        if (!info) {
            info = await addTkn(tkn, chainID, provider)
        }
        return info
    }))
}

function genPoolDescription(tkn0, tkn1, dex, chainID) {
    return `${tkn0}|${tkn1}::${dex.toUpperCase()}::${chainID}`
}

async function addAllPools(dex, provider, replace) {
    let pools = await getPoolsFromFactory(dex.factory, provider)
    pools = await Promise.all(pools.map(async pool => {
        const info = await getInfoForTokens(
            [ pool.tkn0, pool.tkn1 ], 
            dex.chainID,
            provider
        )
        const poolDesc = genPoolDescription(
            info[0].symbol, 
            info[1].symbol,
            dex.id,
            dex.chainID
        )
        return {
            chainID: dex.chainID,
            desc: poolDesc,
            dexID: dex.id,
            ...pool,
        }
    }))
    writePools(pools, replace)
}

async function addPool(dex, pool, provider) {
    const tkns = await getPoolTokens(pool, provider)
    const info = await getInfoForTokens(
        tkns, 
        dex.chainID,
        provider
    )
    const poolDesc = genPoolDescription(
        info[0].symbol, 
        info[1].symbol,
        dex.id,
        dex.chainID
    )
    const newPool =  {
        chainID: dex.chainID,
        desc: poolDesc,
        dexID: dex.id,
        tkn0: tkns[0],
        tkn1: tkns[1],
        id: pool, 
    }
    writePools([ newPool ])
}

require('yargs')
    .command(
        'add-single <pool> [dex]', 
        'Add single pool', 
        yargs => yargs
            .option('pool', {
                string: true
            })
            .demandOption(['dex'], 'Please provide dex-id with `--dex` flag')
        , 
        async (argv) => { 
            const dex = dexes.find(dex => dex.id === argv.dex)
            if (!dex) {
                throw new Error(`Unsupported dex: ${argv.dex}`)
            }
            const provider = getRpcProviderByChainID(dex.chainID)
            await addPool(dex, argv.pool, provider) 
        })
    .option('replace', {
        boolean: true
    })
    .command(
        'add-all <dex> [replace]', 
        'Add all pools', 
        yargs => yargs
            .option('replace', {
                boolean: true
            })
        ,  
        async (argv) => { 
            const dex = dexes.find(dex => dex.id === argv.dex)
            if (!dex) {
                throw new Error(`Unsupported dex: ${argv.dex}`)
            }
            const provider = getRpcProviderByChainID(dex.chainID)
            await addAllPools(dex, provider, argv.replace) 
        })
    .help()
    .argv