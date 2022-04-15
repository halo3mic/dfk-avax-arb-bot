const { resolve } = require('path')
const fs = require('fs')

const LOGS_PATH = resolve(__dirname, '../../logs')

function logOpportunity(opp) {
    const logs = fs.existsSync(path) ? require(LOGS_PATH) : []
    logs.push(opp)
    fs.writeFileSync(LOGS_PATH, JSON.stringify(logs, null, 2))
}

module.exports = {
    logOpportunity
}