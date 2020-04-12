import * as chai from 'chai';
import { expect } from 'chai';
import chaiBytes from 'chai-bytes';
chai.use(chaiBytes);

import {
  parseSLP,
  ParseResult,
  GenesisParseResult,
  MintParseResult,
  SendParseResult
} from '../lib/index';

import 'mocha';
import BN from 'bignumber.js';

import tests from './script_tests';


describe('PARSER', () => {
  for (const test of tests) {
    it(test.msg, () => {
      if (test.code === null) {
        expect(() => parseSLP(Buffer.from(test.script, 'hex'))).to.not.throw();

        if (typeof(test.parsed) !== 'undefined') {
          const m = parseSLP(Buffer.from(test.script, 'hex'));
          expect(m.tokenType).to.equal(test.parsed.tokenType);
          expect(m.transactionType).to.equal(test.parsed.transactionType);

          if (test.parsed.transactionType === "GENESIS") {
            const o = (m.data as GenesisParseResult);
            expect(o.ticker).to.equalBytes(test.parsed.data.ticker);
            expect(o.name).to.equalBytes(test.parsed.data.name);
            expect(o.documentUri).to.equalBytes(test.parsed.data.documentUri);
            expect(o.documentHash).to.equalBytes(test.parsed.data.documentHash);
            expect(o.decimals).to.equal(test.parsed.data.decimals);
            expect(o.mintBatonVout).to.equal(test.parsed.data.mintBatonVout);
            expect(o.qty.toString()).to.equal(test.parsed.data.qty);
          } else if (test.parsed.transactionType === "MINT") {
            const o = (m.data as MintParseResult);
            expect(o.tokenId).to.equalBytes(Buffer.from(test.parsed.data.tokenId, 'hex'));
            expect(o.mintBatonVout).to.equal(test.parsed.data.mintBatonVout);
            expect(o.qty.toString()).to.equal(test.parsed.data.qty);
          } else if (test.parsed.transactionType === "SEND") {
            const o = (m.data as SendParseResult);
            expect(o.tokenId).to.equalBytes(Buffer.from(test.parsed.data.tokenId, 'hex'));
            expect(o.amounts.length).to.equal(test.parsed.data.amounts.length);

            for (let i=0; i<o.amounts.length; ++i) {
              expect(o.amounts[i].toString()).to.equal(test.parsed.data.amounts[i]);
            }
          }
        }
      } else {
        expect(() => parseSLP(Buffer.from(test.script, 'hex'))).to.throw();
      }
    });
  }
});
