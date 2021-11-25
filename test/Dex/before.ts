import { TezosToolkit, VIEW_LAMBDA } from "@taquito/taquito";
import { confirmOperation } from "../helpers/confirmation";
import { prepareProviderOptions, printFormattedOutput, setupLambdasToStorage } from "../helpers/utils";

import dex_contract from "../../build/Dex.ligo.json";
import dex_lambdas_comp from "../../build/lambdas/Dex_lambdas.json";
import token_lambdas_comp from "../../build/lambdas/Token_lambdas.json";

import storage from "../storage/Dex";
import { accounts } from "./constants";
import { Dex } from '../helpers/dexFA2';
import { setupQuipuGovToken, setupTrioTokens } from "./tokensSetups";
import { TokensMap } from "./types";
import { defaultTokenId, TokenFA2 } from "../helpers/tokenFA2";

export async function setupDexEnvironment(Tezos: TezosToolkit): Promise<{
  dex: Dex;
  tokens: TokensMap;
  quipuToken: TokenFA2;
  lambdaContractAddress: string;
}> {
  let config = await prepareProviderOptions("alice");
  Tezos.setProvider(config);
  const op = await Tezos.contract.originate({
    code: VIEW_LAMBDA.code,
    storage: VIEW_LAMBDA.storage,
  });
  await confirmOperation(Tezos, op.hash);
  printFormattedOutput(global.startTime, "opLambda view set");
  const quipuToken = await setupQuipuGovToken(Tezos);
  const lambdaContractAddress = op.contractAddress;
  storage.storage.admin = accounts.alice.pkh;
  storage.storage.default_referral = accounts.bob.pkh;
  storage.storage.dev_address = accounts.eve.pkh;
  storage.storage.quipu_token = {
    token_address: quipuToken.contract.address,
    token_id: defaultTokenId
  }
  // storage.dex_lambdas = await setupLambdasToStorage(dex_lambdas_comp);
  storage.token_lambdas = await setupLambdasToStorage(token_lambdas_comp);
  const dex_op = await Tezos.contract.originate({
    code: JSON.parse(dex_contract.michelson),
    storage: storage,
  });
  printFormattedOutput(global.startTime, "DEX op hash", dex_op.hash);
  await confirmOperation(Tezos, dex_op.hash);
  printFormattedOutput(global.startTime, "DEX", dex_op.contractAddress);
  const dex = await Dex.init(Tezos, dex_op.contractAddress);
  printFormattedOutput(global.startTime, "DEX init finished");
  await new Promise((r) => setTimeout(r, 2000));
  const tokens = await setupTrioTokens(dex, Tezos, true);
  
  return { dex, tokens, quipuToken, lambdaContractAddress };
}