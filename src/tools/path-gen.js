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

function generatePath(parts) {
    const steps = parts.map(step => {
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
    const partsPaths = strategy.map(s => findPaths(pools, s.tknIn, s.tknOut))

    function getPaths(partsPath, pointer) {
        if (pointer == partsPaths.length)
            return generatePath(partsPath)
        return partsPaths[pointer]
            .map(p => getPaths([...partsPath, p], pointer+1))
            .flat()
    }

    return getPaths([], 0)
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
    /** <<<< USE WAVAX, USDC as intermediary tokens >>> **/

    // (WAVAX => [X] => USDC)[avax] & (USDC => [X] => WAVAX)[dfk]
    startegyPaths.push(generatePathsForStrategy([
        { tknIn: tkns.avax.WAVAX, tknOut: tkns.avax.USDC },
        { tknIn: tkns.dfk.USDC, tknOut: tkns.dfk.WAVAX },
    ]))
    // (WAVAX => [X] => USDC)[dfk] & (USDC => [X] => WAVAX)[avax]
    startegyPaths.push(generatePathsForStrategy([
        { tknIn: tkns.dfk.WAVAX, tknOut: tkns.dfk.USDC },
        { tknIn: tkns.avax.USDC, tknOut: tkns.avax.WAVAX },
    ]))
    // (USDC => [X] => AVAX)[dfk] & (AVAX => [X] => USDC)[avax]
    startegyPaths.push(generatePathsForStrategy([
        { tknIn: tkns.dfk.USDC, tknOut: tkns.dfk.WAVAX },
        { tknIn: tkns.avax.WAVAX, tknOut: tkns.avax.USDC },
    ]))
    // (USDC => [X] => AVAX)[avax] & (AVAX => [X] => USDC)[dfk]
    startegyPaths.push(generatePathsForStrategy([
        { tknIn: tkns.avax.USDC, tknOut: tkns.avax.WAVAX },
        { tknIn: tkns.dfk.WAVAX, tknOut: tkns.dfk.USDC },
    ]))

    /** <<<< USE JEWEL as intermediary tokens >>> **/

    // (WAVAX => JEWEL)[avax] & (WJEWEL => WAVAX)[dfk]
    startegyPaths.push(generatePathsForStrategy([
        { tknIn: tkns.avax.WAVAX, tknOut: tkns.avax.WJEWEL },
        { tknIn: tkns.dfk.WJEWEL, tknOut: tkns.dfk.WAVAX },
    ]))
    // (WAVAX => JEWEL)[dfk] & (WJEWEL => WAVAX)[avax]
    startegyPaths.push(generatePathsForStrategy([
        { tknIn: tkns.dfk.WAVAX, tknOut: tkns.dfk.WJEWEL },
        { tknIn: tkns.avax.WJEWEL, tknOut: tkns.avax.WAVAX },
    ]))

    /** <<<< USE JEWEL as starting token >>> **/

    // (WJEWEL => WAVAX)[avax] & (WAVAX => WJEWEL)[dfk]
    startegyPaths.push(generatePathsForStrategy([
        { tknIn: tkns.avax.WJEWEL, tknOut: tkns.avax.WAVAX },
        { tknIn: tkns.dfk.WAVAX, tknOut: tkns.dfk.WJEWEL },
    ]))
    // (WJEWEL => WAVAX)[dfk] & (WAVAX => WJEWEL)[avax]
    startegyPaths.push(generatePathsForStrategy([
        { tknIn: tkns.dfk.WJEWEL, tknOut: tkns.dfk.WAVAX },
        { tknIn: tkns.avax.WAVAX, tknOut: tkns.avax.WJEWEL },
    ]))
    // (WJEWEL => USDC)[avax] & (USDC => WJEWEL)[dfk]
    startegyPaths.push(generatePathsForStrategy([
        { tknIn: tkns.avax.WJEWEL, tknOut: tkns.avax.USDC },
        { tknIn: tkns.dfk.USDC, tknOut: tkns.dfk.WJEWEL },
    ]))
    // (WJEWEL => WAVAX)[dfk] & (WAVAX => WJEWEL)[avax]
    startegyPaths.push(generatePathsForStrategy([
        { tknIn: tkns.dfk.WJEWEL, tknOut: tkns.dfk.USDC },
        { tknIn: tkns.avax.USDC, tknOut: tkns.avax.WJEWEL },
    ]))

    // <<<< DFK internal arbs

    // (WJEWEL => WJEWEL)[dfk]
    startegyPaths.push(generatePathsForStrategy([
        { tknIn: tkns.dfk.WJEWEL, tknOut: tkns.dfk.WJEWEL },
    ]))
    // (WAVAX => WAVAX)[dfk]
    startegyPaths.push(generatePathsForStrategy([
        { tknIn: tkns.dfk.WAVAX, tknOut: tkns.dfk.WAVAX },
    ]))
    // (USDC => USDC)[dfk]
    startegyPaths.push(generatePathsForStrategy([
        { tknIn: tkns.dfk.USDC, tknOut: tkns.dfk.USDC },
    ]))

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