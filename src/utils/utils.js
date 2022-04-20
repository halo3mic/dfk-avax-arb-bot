const { utils } = require('ethers')

module.exports.getEnvVar = (_key, _isInt=false) => {
    const envVar = process.env[_key]
    if (!envVar) {
        throw new Error(`Environment variable ${_key} not set`)
    }
    return _isInt ? parseInt(envVar) : envVar
}

/**
 * Return normalized number
 * Convert number with any decimals to 18 units
 * @param {ethers.BigNumber} num Amount
 * @param {ethers.BigNumber} dec Token decimals
 * @returns {ethers.BigNumber}
 */
module.exports.normalizeUnits = (num, dec) => {
    // Convert everything to 18 units
    return utils.parseUnits(
        utils.formatUnits(num, dec)
    )
}

/**
 * Return unnormalized number
 * Convert number from 18 units to unique decimals
 * @param {BigNumber} num Amount
 * @param {Number} dec Token decimals
 * @returns {BigNumber}
 */
module.exports.unnormalizeUnits = (num, dec) => {
    return utils.parseUnits(
        utils.formatUnits(num), 
        dec
    )
}

module.exports.uniqueArray = (arr) => {
    return arr.filter((item, index) => arr.indexOf(item) === index)
}

module.exports.getEpochNow = () => {
    return Math.floor(Date.now() / 1000)
}

// sleep
module.exports.sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms))
}

module.exports.tryCatchSleepRepeat = async (promise, ms, maxTries) => {
    for (let i=0; i < maxTries; i++) {
        try {
            return await promise
        } catch {
            await module.exports.sleep(ms)
        }
    }
    throw new Error(`tryCatchSleepRepeat: max-tries reached`)
}