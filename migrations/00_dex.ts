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
import { DexStorage } from "../test/Dex/API/types";
import dex_lambdas_comp from "../build/lambdas/Dex_lambdas.json";
import token_lambdas_comp from "../build/lambdas/Token_lambdas.json";
import admin_lambdas_comp from "../build/lambdas/Admin_lambdas.json";
import { Dex } from "../test/Dex/API/dexAPI";
import { DevStorage } from "../test/Developer/API/storage";

const storage: DexStorage = {
  storage: {
    admin: null as TezosAddress,
    dev_store: {
      dev_address: null as TezosAddress,
      dev_fee: new BigNumber(0),
    } as DevStorage,
    default_referral: null as TezosAddress,
    managers: [],

    pools_count: new BigNumber("0"),
    tokens: new MichelsonMap(),
    pool_to_id: new MichelsonMap(),
    pools: new MichelsonMap(),
    ledger: new MichelsonMap(),
    account_data: new MichelsonMap(),
    dev_rewards: new MichelsonMap(),
    referral_rewards: new MichelsonMap(),
    stakers_balance: new MichelsonMap(),
    quipu_token: {
      token_address: null as TezosAddress,
      token_id: null as BigNumber,
    } as FA2,
  },
  metadata: new MichelsonMap(),
  token_metadata: new MichelsonMap(),
  admin_lambdas: new MichelsonMap(),
  dex_lambdas: new MichelsonMap(),
  token_lambdas: new MichelsonMap(),
};

module.exports = async (tezos: TezosToolkit, network: NetworkLiteral) => {
  storage.storage.admin = await tezos.signer.publicKeyHash();
  const contractAddress: TezosAddress = await migrate(
    tezos,
    config.outputDirectory,
    "dex",
    storage,
    network
  );
  console.log(`Dex contract: ${contractAddress}`);
  const dex: Dex = new Dex(tezos, await tezos.contract.at(contractAddress));
  await setFunctionBatchCompilled(
    tezos,
    contractAddress,
    "Admin",
    8,
    admin_lambdas_comp
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
