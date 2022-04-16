const { formatUnits } = require('ethers').utils
const { resolve } = require('path')
const fs = require('fs')

const { getEpochNow, uniqueArray } = require('./utils')

const OPPS_PATH = resolve(__dirname, '../../logs/logs.json')

function logOpportunities(opps) {

    function getLogForOpp(opp) {
        const log = {}
        log['timestamp'] = getEpochNow()
        log['gross_profit'] = formatUnits(opp.grossProfit)
        log['path_desc'] = opp.path.desc
        log['path_id'] = opp.path.id
        log['amounts'] = opp.amounts.map(a => formatUnits(a))
        // log['token_path'] = uniqueArray(opp.path.steps.map(s => s.tkns).flat())

        return log
    }

    let logs = fs.existsSync(OPPS_PATH) ? require(OPPS_PATH) : []
    logs = [ ...logs, ...opps.map(getLogForOpp) ]
    fs.writeFileSync(OPPS_PATH, JSON.stringify(logs, null, 2))
}

module.exports = {
    logOpportunities
}