import { execSync } from "child_process";
import { InMemorySigner } from "@taquito/signer";
import { TransactionOperation } from "@taquito/taquito/dist/types/operations/transaction-operation";
import config from "../config";
const accounts = config.networks.sandbox.accounts;
import { confirmOperation } from "./confirmation";
import { MichelsonMap, TezosToolkit } from "@taquito/taquito";
import { IndexMap, TokensMap } from "../test/utils/types";
import BigNumber from "bignumber.js";
import chalk from "chalk";
export const tezPrecision = 1e6;

export declare type LambdaType = "Dex" | "Token" | "Admin" | "Dev" | "Strategy";

function stringLiteralArray<T extends string>(a: T[]) {
  return a;
}

const senders: string[] = stringLiteralArray(Object.keys(accounts));
export declare type AccountsLiteral = typeof senders[number];

const nw: string[] = stringLiteralArray(Object.keys(config.networks));
export declare type NetworkLiteral = typeof nw[number];

export declare type TezosAddress = string;

export declare type LambdaFunctionType = {
  index: number;
  name: string;
};

export declare type BytesString = string;
export declare type FA2 = { token_address: TezosAddress; token_id: BigNumber };
export declare type FA12 = TezosAddress;
export declare type FA2TokenType = {
  fa2: FA2;
};

export declare type FA12TokenType = {
  fa12: FA12;
};

export declare type TokenType = FA12 | FA2;

const rpcNode = `${config.networks.sandbox.host}:${config.networks.sandbox.port}`;
export const Tezos = new TezosToolkit(rpcNode);

export async function initTezos(
  signer: AccountsLiteral = "alice"
): Promise<TezosToolkit> {
  const config = await prepareProviderOptions(signer);
  const tz = new TezosToolkit(rpcNode);
  tz.setProvider(config);
  return tz;
}

export function getLigo(isDockerizedLigo: boolean): string {
  let path = "ligo";
  if (isDockerizedLigo) {
    path = `docker run -v $PWD:$PWD --rm -i ligolang/ligo:${config.ligoVersion}`;
    try {
      execSync(`${path}  --help`);
    } catch (err) {
      path = "ligo";
      execSync(`${path}  --help`);
    }
  } else {
    try {
      execSync(`${path}  --help`);
    } catch (err) {
      path = `docker run -v $PWD:$PWD --rm -i ligolang/ligo:${config.ligoVersion}`;
      execSync(`${path}  --help`);
    }
  }
  return path;
}

export async function prepareProviderOptions(
  name: AccountsLiteral = "alice"
): Promise<{ signer: InMemorySigner; config: object }> {
  const secretKey = accounts[name].sk.trim();
  return {
    signer: await InMemorySigner.fromSecretKey(secretKey),
    config: {
      confirmationPollingTimeoutSecond: 10000,
    },
  };
}

export function calculateFee(
  operations: TransactionOperation[],
  address: string
): number {
  return operations.reduce((prev, current) => {
    const trxFee = current.fee;
    const internalFees = current.operationResults.reduce((prev, current) => {
      const balanceUpdates = current.metadata.operation_result.balance_updates;
      if (balanceUpdates) {
        return (
          prev +
          balanceUpdates.reduce(
            (prev, current) =>
              prev -
              (current.kind === "contract" && current.contract === address
                ? parseInt(current.change)
                : 0),
            0
          )
        );
      }
      return prev;
    }, 0);
    return prev + trxFee + internalFees;
  }, 0);
}

export async function bakeBlocks(count: number) {
  for (let i = 0; i < count; i++) {
    const operation = await Tezos.contract.transfer({
      to: await Tezos.signer.publicKeyHash(),
      amount: 1,
    });
    await operation.confirmation(2);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function destructObj(obj: any) {
  let arr = [];

  Object.keys(obj).map(function (k) {
    if (k === "fa12" || k === "fa2") {
      arr.push(k);
    }

    if (obj[k] instanceof MichelsonMap || Array.isArray(obj[k])) {
      arr.push(obj[k]);
    } else if (
      typeof obj[k] === "object" &&
      (!(obj[k] instanceof Date) ||
        !(obj[k] instanceof null) ||
        !(obj[k] instanceof undefined))
    ) {
      arr = arr.concat(destructObj(obj[k]));
    } else {
      arr.push(obj[k]);
    }
  });

  return arr;
}

export async function setupLambdasToStorage(
  lambdas_comp: { prim: string; args: { [key: string]: string | number }[] }[]
) {
  const lambda_func_storage = new MichelsonMap<string, BytesString>();
  for (const lambda of lambdas_comp) {
    const key: BigNumber = new BigNumber(lambda.args[1].int);
    const bytes: BytesString = lambda.args[0].bytes as BytesString;
    lambda_func_storage.set(key.toString(), bytes);
  }
  return lambda_func_storage;
}

export async function setFunctionBatchCompilled(
  tezos: TezosToolkit,
  contract: TezosAddress,
  type: LambdaType,
  batchBy: number,
  comp_funcs_map
) {
  let batch = tezos.contract.batch();
  let idx = 0;
  for (const lambdaFunction of comp_funcs_map) {
    batch = batch.withTransfer({
      to: contract,
      amount: 0,
      parameter: {
        entrypoint: `set_${type.toLowerCase()}_function`,
        value: lambdaFunction,
      },
    });
    idx = idx + 1;
    if (idx % batchBy == 0 || idx == comp_funcs_map.length) {
      const batchOp = await batch.send();
      await batchOp.confirmation(2);
      console.debug(
        `[${chalk.bold.bgWhite.bgBlueBright(
          "BATCH"
        )}:${type.toUpperCase()}:SETFUNCTION] ${idx}/${comp_funcs_map.length}`,
        chalk.bold.yellow(batchOp.hash)
      );
      if (idx < comp_funcs_map.length) batch = tezos.contract.batch();
    }
  }
  return true;
}

export async function setFunctionCompilled(
  tezos: TezosToolkit,
  contract: TezosAddress,
  type: LambdaType,
  comp_funcs_map
) {
  let idx = 0;
  for (const lambdaFunction of comp_funcs_map) {
    const op = await tezos.contract.transfer({
      to: contract,
      amount: 0,
      parameter: {
        entrypoint: `set_${type.toLowerCase()}_function`,
        value: lambdaFunction,
      },
    });
    idx = idx + 1;
    await op.confirmation(2);
  }
}

export function mapTokensToIdx(
  tokens_map: Map<string, FA2TokenType | FA12TokenType>,
  tokens: TokensMap
): IndexMap {
  const mapping = {} as IndexMap;
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
        if (contract_address == tokens[token].contract.address)
          mapping[token] = k;
      }
    }
  }
  return mapping;
}

export async function failCase(
  sender: AccountsLiteral,
  act: Promise<unknown> | (() => Promise<unknown>),
  errorMsg: string
) {
  const config = await prepareProviderOptions(sender);
  Tezos.setProvider(config);
  await expect(act).rejects.toMatchObject({
    message: errorMsg,
  });
  return true;
}

export function validateValue(validationFunc, value) {
  const valid = validationFunc(value);
  if (valid == 3) return value;
  else {
    const error_values = [
      "NO_PREFIX_MATCHED",
      "INVALID_CHECKSUM",
      "INVALID_LENGTH",
      "VALID",
    ];
    throw new Error("Dev address must be valid, got " + error_values[valid]);
  }
}
