const { ethers, utils, BigNumber } = require('ethers')

const { filterPathsByPools } = require('./instructions')
const { logOpportunities } = require('./logging')
const { 
    getOptimalAmountForPath,
    getAmountOutByReserves, 
    getAmountsByReserves,
} = require('./math')

const MIN_AMOUNT_IN = utils.parseUnits('0.1', 18)
const MIN_PROFIT = utils.parseUnits('0.001', 18)

class OppManager {

    constructor(reserveMngr, instrMngr, txMngr, execute=false) {
        this.reserveMngr = reserveMngr
        this.instrMngr = instrMngr
        this.txMngr = txMngr
        this.minProfit = MIN_PROFIT
        this.minAmountIn = MIN_AMOUNT_IN
        this.execute = execute
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
        const arbs = await this.arbsSearch(affectedPaths)
        console.log(events.map(e => e.txhash))
        console.log('arbs:', arbs)
    }

    async arbsSearch(paths) {
        const opps = paths.map(p => this.checkForArb(p)).filter(_=>_)
        if (opps.length > 0) {
            this.handleOpportunities(opps)
        }
    }

    checkForArb(path) {
        const reservePath = this.getReservePath(path)
        const minProfit = getAmountOutByReserves(this.minAmountIn, reservePath)
            .sub(this.minAmountIn)
        if (minProfit.gte(this.minProfit)) {
            // Get optimal-amount-in
            const amountInOptimal = getOptimalAmountForPath(reservePath)
            // Get optimal-amount-out + profit
            const amounts = getAmountsByReserves(
                amountInOptimal, 
                reservePath
            )
            const amountOutOptimal = amounts[amounts.length-1]
            const grossProfit = amountOutOptimal.sub(amountInOptimal)
            if (grossProfit.gt(0)) {
                return {
                    grossProfit: grossProfit, 
                    amounts: amounts,
                    path
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

    async handleOpportunities(opps) {
        const [ bestOpp ] = opps.sort((a, b) => b.grossProfit - a.grossProfit)
        if (this.execute) {
            const steps = this.getStepsFromOpportunity(bestOpp)
            const res = await this.txMngr.executeOpportunity(steps)
            console.log(res)
        } else {
            logOpportunities(opps)
            console.log(bestOpp)
        }
    }

    getStepsFromOpportunity(opportunity) {
        const steps = []
        const amounts = [ ...opportunity.amounts ]
        opportunity.path.steps.forEach(step => {
            const dexes = step.pools.map(pool => {
                return this.instrMngr.getPoolInfo(pool).dexID
            })
            steps.push({
                amounts: amounts.slice(0, step.tkns.length),
                chainID: step.chainID,
                pools: step.pools,
                tkns: step.tkns,
                dexes: dexes,
            })
            amounts.splice(0, step.tkns.length - 1) // Repeat intermediary amounts
        })
        return steps
    }

}

module.exports = { OppManager }