import { MichelsonMap, TezosToolkit, Contract } from "@taquito/taquito";
import BigNumber from "bignumber.js";
import config from "../config";
import { migrate } from "../scripts/commands/migrate/utils";
import {
  FA2,
  NetworkLiteral,
  setFunctionBatchCompilled,
  setupLambdasToStorage,
  TezosAddress,
} from "../utils/helpers";
import dex_lambdas_comp from "../build/lambdas/factory/Dex_lambdas.json";
import dev_lambdas_comp from "../build/lambdas/Dev_lambdas.json";
import token_lambdas_comp from "../build/lambdas/factory/Token_lambdas.json";
import admin_lambdas_comp from "../build/lambdas/factory/Admin_lambdas.json";
import { DexFactoryAPI as DexFactory } from "../test/Factory/API";
import { FactoryStorage, InnerFactoryStore } from "../test/Factory/API/types";
import { DevStorage } from "../test/Developer/API/storage";

const storage: FactoryStorage = {
  storage: {
    dev_store: {
      dev_address: null as TezosAddress,
      dev_fee: new BigNumber(0),
      dev_lambdas: new MichelsonMap(),
    } as DevStorage,
    init_price: new BigNumber("0"),
    burn_rate: new BigNumber("0"),
    pools_count: new BigNumber("0"),
    pool_to_address: new MichelsonMap(),
    quipu_token: {
      token_address: null as TezosAddress,
      token_id: null as BigNumber,
    } as FA2,
    quipu_rewards: new BigNumber("0"),
    whitelist: [] as TezosAddress[],
    deployers: new MichelsonMap(),
  } as InnerFactoryStore,
  admin_lambdas: new MichelsonMap(),
  dex_lambdas: new MichelsonMap(),
  token_lambdas: new MichelsonMap(),
};

module.exports = async (tezos: TezosToolkit, network: NetworkLiteral) => {
  storage.storage.dev_store.dev_address = await tezos.signer.publicKeyHash();
  storage.storage.dev_store.dev_lambdas = await setupLambdasToStorage(
    dev_lambdas_comp
  );
  const contractAddress: TezosAddress = await migrate(
    tezos,
    config.outputDirectory,
    "factory",
    storage,
    network
  );
  console.log(`Dex contract: ${contractAddress}`);
  const dex: DexFactory = new DexFactory(
    await tezos.contract.at(contractAddress)
  );
  await setFunctionBatchCompilled(
    tezos,
    contractAddress,
    "Admin",
    8,
    admin_lambdas_comp.filter((value) => value.args[1].int !== "7")
  );
  await setFunctionBatchCompilled(
    tezos,
    contractAddress,
    "Token",
    5,
    token_lambdas_comp
  );
  await setFunctionBatchCompilled(
    tezos,
    contractAddress,
    "Dex",
    8,
    dex_lambdas_comp
  );
};
