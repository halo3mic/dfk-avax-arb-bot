const { tryCatchSleepRepeat } = require('./utils/utils')

class Listener {

    constructor(providers) {
        this.chainIDs = Object.keys(providers)
        this.providers = providers
        this.triggers = Object.fromEntries(
            this.chainIDs.map(chainID => [chainID, []])
        )
        this.heads = {}
    }

    // filter.topic
    // filter.addresses
    addTrigger(chainID, filter, handler) {
        this.triggers[chainID].push([filter, handler])
    }

    listenForUpdates() {
        this.chainIDs.forEach(chainID => {
            const provider = this.providers[chainID]
            provider.on('block', async block => {
                if (!this.heads[chainID] || this.heads[chainID] < block) {
                    console.log(`block ${block} on chain ${chainID}`)
                    this.heads['avax'] = block
                    this.triggers[chainID].forEach(async trigger => {
                        const [ filter, handler ] = trigger
                        const logFilter = { 
                            topics: filter.topics,
                            fromBlock: block, 
                            toBlock: block
                        }
                        // TODO: Join topics and do single call for all triggers
                        const logs = await tryCatchSleepRepeat(
                            provider.getLogs(logFilter), 
                            500,  // ms of sleep
                            100  // max-tries
                        )
                        const events = logs.flatMap(log => {
                            if (filter.addresses.includes(log.address.toLowerCase())) {
                                return [{ 
                                    txhash: log.transactionHash,
                                    address: log.address,
                                    topics: log.topics,
                                    data: log.data 
                                }]
                            } else {
                                return []
                            }
                        })
                        if (events.length) {
                            handler(events)
                        }
                    })
                }
            })
        })
    }
}


module.exports = { Listener }
