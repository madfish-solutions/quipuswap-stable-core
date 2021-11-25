const fs = require("fs");
import BigNumber from "bignumber.js";
import { prepareProviderOptions, printFormattedOutput } from "../helpers/utils";
import { AmountsMap, TokensMap } from "./types";
import { TezosToolkit } from "@taquito/taquito";
import kUSDstorage from "../helpers/tokens/kUSD_storage";
import uUSDstorage from "../helpers/tokens/uUSD_storage";
import USDtzstorage from "../helpers/tokens/USDtz_storage";
import QUIPUstorage from "../helpers/tokens/QUIPU_storage";
import { confirmOperation } from "../helpers/confirmation";
import { TokenFA12 } from "../helpers/tokenFA12";
import { TokenFA2 } from "../helpers/tokenFA2";
import { Dex } from "../helpers/dexFA2";
import { accounts } from "./constants";
import { FA12TokenType, FA2TokenType } from "../helpers/types";

const uUSD_contract = fs
  .readFileSync("./test/helpers/tokens/uUSD.tz")
  .toString();
const USDtz_contract = fs
  .readFileSync("./test/helpers/tokens/USDtz.tz")
  .toString();

const kUSD_contract = fs
  .readFileSync("./test/helpers/tokens/kUSD.tz")
  .toString();

const QUIPU_contract = fs
  .readFileSync("./test/helpers/tokens/QUIPU.tz")
  .toString();

async function originateTokens(Tezos: TezosToolkit): Promise<TokensMap> {
  const kUSD = await Tezos.contract.originate({
    code: kUSD_contract,
    storage: kUSDstorage,
  });
  await confirmOperation(Tezos, kUSD.hash);
  printFormattedOutput(global.startTime, "kUSD");
  const USDtz = await Tezos.contract.originate({
    code: USDtz_contract,
    storage: USDtzstorage,
  });
  await confirmOperation(Tezos, USDtz.hash);
  printFormattedOutput(global.startTime, "USDtz");
  const uUSD = await Tezos.contract.originate({
    code: uUSD_contract,
    storage: uUSDstorage,
  });
  await confirmOperation(Tezos, uUSD.hash);
  printFormattedOutput(global.startTime, "uUSD");
  return {
    kUSD: await TokenFA12.init(Tezos, kUSD.contractAddress),
    uUSD: await TokenFA2.init(Tezos, uUSD.contractAddress),
    USDtz: await TokenFA12.init(Tezos, USDtz.contractAddress),
  };
}

async function approveAllTokens(
  dex: Dex,
  tokens: TokensMap,
  Tezos: TezosToolkit
): Promise<boolean> {
  const approveAmount = new BigNumber(10).pow(45);
  for (const spender in accounts) {
    let config = await prepareProviderOptions(spender);
    Tezos.setProvider(config);
    for (const token in tokens) {
      await tokens[token].approve(dex.contract.address, approveAmount);
      printFormattedOutput(global.startTime, spender, token, "approve");
    }
  }
  return true;
}

export async function setupTrioTokens(
  dex: Dex,
  Tezos: TezosToolkit,
  approveAll: boolean = false
): Promise<TokensMap> {
  printFormattedOutput(global.startTime, "Setting up tokens");
  const tokens = await originateTokens(Tezos);
  if (approveAll) {
    await approveAllTokens(dex, tokens, Tezos);
  }
  return tokens as TokensMap;
}

export async function setupTokenAmounts(
  dex: Dex,
  tokens: TokensMap,
  inputs: AmountsMap
): Promise<{ pool_id: BigNumber; amounts: Map<string, BigNumber> }> {
  await dex.updateStorage({});
  const pool_id = dex.storage.storage.pools_count.minus(new BigNumber(1));
  await dex.updateStorage({ tokens: [pool_id.toString()] });
  const tokens_map = dex.storage.storage.tokens[
    pool_id.toNumber()
  ] as unknown as Map<string, FA2TokenType | FA12TokenType>;
  let amounts = new Map<string, BigNumber>();
  for (let [k, v] of tokens_map.entries()) {
    let token: FA2TokenType | FA12TokenType = v as FA2TokenType;
    let contract_address: string;
    if (token.fa2) {
      contract_address = token.fa2.token_address;
    } else {
      token = v as FA12TokenType;
      contract_address = token.fa12;
    }
    if (contract_address) {
      for (const token in tokens) {
        if (contract_address == tokens[token].contract.address) {
          amounts.set(k, inputs[token]);
        }
      }
    }
  }
  return { pool_id, amounts };
}

export async function setupQuipuGovToken(Tezos: TezosToolkit): Promise<TokenFA2> {
  const quipu = await Tezos.contract.originate({
    code: QUIPU_contract,
    storage: QUIPUstorage,
  });
  await confirmOperation(Tezos, quipu.hash);
  return await TokenFA2.init(Tezos, quipu.contractAddress);
}
