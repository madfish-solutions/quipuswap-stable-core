import { MichelsonMap, TezosToolkit } from "@taquito/taquito";
import BigNumber from "bignumber.js";
import config from "../config";
import { migrate } from "../scripts/commands/migrate/utils";
import {
  FA2,
  NetworkLiteral,
  setupLambdasToStorage,
  TezosAddress,
  validateValue,
} from "../utils/helpers";
import { validateAddress, validateContractAddress } from "@taquito/utils";
import dev_lambdas_comp from "../build/lambdas/Dev_lambdas.json";
import { DexFactoryAPI as DexFactory } from "../test/Factory/API";
import { FactoryStorage, InnerFactoryStore } from "../test/Factory/API/types";
import { DevStorage } from "../test/Developer/API/storage";
import chalk from "chalk";

const storage: FactoryStorage = {
  storage: {
    dev_store: {
      dev_address: null as TezosAddress, // DON'T Touch! Setting from deployer SK
      dev_fee_f: new BigNumber(0),
      dev_lambdas: new MichelsonMap(),
    } as DevStorage,
    init_price: new BigNumber("0"),
    burn_rate_f: new BigNumber("0"),
    pools_count: new BigNumber("0"),
    pool_to_address: new MichelsonMap(),
    quipu_token: {
      token_address: (process.env.QUIPU_TOKEN_ADDRESS || null) as TezosAddress,
      token_id: (new BigNumber(process.env.QUIPU_TOKEN_ID) ||
        null) as BigNumber,
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
  storage.storage.dev_store.dev_address = validateValue(
    validateAddress,
    storage.storage.dev_store.dev_address
  );
  storage.storage.quipu_token.token_address = validateValue(
    validateContractAddress,
    storage.storage.quipu_token.token_address
  );
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
  console.log(
    `Factory contract: ${chalk.bgYellow.bold.redBright(contractAddress)}`
  );
  const dex_f: DexFactory = await DexFactory.init(tezos, contractAddress);
  console.log(
    `Factory is ${chalk.green(
      "online"
    )} at ${chalk.bgGreenBright.bold.blackBright(dex_f.contract.address)}`
  );
};
