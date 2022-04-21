const { ethers, utils, BigNumber } = require('ethers')

const { filterPathsByPools } = require('./instructions')
const { logOpportunities } = require('./logging')
const { 
    getOptimalAmountForPath,
    getAmountOutByReserves, 
    getAmountsByReserves,
} = require('./math')

const MIN_AMOUNT_IN = utils.parseUnits('0.01', 18)
const MIN_PROFIT = utils.parseUnits('0', 18)
const THRESHOLDS = {
    '0xccb93dabd71c8dad03fc4ce5559dc3d89f67a260': utils.parseUnits('500', 18),
}

class OppManager {

    constructor(
        reserveMngr, 
        instrMngr, 
        txMngr, 
        inventoryMngr,
        execute=false
    ) {
        this.inventoryMngr = inventoryMngr
        this.reserveMngr = reserveMngr
        this.instrMngr = instrMngr
        this.txMngr = txMngr
        this.minAmountIn = MIN_AMOUNT_IN
        this.minProfit = MIN_PROFIT
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
        await this.arbsSearch(affectedPaths)
        console.log(events.map(e => e.txhash))    
    }

    // Return max-token-amountIn for each step
    getMaxInForPath(path) {
        return path.steps.map(step => {
            const [ tknIn ] = step.tkns
            const { chainID } = this.instrMngr.getTokenInfo(tknIn)
            const holder = this.txMngr.signers[chainID].address
            const tknBal = this.inventoryMngr.getTknBalForHolder(holder, tknIn)
            return tknBal
        })
    }

    // Return max-token-amountOut for a steo
    getMaxOutForStep(step) {
        const tknOut = step.tkns[step.tkns.length-1]
        const { chainID } = this.instrMngr.getTokenInfo(tknOut)
        const holder = this.txMngr.signers[chainID].address
        const tknBal = this.inventoryMngr.getTknBalForHolder(holder, tknOut)
        const maxTknBal = THRESHOLDS[tknOut]
        if (maxTknBal) {
            return maxTknBal.gte(tknBal)
                ? maxTknBal.sub(tknBal)
                : BigNumber.from(0)
        }
    }

    async arbsSearch(paths) {
        const opps = paths.map(p => this.checkForArb(p)).filter(_=>_)
        if (opps.length > 0) {
            this.handleOpportunities(opps)
        }
    }

    validAmounts(steps, maxAmountsIn) {
        for (let i=0; i < steps.length; i++) {
            if (steps[i].amounts[0].gt(maxAmountsIn[i])) {
                console.log('Invalid amounts in')
                return false
            }
            const stepTknCount = steps[i].amounts.length
            const stepAmountOut = steps[i].amounts[stepTknCount-1]
            const maxAmountOutForTkn = this.getMaxOutForStep(steps[i])
            if (maxAmountOutForTkn && stepAmountOut.gt(maxAmountOutForTkn)) {
                console.log('Invalid amounts out')
                return false
            }
        }
        return true
    }

    checkForArb(path) {
        const reservePath = this.getReservePath(path)
        const minProfit = getAmountOutByReserves(this.minAmountIn, reservePath)
            .sub(this.minAmountIn)
        if (minProfit.gte(this.minProfit)) {
            // Get optimal-amount-in
            const amountInOptimal = getOptimalAmountForPath(reservePath)
            const maxAmountsIn = this.getMaxInForPath(path)
            const amountIn = maxAmountsIn[0].lte(amountInOptimal)
                ? maxAmountsIn[0]
                : amountInOptimal
            if (amountIn.lt(this.minAmountIn)) {
                return
            }
            // Get amounts for trade
            const amounts = getAmountsByReserves(amountIn, reservePath)

            // Make steps 
            const steps = this.makeSteps(path, amounts)
            if (this.execute && !this.validAmounts(steps, maxAmountsIn)) {
                return
            }
            const grossProfit = amounts[amounts.length-1].sub(amountIn)
            console.log(amounts)
            console.log(utils.formatUnits(grossProfit))
            if (grossProfit.gt(0)) {
                return {
                    grossProfit: grossProfit, 
                    steps, 
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
            const res = await this.txMngr.executeOpportunity(bestOpp.steps)
            console.log(res)
        } else {
            logOpportunities(opps)
            console.log(bestOpp)
        }
    }

    makeSteps(path, _amounts) {
        const steps = []
        const amounts = [ ..._amounts ]
        path.steps.forEach(step => {
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