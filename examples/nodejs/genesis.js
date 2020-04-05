const slpParser = require('../../dist/slp-parser.js');

const slpdata ="6a04534c500001010747454e4553495304484f4e4b09484f4e4b20484f4e4b17544845205245414c20484f4e4b20534c5020544f4b454e4c0001004c0008000000174876e800";
const parsed = slpParser.parseSLP(slpdata);

console.log(parsed);
console.log(parsed.data.ticker.toString());

let qty = parsed.data.qty;
if (parsed.data.decimals > 0) {
    qty = qty.dividedBy(parsed.data.decimals);
}

console.log(parsed.data.ticker.toString() + " was created with " + qty.toString() + " tokens");
