import BN from 'bignumber.js';

export interface GenesisParseResult {
  ticker: Buffer,
  name: Buffer,
  documentUri: Buffer,
  documentHash: Buffer,
  decimals: number,
  mintBatonVout: number,
  qty: BN
};

export interface MintParseResult {
  tokenId: Buffer,
  mintBatonVout: number,
  qty: BN
};

export interface SendParseResult {
  tokenId: Buffer,
  amounts: BN[]
};

interface ImpossibleParseResult {
};

export interface ParseResult {
  tokenType: number,
  transactionType: string,
  data: GenesisParseResult | MintParseResult | SendParseResult | ImpossibleParseResult
};

export const parseSLP = (scriptpubkey: Buffer | string): ParseResult => {
  if (typeof scriptpubkey === "string") {
    scriptpubkey = Buffer.from(scriptpubkey, 'hex');
  }
  let it: number = 0; // position in itObj
  let itObj: Buffer = scriptpubkey; // object it refers to


  const OP_0: number         = 0x00;
  const OP_16: number        = 0x60;
  const OP_RETURN: number    = 0x6a;
  const OP_PUSHDATA1: number = 0x4c;
  const OP_PUSHDATA2: number = 0x4d;
  const OP_PUSHDATA4: number = 0x4e;

  const PARSE_CHECK = (v: boolean, str: string): void => {
    if (v) {
      throw Error(str);
    }
  };

  const extractU8 = (): BN => {
    const r: number = itObj.readUInt8(it);
    it += 1;
    return new BN(r);
  };

  const extractU16 = (): BN => {
    const r: number= itObj.readUInt16LE(it);
    it += 2;
    return new BN(r);
  };

  const extractU32 = (): BN => {
    const r: number = itObj.readUInt32LE(it);
    it += 4;
    return new BN(r);
  };

  const extractU64 = (): BN => {
    const r1: number = itObj.readUInt32LE(it);
    it += 4;

    const r2: number = itObj.readUInt32LE(it);
    it += 4;

    return new BN(r2).multipliedBy(2**32).plus(r1);
  };

  PARSE_CHECK(itObj.length === 0, "scriptpubkey cannot be empty");
  PARSE_CHECK(itObj[it] !== OP_RETURN, "scriptpubkey not op_return");
  PARSE_CHECK(itObj.length < 10, "scriptpubkey too small"); // TODO what is correct minimum size?
  ++it;

  const extractPushdata = (): number => {
    if (it === itObj.length) {
      return -1;
    }

    const cnt: number = extractU8().toNumber();
    if (cnt > OP_0 && cnt < OP_PUSHDATA1) {
      if (it+cnt > itObj.length) {
        --it; return -1;
      }

      return cnt;
    }
    else if (cnt === OP_PUSHDATA1) {
      if (it+1 >= itObj.length) {
        --it; return -1;
      }
      return extractU8().toNumber();
    }
    else if (cnt === OP_PUSHDATA2) {
      if (it+2 >= itObj.length) {
        --it; return -1;
      }
      return extractU16().toNumber();
    }
    else if (cnt === OP_PUSHDATA4) {
      if (it+4 >= itObj.length) {
        --it; return -1;
      }
      return extractU32().toNumber();
    }

    // other opcodes not allowed
    --it; return -1;
  };

  const bufferToBN = (): BN => {
    if (itObj.length === 1) return extractU8();
    if (itObj.length === 2) return extractU16();
    if (itObj.length === 4) return extractU32();
    if (itObj.length === 8) return extractU64();
    throw new Error('extraction of number from buffer failed');
  };

  const checkValidTokenId = (tokenId: Buffer): boolean => tokenId.length === 32;

  const chunks: Buffer[] = [];
  for (let len = extractPushdata(); len >= 0; len = extractPushdata()) {
    const buf: Buffer = itObj.slice(it, it+len);
    PARSE_CHECK(it + len > itObj.length, "pushdata data extraction failed");

    it += len;
    chunks.push(buf);

    if (chunks.length === 1) {
      const lokadIdStr = chunks[0];
      PARSE_CHECK(lokadIdStr.length !== 4, "lokad id wrong size");
      PARSE_CHECK(
          lokadIdStr[0] !== 'S'.charCodeAt(0)
       || lokadIdStr[1] !== 'L'.charCodeAt(0)
       || lokadIdStr[2] !== 'P'.charCodeAt(0)
       || lokadIdStr[3] !== 0x00, "SLP not in first chunk");
    }
  }

  PARSE_CHECK(it !== itObj.length, "trailing data");
  PARSE_CHECK(chunks.length === 0, "chunks empty");

  let cit = 0;
  const CHECK_NEXT = (): void => {
    ++cit;
    PARSE_CHECK(cit === chunks.length, "parsing ended early");
    it = 0;
    itObj = chunks[cit];
  };
  CHECK_NEXT(); // for quick exit check done above

  const tokenTypeBuf = itObj.reverse();
  PARSE_CHECK(tokenTypeBuf.length !== 1 && tokenTypeBuf.length !== 2,
      "token_type string length must be 1 or 2");

  const tokenType: number = bufferToBN().toNumber();
  PARSE_CHECK(! [0x01, 0x41, 0x81].includes(tokenType),
              "token_type not token-type1, nft1-group, or nft1-child");

  CHECK_NEXT();

  const transactionType = itObj.toString();
  if (transactionType === 'GENESIS') {
    PARSE_CHECK(chunks.length !== 10, "wrong number of chunks");
    CHECK_NEXT();

    const ticker = itObj;
    CHECK_NEXT();

    const name = itObj;
    CHECK_NEXT();

    const documentUri = itObj;
    CHECK_NEXT();

    const documentHash = itObj;
    PARSE_CHECK(! (documentHash.length === 0 || documentHash.length === 32),
      "document_hash must be size 0 or 32");
    CHECK_NEXT();

    const decimalsBuf = itObj;
    PARSE_CHECK(decimalsBuf.length !== 1, "decimals string length must be 1");

    const decimals = bufferToBN().toNumber();
    PARSE_CHECK(decimals > 9, "decimals bigger than 9");
    CHECK_NEXT();

    const mintBatonVoutBuf = itObj;
    let mintBatonVout = 0;
    PARSE_CHECK(mintBatonVoutBuf.length >= 2, "mint_baton_vout string length must be 0 or 1");
    if (mintBatonVoutBuf.length > 0) {
      mintBatonVout = bufferToBN().toNumber();
      PARSE_CHECK(mintBatonVout < 2, "mint_baton_vout must be at least 2");
    }
    CHECK_NEXT();

    const qtyBuf= itObj.reverse();
    PARSE_CHECK (qtyBuf.length !== 8, "initial_qty must be provided as an 8-byte buffer");
    const qty = bufferToBN();

    if (tokenType === 0x41) {
      PARSE_CHECK(decimals !== 0, "NFT1 child token must have divisibility set to 0 decimal places");
      PARSE_CHECK(mintBatonVout !== 0, "NFT1 child token must not have a minting baton");
      PARSE_CHECK(! qty.isEqualTo(1), "NFT1 child token must have quantity of 1");
    }

    const actionData: GenesisParseResult = {
      ticker,
      name,
      documentUri,
      documentHash,
      decimals,
      mintBatonVout,
      qty
    };

    return {
      tokenType,
      transactionType,
      data: actionData
    };
  } else if (transactionType === "MINT") {
    PARSE_CHECK(tokenType === 0x41, "NFT1 Child cannot have MINT transaction type.");

    PARSE_CHECK(chunks.length !== 6, "wrong number of chunks");
    CHECK_NEXT();

    const tokenId: Buffer = itObj;
    PARSE_CHECK(! checkValidTokenId(tokenId), "tokenId invalid size");
    CHECK_NEXT();

    const mintBatonVoutBuf = itObj;
    let mintBatonVout = 0;
    PARSE_CHECK(mintBatonVoutBuf.length >= 2, "mint_baton_vout string length must be 0 or 1");
    if (mintBatonVoutBuf.length > 0) {
      mintBatonVout = bufferToBN().toNumber();
      PARSE_CHECK(mintBatonVout < 2, "mint_baton_vout must be at least 2");
    }
    CHECK_NEXT();

    const additionalQtyBuf = itObj.reverse();
    PARSE_CHECK (additionalQtyBuf.length !== 8, "additional_qty must be provided as an 8-byte buffer");
    const qty = bufferToBN();

    const actionData: MintParseResult = {
      tokenId,
      mintBatonVout,
      qty
    };

    return {
      tokenType,
      transactionType,
      data: actionData
    };
  } else if (transactionType === "SEND") {
    PARSE_CHECK(chunks.length < 4, "wrong number of chunks");
    CHECK_NEXT();

    const tokenId: Buffer = itObj;
    PARSE_CHECK(! checkValidTokenId(tokenId), "tokenId invalid size");
    CHECK_NEXT();

    const amounts: BN[] = [];
    while (cit !== chunks.length) {
      const amountBuf = itObj.reverse();
      PARSE_CHECK(amountBuf.length !== 8, "amount string size not 8 bytes");

      const value: BN = bufferToBN();
      amounts.push(value);

      ++cit;
      itObj = chunks[cit];
      it = 0;
    }

    PARSE_CHECK(amounts.length === 0, "token_amounts size is 0");
    PARSE_CHECK(amounts.length > 19, "token_amounts size is greater than 19");

    const actionData: SendParseResult = {
      tokenId,
      amounts
    };

    return {
      tokenType,
      transactionType,
      data: actionData
    };
  } else {
    PARSE_CHECK(true, "unknown action type");
  }

  // unreachable code
  return {
    tokenType,
    transactionType,
    data: {}
  };
};

export {
  BN
};
