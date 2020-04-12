const slpParser = require('../../dist/slp-parser.js');
const slpdata ="6a04534c500001010453454e44207f8889682d57369ed0e32336f8b7e0ffec625a35cca183f4e81fde4e71a538a10800000000000027100800000000000679e1";
const parsed = slpParser.parseSLP(slpdata);

console.log('tokenType: ', parsed.tokenType);
console.log('transactionType: ', parsed.transactionType);
console.log('tokenId: ', parsed.data.tokenId.toString('hex'));
console.log('amounts: ', parsed.data.amounts.map(v => v.toString()));
