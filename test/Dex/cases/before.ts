import { TezosToolkit, VIEW_LAMBDA } from "@taquito/taquito";
import { confirmOperation } from "../../../utils/confirmation";
import {
  prepareProviderOptions,
  setupLambdasToStorage,
} from "../../../utils/helpers";
import { BigNumber } from "bignumber.js";
import dex_contract from "../../../build/dex_test.json";
import dev_lambdas_comp from "../../../build/lambdas/test/Dev_lambdas.json";
import dex_lambdas_comp from "../../../build/lambdas/test/Dex_lambdas.json";
import token_lambdas_comp from "../../../build/lambdas/test/Token_lambdas.json";
import admin_lambdas_comp from "../../../build/lambdas/test/Admin_lambdas.json";
import permit_lambdas_comp from "../../../build/lambdas/test/Permit_lambdas.json";

import { accounts } from "../../../utils/constants";
import { DexAPI as Dex, defaultDexStorage as storage } from "../API";
import { setupQuipuGovToken, setupTrioTokens } from "../../utils/tokensSetups";
import { TokensMap } from "../../utils/types";
import { defaultTokenId, TokenFA2 } from "../../Token";

export async function setupDexEnvironment(Tezos: TezosToolkit): Promise<{
  dex: Dex;
  tokens: TokensMap;
  quipuToken: TokenFA2;
  lambdaContractAddress: string;
}> {
  const config = await prepareProviderOptions("alice");
  Tezos.setProvider(config);
  const op = await Tezos.contract.originate({
    code: VIEW_LAMBDA.code,
    storage: VIEW_LAMBDA.storage,
  });
  await confirmOperation(Tezos, op.hash);
  const quipuToken = await setupQuipuGovToken(Tezos);
  const lambdaContractAddress = op.contractAddress;
  storage.storage.admin = accounts.alice.pkh;
  storage.storage.default_referral = accounts.bob.pkh;
  storage.storage.quipu_token = {
    token_address: quipuToken.contract.address,
    token_id: new BigNumber(defaultTokenId),
  };
  // storage.dex_lambdas = await setupLambdasToStorage(dex_lambdas_comp);
  // storage.token_lambdas = await setupLambdasToStorage(token_lambdas_comp);
  // storage.permit_lambdas = await setupLambdasToStorage(permit_lambdas_comp);
  storage.admin_lambdas = await setupLambdasToStorage(admin_lambdas_comp);
  storage.storage.dev_store.dev_address = accounts.eve.pkh;
  storage.storage.dev_store.dev_lambdas = await setupLambdasToStorage(
    dev_lambdas_comp
  );
  const dex_op = await Tezos.contract.originate({
    code: JSON.parse(dex_contract.michelson),
    storage: storage,
  });
  console.debug(dex_op.results);
  await confirmOperation(Tezos, dex_op.hash);
  console.debug("[ORIGINATION] DEX", dex_op.contractAddress);
  const dex = await Dex.init(Tezos, dex_op.contractAddress);
  await new Promise((r) => setTimeout(r, 2000));
  const tokens = await setupTrioTokens(dex, Tezos, true);
  return { dex, tokens, quipuToken, lambdaContractAddress };
}
