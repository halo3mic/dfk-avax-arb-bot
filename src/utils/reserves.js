const ethers = require('ethers')

const { getPoolsForPaths } = require('./instructions')
const { normalizeUnits } = require('./utils')

// TODO: Methods need optimization!

class ReserveManager {

    constructor(providerOptions, instrMngr) {
        this.providers = providerOptions
        this.instrMngr = instrMngr
    }

    async setInitialReserves(selectedPaths, blockNumbers) {
        this.reserves = await this.fetchReservesForPaths(
            selectedPaths, 
            blockNumbers
        )
    }

    async fetchReserves(pool, blockNumbers) {
        const reservesRaw = await this.fetchReservesRaw(pool, blockNumbers)
        return this.formatReservesFromRaw(pool, reservesRaw)  
    }

    /**
     * Fetch and return reserves for paths
     * First prepare data so that no reserve will overlap or be left out
     * @param {Array} paths
     * @returns {Object}
     */
     async fetchReservesForPaths(paths, blockNumbers) {
        return Promise.all(
            getPoolsForPaths(paths).map(async pool => {
                let r
                try {
                    r = await this.fetchReserves(pool, blockNumbers)
                } catch (e) {
                    console.log(e)
                    r = [0, 0]
                    console.log(`Failed to fetch reserves for pool ${pool}`)
                }
                return [pool, r]
            })
        ).then(Object.fromEntries)
    }

    formatReservesFromRaw(pool, reservesRaw) {
        const { tkn0:t1, tkn1:t2 } = this.instrMngr.getPoolInfo(pool)
        const r0 = ethers.BigNumber.from(reservesRaw.substr(0, 66))
        const r1 = ethers.BigNumber.from('0x' + reservesRaw.substr(66, 64))
        const d0 = this.instrMngr.getTokenInfo(t1).decimals
        const d1 = this.instrMngr.getTokenInfo(t2).decimals
        return [ normalizeUnits(r0, d0), normalizeUnits(r1, d1) ]
    }

    async fetchReservesRaw(pool, blockNumbers) {
        const { chainID } = this.instrMngr.getPoolInfo(pool)
        const blockNumber = blockNumbers ? `0x${blockNumbers[chainID].toString(16)}` : 'latest'
        const provider = this.providers[chainID]
        return provider.call({ to: pool, data: '0x0902f1ac' }, blockNumber)
    }

    /**
     * Update reserves from Sync logs
     * @param {String} poolAddress
     * @param {String} reservesRaw
     */
    updateReserves(pool, reservesRaw) {
        this.reserves[pool] = this.formatReservesFromRaw(pool, reservesRaw)
    }

    /**
     * Get reserves for specific pools
     * @param {Array[String]} pools
     * @returns {Object}
     */
    getReserves(pools) {
        return Object.fromEntries(pools.map(p=>[p, this.reserves[p]]))
    }

    getReserve(pool) {
        return this.reserves[pool]
    }

}

module.exports = { ReserveManager }
