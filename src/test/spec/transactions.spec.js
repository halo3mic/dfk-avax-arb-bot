const { solidity } = require('ethereum-waffle');
const { utils, ethers } = require('ethers');
const { describe, it } = require('mocha');
const chai = require('chai')

const { getAvaxRpcProvider, getDfkRpcProvider } = require('../../utils/providers');
const { TransactionManager } = require('../../utils/transactions')
const { yakrouter } = require('../../static/config.json')
const dexes = require('../../static/dexes.json');

chai.use(solidity)
const { expect } = chai;
const { parseUnits } = utils;

describe('transactions', async () => {

    let txMngr
    let traderAvax
    let traderDfk

    before(() => {
        // Dummy PKs
        traderAvax = new ethers.Wallet.createRandom()
        traderDfk = new ethers.Wallet.createRandom()
        process.env['PK_LIVE_43114'] = traderAvax.privateKey
        process.env['PK_LIVE_53935'] = traderDfk.privateKey

        const providers = {
            43114: getAvaxRpcProvider(),
            53935: getDfkRpcProvider(),
        }
        txMngr = new TransactionManager(providers)
    })
    describe('init', () => {
        
        it('signers are intialized', () => {
            expect(txMngr.signers[43114].address).to.equal(traderAvax.address)
            expect(txMngr.signers[53935].address).to.equal(traderDfk.address)
        })
        it('routers are intialized', () => {
            expect(dexes).is.not.empty
            dexes.forEach(dex => {
                expect(txMngr.unirouters[dex.id]).to.exist
                expect(txMngr.unirouters[dex.id].address).to.equal(dex.router)
            })
        })

        it('yakrouter is initialized', () => {
            expect(txMngr.yakrouter).to.exist
            expect(txMngr.yakrouter.address).to.equal(yakrouter)
        })

    })

    describe('safetyCheck', () => {
        
        it('reject if not supported chain', () => {
            expect(() => txMngr.safetyCheck({ chainID: '123' }))
                .to.throw('Unsupported chainID: 123')
        })

        it('reject if different dexes for non AVAX chain', () => {
            expect(() => {
                txMngr.safetyCheck({
                    dexes: ['0x123', '0x456'],
                    chainID: 53935,
                })
            }).to.throw('Multiple dexes not supported the provided chain')
        })

    })


    describe('fork', async () => {
        const { ethers, network } = require('hardhat')

        const { getEnvVar } = require('../../utils/utils');
        const { assets } = require('../addresses.json')
        const { 
            setHardhatNetwork,
            getERC20Balance,
            makeAccountGen,
            approveERC20, 
            setERC20Bal, 
        } = require('../helpers')

        let trader
        let getNewAccount

        before(async () => {
            getNewAccount = await makeAccountGen()
        })

        beforeEach(() => {
            trader = getNewAccount()
        })

        describe('dfk', async () => {

            let txMngr
            let providers
    
            before(async () => {
                await setHardhatNetwork({
                    rpcUrl: getEnvVar('DFK_RPC'), 
                    forkBlockNumber: 636148, 
                    chainId: 53935
                })
                providers = { 53935: ethers.provider }
            })
    
            beforeEach(async () => {
                txMngr = new TransactionManager(
                    providers, 
                    {53935: trader}
                )
            })
    
            it('submitDexRouterTransaction', async () => {
                // Options
                const tknFrom = assets.dfk.WAVAX
                const tknTo = assets.dfk.CRYSTAL
                const amountIn = parseUnits('100', 18)
                const Router = txMngr.unirouters['dfk-swap']
                // Mint tkns
                await setERC20Bal(tknFrom, trader.address, amountIn)
                // Approve tkns
                await approveERC20(trader, tknFrom, Router.address, amountIn)
                // Query router
                const amounts = await Router.getAmountsOut(
                    amountIn, 
                    [tknFrom, tknTo]
                )
                // Submit tx
                const step = {
                    tkns: [ tknFrom, tknTo ],
                    dexes: [ 'dfk-swap' ],
                    amounts: amounts,
                }
                await txMngr.submitDexRouterTransaction(step)
                    .then(f => f())
                    .then(r => r.wait())
                const balEnd = await getERC20Balance(
                    trader, 
                    tknTo, 
                    trader.address
                )
                expect(balEnd).to.equal(amounts[amounts.length - 1])
            })
        })

        describe('avax', async () => {

            let txMngr
            let providers

            before(async () => {
                await setHardhatNetwork({
                    rpcUrl: getEnvVar('AVAX_RPC'), 
                    forkBlockNumber: 13357267, 
                    chainId: 43114
                })
                providers = { 43114: ethers.provider }
            })

            beforeEach(async () => {
                txMngr = new TransactionManager(
                    providers, 
                    {43114: trader}
                )
            })

            it('submitYakSwapTransaction', async () => {
                // WJEWEL => WAVAX => USDC
                // Options
                const tkns = [ 
                    assets.avax.WJEWEL, 
                    assets.avax.WAVAX, 
                    assets.avax.USDC
                ]
                const dexes = [ 'pangolin', 'joe' ]
                const amounts = [
                    parseUnits('100', 18), // AmountIn
                    0, // Intermediate amount is calculated by the router
                    0 // MinAmountOut (not required)
                ]
                const YakAdapter = txMngr.yakrouter
                // Mint tkns
                await setERC20Bal(tkns[0], trader.address, amounts[0])
                // Approve tkns
                await approveERC20(trader, tkns[0], YakAdapter.address, amounts[0])
                // Submit tx
                const step = {
                    amounts,
                    dexes,
                    tkns,
                }
                await txMngr.submitYakTransaction(step)
                    .then(f => f())
                    .then(r => r.wait())
                const balEnd = await getERC20Balance(
                    trader, 
                    tkns[tkns.length-1], 
                    trader.address
                )
                expect(balEnd).to.gt(0)
            })


        })


    })


})