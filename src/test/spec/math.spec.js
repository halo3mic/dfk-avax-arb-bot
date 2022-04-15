const {
    getOptimalAmountForPath, 
    getAmountOutByReserves,
    getAmountsByReserves,
    getAmountOut, 
} = require('../../utils/math.js');
const { describe, it } = require('mocha');
const { BigNumber } = require('ethers');
const { expect } = require('chai')

describe('uni-math', () => {

    it('getAmountOut', () => {
        const amountIn = BigNumber.from(10)
        const reserveIn = BigNumber.from(10000)
        const reserveOut = BigNumber.from(10000)
        const amountOut = getAmountOut(amountIn, reserveIn, reserveOut)
        console.log(amountOut.toNumber())
    })

    it('getAmountsByReserves', () => {
        const amountIn = BigNumber.from(10)
        // P0: 1/3 & P1: 1/2
        const reservePath = [
            BigNumber.from(10000),
            BigNumber.from(30000),
            BigNumber.from(20000),
            BigNumber.from(10000),
        ]
        const amountsOut = getAmountsByReserves(amountIn, reservePath)
        console.log(amountsOut.map(a => a.toNumber()))
    })

    it('getAmountOutByReserves', () => {
        const amountIn = BigNumber.from(10)
        // P0: 1/3 & P1: 1/2
        const reservePath = [
            BigNumber.from(1e6),
            BigNumber.from(3e6),
            BigNumber.from(2e6),
            BigNumber.from(1e6),
        ]
        const amountOut = getAmountOutByReserves(amountIn, reservePath)
        console.log(amountOut.toNumber())
    })

    it('getOptimalAmountForPath', () => {
        // P0: 1/3 & P1: 1/2
        const reservePath = [
            BigNumber.from(1e6),
            BigNumber.from(3e6),
            BigNumber.from(2e6),
            BigNumber.from(1e6),
        ]
        const optimalAmountIn = getOptimalAmountForPath(reservePath)
        const optimalAmountOut = getAmountOutByReserves(optimalAmountIn, reservePath)
        const optimalProfit = optimalAmountOut.sub(optimalAmountIn)
        // Expect over-optimal amountIn gives you worse price than optimalAmountOut
        const overOptimalAmountIn = optimalAmountIn.add(100)
        const overOptimalAmountOut = getAmountOutByReserves(overOptimalAmountIn, reservePath)
        const overOptimalProfit = overOptimalAmountOut.sub(overOptimalAmountIn)
        expect(optimalProfit).gt(overOptimalProfit)
        // Expect sub-optimal amountIn gives you worse price than optimalAmountOut
        const subOptimalAmountIn = optimalAmountIn.sub(100)
        const subOptimalAmountOut = getAmountOutByReserves(subOptimalAmountIn, reservePath)
        const subOptimalProfit = subOptimalAmountOut.sub(subOptimalAmountIn)
        expect(optimalProfit).gt(subOptimalProfit)
        
        console.log(optimalAmountIn.toNumber())
        console.log(optimalAmountOut.toNumber())
        console.log(optimalProfit.toNumber())
    })


})

