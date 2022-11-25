import { TezosToolkit, VIEW_LAMBDA } from "@taquito/taquito";
import { confirmOperation } from "../../../utils/confirmation";
import {
  AccountsLiteral,
  prepareProviderOptions,
  setupLambdasToStorage,
} from "../../../utils/helpers";
import factory_contract from "../../../build/factory.json";
import dev_lambdas_comp from "../../../build/lambdas/test/Dev_lambdas.json";
import dex_lambdas_comp from "../../../build/lambdas/test/Dex_lambdas.json";
import token_lambdas_comp from "../../../build/lambdas/test/Token_lambdas.json";
import admin_lambdas_comp from "../../../build/lambdas/test/Admin_lambdas.json";
import strat_lambdas_comp from "../../../build/lambdas/test/Strategy_lambdas.json";
import { defaultTokenId, TokenFA2 } from "../../Token";
import { setupQuipuGovToken } from "../../utils/tokensSetups";
import { accounts, dev_fee } from "../../../utils/constants";
import {
  DexFactoryAPI as DexFactory,
  defaultDexFactoryStorage as storage,
} from "../API";
import BigNumber from "bignumber.js";
import { DevStorage } from "../../Developer/API/storage";
import chalk from "chalk";

export async function setupFactoryEnvironment(
  Tezos: TezosToolkit,
  developer: AccountsLiteral
): Promise<{
  factory: DexFactory;
  // tokens: TokensMap;
  quipuToken: TokenFA2;
}> {
  const config = await prepareProviderOptions(developer);
  Tezos.setProvider(config);
  const quipuToken = await setupQuipuGovToken(Tezos);
  storage.storage.dev_store = {
    dev_address: accounts[developer].pkh,
    dev_fee_f: new BigNumber(0),
    dev_lambdas: await setupLambdasToStorage(dev_lambdas_comp),
  } as DevStorage;
  storage.storage.init_price = new BigNumber("100");
  storage.storage.burn_rate_f = new BigNumber("0"); // Rate precision
  storage.storage.quipu_token = {
    token_address: quipuToken.contract.address,
    token_id: new BigNumber(defaultTokenId),
  };
  // storage.dex_lambdas = await setupLambdasToStorage(dex_lambdas_comp);
  // storage.token_lambdas = await setupLambdasToStorage(token_lambdas_comp);
  // storage.admin_lambdas = await setupLambdasToStorage(admin_lambdas_comp);
  // storage.storage.dev_store.dev_address = accounts.eve.pkh;
  const fact_op = await Tezos.contract.originate({
    code: factory_contract.michelson,
    storage: storage,
  });
  await confirmOperation(Tezos, fact_op.hash);
  console.debug(
    `[${chalk.green("ORIGINATION")}] FACTORY 4 DEX`,
    chalk.bold.underline(fact_op.contractAddress)
  );
  const factory = await DexFactory.init(Tezos, fact_op.contractAddress);
  return { factory, quipuToken };
}
