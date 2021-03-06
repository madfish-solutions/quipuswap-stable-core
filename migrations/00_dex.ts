import { MichelsonMap, TezosToolkit } from "@taquito/taquito";
import { validateAddress, validateContractAddress } from "@taquito/utils";
import BigNumber from "bignumber.js";
import config from "../config";
import { migrate } from "../scripts/commands/migrate/utils";
import { setupLambdasToStorage, validateValue } from "../utils/helpers";
import {
  FA2,
  NetworkLiteral,
  setFunctionBatchCompilled,
  TezosAddress,
} from "../utils/helpers";
import { DexStorage } from "../test/Dex/API/types";
import dex_lambdas_comp from "../build/lambdas/Dex_lambdas.json";
import dev_lambdas_comp from "../build/lambdas/Dev_lambdas.json";
import token_lambdas_comp from "../build/lambdas/Token_lambdas.json";
import admin_lambdas_comp from "../build/lambdas/Admin_lambdas.json";
import { Dex } from "../test/Dex/API/dexAPI";
import { DevStorage } from "../test/Developer/API/storage";
import chalk from "chalk";
import storage from "../storage/dex";

module.exports = async (tezos: TezosToolkit, network: NetworkLiteral) => {
  storage.storage.admin = await tezos.signer.publicKeyHash();
  storage.storage.dev_store.dev_address = validateValue(
    validateAddress,
    storage.storage.dev_store.dev_address
  );
  storage.storage.default_referral = validateValue(
    validateAddress,
    storage.storage.default_referral
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
    "dex",
    storage,
    network
  );
  console.log(
    `Dex contract: ${chalk.bgYellow.bold.redBright(contractAddress)}`
  );
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
  console.log(
    `DEX (${chalk.bold.bgRed.underline("standalone")}) is ${chalk.green(
      "online"
    )} at ${chalk.bgGreenBright.bold.blackBright(dex.contract.address)}`
  );
};
