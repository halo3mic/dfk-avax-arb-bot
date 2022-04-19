const { formatUnits } = require('ethers').utils
const { resolve } = require('path')
const fs = require('fs')

const { getEpochNow } = require('./utils')

const OPPS_PATH = resolve(__dirname, '../../logs/logs.json')

function logOpportunities(opps, logPath) {

    function getLogForOpp(opp) {
        const log = {}
        log['timestamp'] = getEpochNow()
        log['gross_profit'] = formatUnits(opp.grossProfit)
        log['path_desc'] = opp.path.desc
        log['path_id'] = opp.path.id
        log['amounts'] = opp.amounts.map(a => formatUnits(a))
        return log
    }

    logPath = logPath || OPPS_PATH
    let logs = fs.existsSync(logPath) ? require(logPath) : []
    logs = [ ...logs, ...opps.map(getLogForOpp) ]
    fs.writeFileSync(logPath, JSON.stringify(logs, null, 2))
}

module.exports = {
    logOpportunities
}