import BigNumber from "bignumber.js";
import { AmountsMap, TokensMap } from "./types";
import { TezosToolkit } from "@taquito/taquito";
import { confirmOperation } from "../../utils/confirmation";
import Dex from "../Dex/API";
import { accounts } from "../../utils/constants";
import { TokenFA12, TokenFA2, TokenInitValues } from "../Token";
import {
  FA12TokenType,
  FA2TokenType,
  prepareProviderOptions,
} from "../../utils/helpers";

async function originateTokens(Tezos: TezosToolkit): Promise<TokensMap> {
  const kUSD = await Tezos.contract.originate(TokenInitValues.kUSD);
  await confirmOperation(Tezos, kUSD.hash);
  console.debug("[ORIGINATION] kUSD");
  const USDtz = await Tezos.contract.originate(TokenInitValues.USDtz);
  await confirmOperation(Tezos, USDtz.hash);
  console.debug("[ORIGINATION] USDtz");
  const uUSD = await Tezos.contract.originate(TokenInitValues.uUSD);
  await confirmOperation(Tezos, uUSD.hash);
  console.debug("[ORIGINATION] uUSD");
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
    const config = await prepareProviderOptions(spender);
    Tezos.setProvider(config);
    for (const token in tokens) {
      await tokens[token].approve(dex.contract.address, approveAmount);
      console.debug(spender, token, "approve");
    }
  }
  return true;
}

export async function setupTrioTokens(
  dex: Dex,
  Tezos: TezosToolkit,
  approveAll = false
): Promise<TokensMap> {
  console.debug("Setting up tokens");
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
  const amounts = new Map<string, BigNumber>();
  for (const [k, v] of tokens_map.entries()) {
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

export async function setupQuipuGovToken(
  Tezos: TezosToolkit
): Promise<TokenFA2> {
  const quipu = await Tezos.contract.originate(TokenInitValues.QUIPU);
  await confirmOperation(Tezos, quipu.hash);
  return await TokenFA2.init(Tezos, quipu.contractAddress);
}
