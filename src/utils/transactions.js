const { getEnvVar, uniqueArray, getEpochNow } = require('./utils')
const { yakrouter } = require('../static/config.json')
const dexesInfo = require('../static/dexes.json')
const { ethers } = require('ethers')

const UNI_ROUTER_ABI = require('../static/abis/uni-router.json')
const YAK_ROUTER_ABI = require('../static/abis/yak-router.json')
const AVAX_CHAIN_ID = getEnvVar('AVAX_CHAIN_ID', true)
const DFK_CHAIN_ID = getEnvVar('DFK_CHAIN_ID', true)
const SUPPORTED_CHAIN_IDS = [
    AVAX_CHAIN_ID, 
    DFK_CHAIN_ID,
]


class TransactionManager {

    constructor(providers, signers) {
        this.supportedChainIDs = SUPPORTED_CHAIN_IDS
        this.signers = signers || this.makeSigners(providers)
        this.unirouters = this.makeUniRouters()
        this.yakrouter = this.makeYakRouter()
        this.locked = false
    }

    makeSigners(providers) {
        const signers = {}
        for (let chainID in providers) {
            signers[chainID] = new ethers.Wallet(
                getEnvVar(`PK_LIVE_${chainID}`),
                providers[chainID]
            )
        }
        return signers
    }

    makeUniRouters() {
        const routers = {}
        dexesInfo.forEach(dex => {
            routers[dex.id] = new ethers.Contract(
                dex.router, 
                UNI_ROUTER_ABI,
                this.signers[dex.chainID]
            )
        })
        return routers
    }

    makeYakRouter() {
        return new ethers.Contract(
            yakrouter, 
            YAK_ROUTER_ABI,
            this.signers[AVAX_CHAIN_ID]
        )
    }

    async executeOpportunity(steps) {
        if (!this.locked) {
            this.locked = true
            steps.forEach(s => this.safetyCheck(s))
            // First estimate-gas to figure out if any of the steps will fail
            const swaps = await Promise.all(steps.map(step => {
                return this.populateExecutionStep(step)
            }))
            const receipts = await Promise.all(swaps.map(swap => {
                return swap().then(r => r.wait(2))
            }))
            this.locked = false
            return receipts
        } else {
            console.log('Skipping opportunity, the tx-manager is locked')
        }
    }

    // Make checks before execution
    safetyCheck(step) {
        if (!this.supportedChainIDs.includes(step.chainID)) {
            throw new Error(`Unsupported chainID: ${step.chainID}`)
        }
        if (
            step.chainID != getEnvVar('AVAX_CHAIN_ID')
            && uniqueArray(step.dexes).length > 1
        ) {
            throw new Error('Multiple dexes not supported the provided chain')
        }
    }

    // Return tx
    async populateExecutionStep(step) {
        switch (step.chainID) {
            case AVAX_CHAIN_ID:
                return this.submitYakTransaction(step)
            case DFK_CHAIN_ID:
                return this.submitDexRouterTransaction(step)
        }
    }

    async submitDexRouterTransaction(step) {
        const routerTimeOffset = 60 // seconds
        const { dexes, amounts, tkns } = step
        const router = this.unirouters[dexes[0]]
        const res = await router.populateTransaction.swapExactTokensForTokens(
            amounts[0], 
            amounts[amounts.length-1],
            tkns, 
            router.signer.address, 
            getEpochNow() + routerTimeOffset, 
            { gasLimit: 300000 }  // TODO: Put into config
        )
        return () => router.signer.sendTransaction(res) 
    }

    async submitYakTransaction(step) {
        const { dexes, amounts, tkns } = step
        const adapters = dexes.map(dex => {
            return dexesInfo.find(d => d.id == dex).yakadapter
        })
        if (!adapters.every(_=>_)) {
            throw new Error('No yakadapter found')
        }
        const res = await this.yakrouter.populateTransaction.swapNoSplit(
            [
                amounts[0],
                amounts[amounts.length-1],
                tkns,
                adapters
            ],
            this.yakrouter.signer.address,
            0,
            { gasLimit: 300000 }  // TODO: Put into config
        )
        return () => this.yakrouter.signer.sendTransaction(res) 
    }

}

module.exports = { TransactionManager } 