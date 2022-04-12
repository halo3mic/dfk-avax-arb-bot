const { ethers, utils, BigNumber } = require('ethers')

const { filterPathsByPools } = require('./utils/instructions')
const { getAmountOutByReserves, getOptimalAmountForPath } = require('./utils/math')

const MIN_AMOUNT_IN = BigNumber.from('10000000000')

class ArbManager {

    constructor(reserveMngr, instrMngr) {
        this.reserveMngr = reserveMngr
        this.instrMngr = instrMngr
    }
 
    // event.address - event emitter
    // event.data - data from event
    async reserveUpdateHandler(events) {
        // Update reserves
        const affectedPools = new Set()
        events.forEach(event => {
            this.reserveMngr.updateReserves(event.address, event.data)
            affectedPools.add(event.address)
        })
        const affectedPaths = filterPathsByPools(
            this.instrMngr.paths, 
            [...affectedPools]
        )
        // Check for arb opp among changed pools
        await this.arbsSearch(affectedPaths)
    }

    async arbsSearch(paths) {
        const arbs = paths.map(p => this.checkForArb(p)).filter(_=>_)
        console.log(arbs)
    }

    checkForArb(path) {
        const reservePath = this.getReservePath(path)
        // console.log(path.desc)
        // console.log(reservePath)
        // console.log(utils.formatUnits(getAmountOutByReserves(utils.parseUnits('1', 'ether'), reservePath)))
        if (getAmountOutByReserves(MIN_AMOUNT_IN, reservePath).sub(MIN_AMOUNT_IN).gt(0)) {
            // Get optimal-amount-in
            const amountInOptimal = getOptimalAmountForPath(reservePath)
            console.log(utils.formatUnits(amountInOptimal))
            // Get optimal-amount-out + profit
            const amountOutOptimal = getAmountOutByReserves(
                amountInOptimal, 
                reservePath
            )
            const grossProfit = amountOutOptimal.sub(amountInOptimal)
            if (grossProfit.gt(0)) {
                return {
                    amountIn: amountInOptimal,
                    grossProfit: grossProfit, 
                    path: path.desc,
                }
            }
        }
    }

    getReservePath(path) {
        const reservePath = []
        for (let step of path.steps) {
            for (let i=0; i<step.pools.length; i++) {
                // If exists choose virtual reserve (hypothetical change)
                let Rs = this.reserveMngr.getReserve(step.pools[i])
                const [ Ri, Ro ] = step.tkns[i] < step.tkns[i+1] 
                    ? [Rs[0], Rs[1]] 
                    : [Rs[1], Rs[0]]
                reservePath.push(Ri)
                reservePath.push(Ro)
            }
        }
        return reservePath
    }

}

module.exports = { ArbManager }