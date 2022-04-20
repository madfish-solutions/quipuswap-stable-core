import { MichelsonMap, TezosToolkit } from "@taquito/taquito";
import config from "../config";
import { migrate } from "../scripts/commands/migrate/utils";
import {
  NetworkLiteral,
  setupLambdasToStorage,
  TezosAddress,
  validateValue,
} from "../utils/helpers";
import { validateAddress, validateContractAddress } from "@taquito/utils";
import dev_lambdas_comp from "../build/lambdas/Dev_lambdas.json";
import { DexFactoryAPI as DexFactory } from "../test/Factory/API";
import chalk from "chalk";
import storage from "../storage/factory";

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
