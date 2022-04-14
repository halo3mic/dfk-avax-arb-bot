// Generate paths 
const { writeFileSync } = require('fs')
const { resolve } = require('path')
const { utils } = require('ethers');

const pools = require(resolve(__dirname, '../static/instructions/pools.json'))
const tokens = require(resolve(__dirname, '../static/instructions/tokens.json'))
const PATH_FILE_PATH = resolve(__dirname, '../static/instructions/paths.json')

function getPool(id) {
    return pools.find(pool => pool.id.toLowerCase() == id.toLowerCase())
}

function getToken(id) {
    return tokens.find(tokens => tokens.id.toLowerCase() == id.toLowerCase())
}

function writePaths(paths) {
    writeFileSync(PATH_FILE_PATH, JSON.stringify(paths, null, 2))
}

function findPaths(
        pairs, 
        tokenIn, 
        tokenOut, 
        maxHops=4, 
        currentPairs=[], 
        path=[], 
        circles=[]
    ) {
        for (let i=0; i<pairs.length; i++) {
            const newPath = path.length>0 ? [...path] : [tokenIn]
            const pair = pairs[i]
            const tempOut = (tokenIn==pair.tkn0) ? pair.tkn1 : pair.tkn0
            if (tokenIn!=pair.tkn0 && tokenIn!=pair.tkn1)
                continue
            newPath.push(tempOut)
            if (tokenOut==tempOut) {
                circles.push({'pools': [...currentPairs, pair.id], 'tkns': newPath})
            } else if (maxHops > 1 && pairs.length > 1) {
                circles = findPaths(
                    [...pairs.slice(0,i), ...pairs.slice(i+1)], 
                    tempOut, 
                    tokenOut,
                    maxHops-1, 
                    [...currentPairs, pair.id], 
                    newPath, 
                    circles
                )
            }
        }
        return circles
}

function generatePath(p0, p1) {
    const steps = [p0, p1].map(step => {
        const chainIDs = step.pools.map(pool => getPool(pool).chainID)
        if (!chainIDs.every(chainID => chainID == chainIDs[0])) {
            throw new Error('All pools must be on the same chain')
        }
        return {
            chainID: chainIDs[0],
            ...step
        }
    })
    const desc = steps.map(step => step.pools.map(pool => getPool(pool).desc))
        .flat()
        .join(' => ')
    const id = utils.id(desc).slice(0,43)  // keccak256 hash of description
    return { id, desc, steps }
}

function generatePathsForStrategy(strategy) {
    const part0Options = findPaths(pools, strategy[0].tknIn, strategy[0].tknOut)
    const part1Options = findPaths(pools, strategy[1].tknIn, strategy[1].tknOut)
    const paths = []
    part0Options.forEach(part0 => {
        part1Options.forEach(part1 => {
            const path = generatePath(part0, part1)
            paths.push(path)
        })
    })
    return paths
}

function generatePaths() {
    const tkns = {
        avax: {
            'WAVAX': '0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7',
            'USDC': '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e',
            'WJEWEL': '0x4f60a160d8c2dddaafe16fcc57566db84d674bd6',
        },
        dfk: {
            'WAVAX': '0xb57b60debdb0b8172bb6316a9164bd3c695f133a',
            'USDC': '0x3ad9dfe640e1a9cc1d9b0948620820d975c3803a',
            'WJEWEL': '0xccb93dabd71c8dad03fc4ce5559dc3d89f67a260',
        }
    }
    const startegyPaths = []
    // (WAVAX => [X] => USDC)[avax] & (USDC => [X] => WAVAX)[dfk]
    startegyPaths[0] = generatePathsForStrategy([
        { tknIn: tkns.avax.WAVAX, tknOut: tkns.avax.USDC },
        { tknIn: tkns.dfk.USDC, tknOut: tkns.dfk.WAVAX },
    ])
    // (WAVAX => [X] => USDC)[dfk] & (USDC => [X] => WAVAX)[avax]
    startegyPaths[1] = generatePathsForStrategy([
        { tknIn: tkns.dfk.WAVAX, tknOut: tkns.dfk.USDC },
        { tknIn: tkns.avax.USDC, tknOut: tkns.avax.WAVAX },
    ])
    // (USDC => [X] => AVAX)[dfk] & (AVAX => [X] => USDC)[avax]
    startegyPaths[2] = generatePathsForStrategy([
        { tknIn: tkns.dfk.USDC, tknOut: tkns.dfk.WAVAX },
        { tknIn: tkns.avax.WAVAX, tknOut: tkns.avax.USDC },
    ])
    // (USDC => [X] => AVAX)[avax] & (AVAX => [X] => USDC)[dfk]
    startegyPaths[3] = generatePathsForStrategy([
        { tknIn: tkns.avax.USDC, tknOut: tkns.avax.WAVAX },
        { tknIn: tkns.dfk.WAVAX, tknOut: tkns.dfk.USDC },
    ])
    // ...
    startegyPaths[4] = generatePathsForStrategy([
        { tknIn: tkns.avax.WAVAX, tknOut: tkns.avax.WJEWEL },
        { tknIn: tkns.dfk.WJEWEL, tknOut: tkns.dfk.WAVAX },
    ])


    return startegyPaths.flat()
}


require('yargs')
    .command(
        'gen-paths [w]', 
        'Generate paths from avl pools', 
        yargs => yargs.option('w', { boolean: true }), 
        async (argv) => { 
            const paths = generatePaths()
            if (argv.w) {
                writePaths(paths)
            } else {
                console.log(JSON.stringify(paths, null, 2))
            }
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