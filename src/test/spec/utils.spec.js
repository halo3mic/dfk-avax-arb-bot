const { parseUnits } = require('ethers').ethers.utils
const { describe, it } = require('mocha');
const { expect } = require('chai')

const { 
    unnormalizeUnits,
    normalizeUnits,
    getEnvVar,
} = require('../../utils/utils');

describe('utils', () => {

    describe('getEnvVar', () => {

        it('Missing env var', () => {
            delete process.env['X']
            expect(() => getEnvVar('X')).to.throw('Environment variable X not set')
        })

        it('Valid env var', () => {
            process.env['X'] = 'Y'
            expect(getEnvVar('X')).to.eq('Y')
        })

        it('Convert to int', () => {
            process.env['X'] = '111'
            expect(getEnvVar('X', true)).to.eq(111)
        })
    })

    describe('normalizeUnits', () => {

        it('normalize dec 18', () => {
            expect(normalizeUnits(parseUnits('1', 18), 18))
                .to.eq(parseUnits('1', 18))
        })

        it('normalize dec 6', () => {
            expect(normalizeUnits(parseUnits('3332', 6), 6))
                .to.eq(parseUnits('3332', 18))
        })

        it('normalize dec 24', () => {
            expect(normalizeUnits(parseUnits('12123219', 24), 24))
                .to.eq(parseUnits('12123219', 18))
        })

    })

    describe('unnormalizeUnits', () => {

        it('unnormalize dec 18', () => {
            expect(unnormalizeUnits(parseUnits('1000', 18), 18))
                .to.eq(parseUnits('1000', 18))
        })

        it('unnormalize dec 6', () => {
            expect(unnormalizeUnits(parseUnits('100', 18), 6))
                .to.eq(parseUnits('100', 6))
        })

        it('unnormalize dec 24', () => {
            expect(unnormalizeUnits(parseUnits('20033', 18), 24))
                .to.eq(parseUnits('20033', 24))
        })

    })

})

