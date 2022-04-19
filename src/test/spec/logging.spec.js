

const { logOpportunities } = require('../../utils/logging')
const { resolve } = require('path')
const { utils } = require('ethers')
const { expect } = require('chai')
const fs = require('fs')


describe('logging', () => {

    describe('opportunities', () => {

        const OPPS_PATH = resolve(__dirname, './logs.json')

        before(() => {
            if (fs.existsSync(OPPS_PATH)) {
                fs.rmSync(OPPS_PATH)
            }
        })

        after(() => {
            fs.rmSync(OPPS_PATH)
        })

        it('logs are saved', () => {
            const opps = [{
                    grossProfit: utils.parseUnits('334.21'),
                    amounts: [
                        utils.parseUnits('341.233'),
                        utils.parseUnits('1.2311'), 
                    ],
                    path: require('../../static/instructions/paths.json')[0]
                },
                {
                    grossProfit: utils.parseUnits('2.9'),
                    amounts: [
                        utils.parseUnits('910.3'),
                        utils.parseUnits('0.011'), 
                    ],
                    path: require('../../static/instructions/paths.json')[1]
                }
            ]
            logOpportunities(opps, OPPS_PATH)

            expect(fs.existsSync(OPPS_PATH)).to.be.true
            const savedLogs = require(OPPS_PATH)
            for (let i = 0; i < opps.length; i++) {
                expect(savedLogs[i].gross_profit)
                    .to.eq(utils.formatUnits(opps[i].grossProfit))
                expect(savedLogs[i].path_desc).to
                    .eq(opps[i].path.desc)
                expect(savedLogs[i].path_id)
                    .to.eq(opps[i].path.id)
                expect(savedLogs[i].amounts)
                    .to.deep.eq(opps[i].amounts.map(a => utils.formatUnits(a)))
                expect(savedLogs[i]).to.have.property('timestamp').a('number')
            }
    
        })

    })


})