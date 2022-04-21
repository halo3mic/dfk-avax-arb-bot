
const { BigNumber } = require('ethers')
const { resolve } = require('path')
const { normalizeUnits } = require('./utils')

const TKNS_PATH = resolve(__dirname, '../static/instructions/tokens.json')

class InventoryManager {

    // TODO: holders should be an array of addresses
    // TODO: chainID is not needed
    constructor(providerOptions, holders, tokens) {
        this.providers = providerOptions
        this.holders = holders
        this.tokens = tokens || this.getSupportedTokens()
        // Create balances object
        this.balances = {}
        Object.keys(this.holders).forEach(chainID => {
            this.balances[chainID] = {}
        })
    }

    async setInitialBals() {
        await this.updateBalances()
    }

    getSupportedTokens() {
        return require(TKNS_PATH)
    }

    // Fetch balances for all holders
    async updateBalances(blockNumbers=null) {
        return Promise.all(Object.keys(this.holders).map(async chainID => {
            // Get tokens that are associated with this chain
            const tokens = this.tokens.filter(tkn => tkn.chainID == chainID)
            // Get bals for each holder for chainID
            return Promise.all(this.holders[chainID].map(async holder => {
                const holderL = holder.toLowerCase()
                this.balances[chainID][holderL] = await this.fetchTknBalancesForHolder(
                    holder,
                    tokens,
                    blockNumbers
                )
            }))
        }))
    }

    async fetchTknBalancesForHolder(holder, tokens, blockNumbers) {
        return Promise.all(
            tokens.map(async tkn => {
                let r
                try {
                    r = await this.fetchBalForToken(holder, tkn, blockNumbers)
                } catch (e) {
                    console.log(e)
                    console.log(`Failed to fetch tkn-bal for holder ${holder}`)
                    return [tkn.id, 0]
                }
                return [tkn.id.toLowerCase(), r]
            })
        ).then(Object.fromEntries)
    }

    async fetchBalForToken(holder, tkn, blockNumbers) {
        const balRaw = await this.fetchBalRaw(holder, tkn, blockNumbers)
        return normalizeUnits(BigNumber.from(balRaw), tkn.decimals) // To 18 dec
    }

    async fetchBalRaw(holder, tkn, blockNumbers) {
        const { chainID, id } = tkn
        const blockNumber = blockNumbers ? `0x${blockNumbers[chainID].toString(16)}` : 'latest'
        const provider = this.providers[chainID]
        const data = `0x70a08231${holder.slice(2).padStart(64, '0')}`
        return provider.call({ to: id, data }, blockNumber)
    }

    // Update balance for holder when Transfer event associated with them is emitted
    async updateBalanceFromTransfer(holder, tknAddress) {
        const tkn = this.tokens.find(tkn => {
            return tkn.id.toLowerCase() == tknAddress.toLowerCase()
        })
        const tknIDL = tkn.id.toLowerCase()
        const holderL = holder.toLowerCase()
        this.balances[tkn.chainID][holderL][tknIDL] = await this.fetchBalForToken(
            holder,
            tkn, 
        )
    }

    async balanceUpdateHandler(events) {
        // Get unique addresses of holders that were associated with events
        const holdersL = Object.values(this.holders)
            .flatMap(h => h.map(h => h.toLowerCase()))
        const holderToTknChange = Object.fromEntries(holdersL.map(h => [h, []]))
        events.forEach(e => {
            const sender = '0x' + e.topics[1].slice(26)
            const receiver = '0x' + e.topics[2].slice(26)
            if (
                holdersL.includes(sender) 
                && !holderToTknChange[sender].includes(e.address)
            ) {
                holderToTknChange[sender].push(e.address)
            }
            if (
                holdersL.includes(receiver) 
                && !holderToTknChange[receiver].includes(e.address)
            ) {
                holderToTknChange[receiver].push(e.address)
            }
        })
        // Update balances for each holder
        await Promise.all(
            Object.entries(holderToTknChange).map(async ([holder, tkns]) => {
                await Promise.all(tkns.map(tkn => {
                    return this.updateBalanceFromTransfer(holder, tkn)
                }))
            })
        )

    }

    getTknBalForHolder(holder, token) {
        const { chainID, id } = this.tokens.find(tkn => {
            return tkn.id.toLowerCase() == token.toLowerCase()
        })
        const holderL = holder.toLowerCase()
        const tknIDL = id.toLowerCase()
        return this.balances[chainID][holderL][tknIDL]
    }

}

module.exports = { InventoryManager }