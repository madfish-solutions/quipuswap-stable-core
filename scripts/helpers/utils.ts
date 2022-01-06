import { execSync } from "child_process";
import { InMemorySigner } from "@taquito/signer";
import { TransactionOperation } from "@taquito/taquito/dist/types/operations/transaction-operation";
import config from "../../config";
const accounts = config.networks.sandbox.accounts;
import { confirmOperation } from "./confirmation";
import { MichelsonMap, TezosToolkit } from "@taquito/taquito";
import { IndexMap, TokensMap } from "../../test/Dex/types";
import { FA12TokenType, FA2TokenType } from "../../test/Dex/API/types";
export const tezPrecision = 1e6;

function stringLiteralArray<T extends string>(a: T[]) {
  return a;
}

const senders: string[] = stringLiteralArray(Object.keys(accounts));
export declare type AccountsLiteral = typeof senders[number];

const nw: string[] = stringLiteralArray(Object.keys(config.networks));
export declare type NetworkLiteral = typeof nw[number];

export declare type TezosAddress = string;

const rpcNode = `http://${config.networks.sandbox.host}:${config.networks.sandbox.port}`;
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
    await confirmOperation(Tezos, operation.hash);
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
  const lambda_func_storage = new MichelsonMap<string, string>();
  for (const lambda of lambdas_comp) {
    const key: string = lambda.args[1].int as string;
    const bytes: string = lambda.args[0].bytes as string;
    lambda_func_storage.set(key, bytes);
  }
  return lambda_func_storage;
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