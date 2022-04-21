const { utils, BigNumber } = require('ethers');
const { describe, it } = require('mocha');
const { expect } = require('chai')

const { InventoryManager } = require('../../utils/inventory');
const { assets } = require('../addresses.json')

const { 
    getAvaxRpcProvider, 
    getDfkRpcProvider 
} = require('../../utils/providers');


describe('inventory', async () => {

    let inventoryMngr
    let tkns

    before(() => {
        tkns = require('../dummy-data/tokens.json')
        const providers = {
            43114: getAvaxRpcProvider(),
            53935: getDfkRpcProvider(),
        }
        const holders = {
            43114: ['0x57b91d1665DcE0dBDEafEC7A2045e9CDd14360bC'],
            53935: ['0x57b91d1665DcE0dBDEafEC7A2045e9CDd14360bC'],
        }
        inventoryMngr = new InventoryManager(
            providers, 
            holders, 
            tkns
        )
    })

    it('fetchBalRaw', async () => {
        const rawBal = await inventoryMngr.fetchBalRaw(
            '0x57b91d1665DcE0dBDEafEC7A2045e9CDd14360bC',
            tkns.find(t => t.id == assets.avax.WJEWEL), 
            { 43114: 13446004 }
        )
        expect(parseInt(rawBal, 16)).to.equal(87074507127056333883)
    })

    it('fetchBalForToken', async () => {
        const bal = await inventoryMngr.fetchBalForToken(
            '0x57b91d1665DcE0dBDEafEC7A2045e9CDd14360bC',
            tkns.find(t => t.id == assets.avax.USDCe), 
            { 43114: 13446004 }
        )
        // Normalize USDCe from 6 to 18 decimals
        expect(bal).to.equal(utils.parseUnits('195.863044', 18))
    })

    it('fetchTknBalancesForHolder', async () => {
        const dfkTkns = tkns.filter(tkn => tkn.chainID === 53935)
        const bals = await inventoryMngr.fetchTknBalancesForHolder(
            '0x57b91d1665DcE0dBDEafEC7A2045e9CDd14360bC',
            dfkTkns, 
            { 53935: 665427 }
        )
        expect(bals)
            .to.have.property(assets.dfk.CRYSTAL.toLowerCase())
            .to.eq(0)
        expect(bals)    
            .to.have.property(assets.dfk.WJEWEL.toLowerCase())
            .to.eq(0)
        expect(bals)
            .to.have.property(assets.dfk.WAVAX.toLowerCase())
            .to.gt(0)
        expect(bals)
            .to.have.property(assets.dfk.USDC.toLowerCase())
            .to.gt(0)
    })

    it('updateBalances', async () => {
        const balsBefore = inventoryMngr.balances
        await inventoryMngr.updateBalances({
            43114: 13446004,
            53935: 665427,
        })
        const holderL = '0x57b91d1665DcE0dBDEafEC7A2045e9CDd14360bC'.toLowerCase()
        expect(inventoryMngr.balances).to.have.property('43114')
        expect(inventoryMngr.balances['53935'])
            .to.have.property(holderL)
            .to.have.property(assets.dfk.WAVAX.toLowerCase())
            .to.eq(BigNumber.from('0x09894c12f7ba110000'))
        expect(inventoryMngr.balances['43114'])
            .to.have.property(holderL)
            .to.have.property(assets.avax.WAVAX.toLowerCase())
            .to.eq(BigNumber.from('0x040a19ffe069ce0199'))
        // Reset balances
        inventoryMngr.balances = balsBefore
    })

    it('updateBalanceFromTransfer', async () => {
        const holder = '0x57b91d1665DcE0dBDEafEC7A2045e9CDd14360bC'
        const tkn = assets.dfk.WAVAX
        await inventoryMngr.updateBalanceFromTransfer(holder, tkn)
        const currBal = await inventoryMngr.fetchBalForToken(
            holder,
            tkns.find(t => t.id == tkn),
        )
        const h = holder.toLowerCase()
        const t = tkn.toLowerCase()
        expect(inventoryMngr.balances[53935][h][t]).eq(currBal)
    })

    it('getTknBalForHolder', async () => {
        const balsBefore = inventoryMngr.balances
        const holder = '0x57b91d1665DcE0dBDEafEC7A2045e9CDd14360bC'
        const tkn = assets.dfk.CRYSTAL
        const bal = BigNumber.from('0x09894c12f7ba110000')
        inventoryMngr.balances[53935][holder.toLowerCase()][tkn.toLowerCase()] = bal
        expect(inventoryMngr.getTknBalForHolder(holder, tkn)).to.eq(bal)
        inventoryMngr.balances = balsBefore
    })

    it('balanceUpdateHandler', async () => {
        // Set initial balances
        await inventoryMngr.setInitialBals()
        // Update balances
        const holder = '0x57b91d1665DcE0dBDEafEC7A2045e9CDd14360bC'
        const holderTopic = '0x' + holder.toLowerCase().padStart(64, '0')
        const events = [
            {
                address: assets.avax.WJEWEL,
                topics: [
                    '',
                    holderTopic,
                    ''
                ]
            },
            {
                address: assets.dfk.WAVAX,
                topics: [
                    '',
                    '',
                    holderTopic
                ]
            }
        ]
        await inventoryMngr.balanceUpdateHandler(events)
        // Expect holder balance to be updated to the current bal of WAVAX(dfk) 
        // and WJEWEL(avax)
        const wjewelBal = await inventoryMngr.fetchBalForToken(
            holder,
            tkns.find(t => t.id == assets.avax.WJEWEL),
        )
        const wavaxBal = await inventoryMngr.fetchBalForToken(
            holder,
            tkns.find(t => t.id == assets.dfk.WAVAX),
        )
        expect(inventoryMngr.getTknBalForHolder(holder, assets.avax.WJEWEL))
            .to.eq(wjewelBal)
        expect(inventoryMngr.getTknBalForHolder(holder, assets.dfk.WAVAX))
            .to.eq(wavaxBal)
    })


})