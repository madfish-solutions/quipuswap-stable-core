import {
  ContractAbstraction,
  ContractProvider,
  MichelsonMap,
  TezosToolkit,
} from "@taquito/taquito";
import { TransactionOperation } from "@taquito/taquito/dist/types/operations/transaction-operation";
import { BigNumber } from "bignumber.js";
import {
  DexStorage,
  FA12TokenType,
  FA2TokenType,
  FeeType,
  LambdaFunctionType,
  TokenInfo,
} from "./types";
import { getLigo } from "../../../scripts/helpers/utils";
import { execSync } from "child_process";
import { confirmOperation } from "../../../scripts/helpers/confirmation";
import { dexLambdas, tokenLambdas } from "../../storage/Functions";
import admin_lambdas_comp from "../../../build/lambdas/test/Admin_lambdas.json";
import permit_lambdas_comp from "../../../build/lambdas/test/Permit_lambdas.json";
import dex_lambdas_comp from "../../../build/lambdas/test/Dex_lambdas.json";
import token_lambdas_comp from "../../../build/lambdas/test/Token_lambdas.json";
import { defaultTokenId, TokenFA12, TokenFA2 } from "../../Token";

export class Dex extends TokenFA2 {
  public contract: ContractAbstraction<ContractProvider>;
  public storage: DexStorage;

  readonly Tezos: TezosToolkit;

  constructor(
    tezos: TezosToolkit,
    contract: ContractAbstraction<ContractProvider>
  ) {
    super(tezos, contract);
  }

  static async init(tezos: TezosToolkit, dexAddress: string): Promise<Dex> {
    const dex = new Dex(tezos, await tezos.contract.at(dexAddress));
    // await dex.setFunctionBatchCompilled("Admin", 5, admin_lambdas_comp);
    // await dex.setFunctionBatchCompilled("Permit", 2, permit_lambdas_comp);
    await dex.setFunctionBatchCompilled("Token", 5, token_lambdas_comp);
    await dex.setFunctionBatchCompilled("Dex", 4, dex_lambdas_comp);
    return dex;
  }

  async updateStorage(
    maps: {
      tokens?: string[];
      token_to_id?: string[];
      pools?: string[];
      ledger?: any[];
      dex_lambdas?: number[];
      token_lambdas?: number[];
    } = {}
  ): Promise<void> {
    this.storage = (await this.contract.storage()) as DexStorage;
    for (const key in maps) {
      if (
        [
          "dex_lambdas",
          "token_lambdas",
          "admin_lambdas",
          "permit_lambdas",
        ].includes(key)
      )
        continue;
      this.storage.storage[key] = await maps[key].reduce(
        async (prev, current) => {
          try {
            return {
              ...(await prev),
              [key == "ledger" ? current[0] : current]:
                await this.storage.storage[key].get(current),
            };
          } catch (ex) {
            console.error(ex);
            return {
              ...(await prev),
            };
          }
        },
        Promise.resolve({})
      );
    }
    for (const key in maps) {
      if (
        ![
          "dex_lambdas",
          "token_lambdas",
          "admin_lambdas",
          "permit_lambdas",
        ].includes(key)
      )
        continue;
      this.storage[key] = await maps[key].reduce(async (prev, current) => {
        try {
          return {
            ...(await prev),
            [current]: await this.storage[key].get(current.toString()),
          };
        } catch (ex) {
          return {
            ...(await prev),
          };
        }
      }, Promise.resolve({}));
    }
  }

  async initializeExchange(
    a_const: BigNumber = new BigNumber("100000"),
    token_info: {
      asset: TokenFA12 | TokenFA2;
      in_amount: BigNumber;
      rate: BigNumber;
      precision_multiplier: BigNumber;
    }[],
    approve = true
  ): Promise<TransactionOperation> {
    const tokens_info = new MichelsonMap<number, TokenInfo>();
    const input_tokens: Array<FA2TokenType | FA12TokenType> = [];
    for (let i = 0; i < token_info.length; i++) {
      const info = token_info[i];
      if (approve) {
        await info.asset.approve(this.contract.address, info.in_amount);
      }
      const mapped_item = (input: {
        asset: TokenFA12 | TokenFA2;
        in_amount: BigNumber;
        rate: BigNumber;
        precision_multiplier: BigNumber;
      }) => {
        let result: {
          rate: BigNumber;
          precision_multiplier: BigNumber;
          reserves: BigNumber;
        };
        if (input.asset instanceof TokenFA2) {
          input_tokens.push({
            fa2: {
              token_address: input.asset.contract.address,
              token_id: new BigNumber(defaultTokenId),
            },
          });
          result = {
            rate: input.rate,
            precision_multiplier: input.precision_multiplier,
            reserves: input.in_amount,
          };
        } else {
          input_tokens.push({
            fa12: input.asset.contract.address,
          });
          result = {
            rate: input.rate,
            precision_multiplier: input.precision_multiplier,
            reserves: input.in_amount,
          };
        }
        return result;
      };
      tokens_info.set(i, mapped_item(info));
    }
    const operation = await this.contract.methods
      .add_pool(a_const, input_tokens, tokens_info)
      .send();
    await confirmOperation(this.Tezos, operation.hash);
    return operation;
  }

  async swap(
    poolId: BigNumber,
    inIdx: BigNumber,
    toIdx: BigNumber,
    amountIn: BigNumber,
    minAmountOut: BigNumber,
    expiration: Date,
    receiver: string = null,
    referral: string = null
  ): Promise<TransactionOperation> {
    const operation = await this.contract.methods
      .swap(
        poolId,
        inIdx,
        toIdx,
        amountIn,
        minAmountOut,
        new BigNumber(expiration.getTime()),
        receiver,
        referral
      )
      .send();
    await confirmOperation(this.Tezos, operation.hash);
    return operation;
  }

  async investLiquidity(
    poolId: BigNumber,
    tokenAmounts: Map<string, BigNumber>,
    minShares: BigNumber,
    expiration: Date,
    refferal: string
  ): Promise<TransactionOperation> {
    const in_amounts = new MichelsonMap();
    tokenAmounts.forEach((value, key) => {
      in_amounts.set(key, value);
    });
    const operation = await this.contract.methods
      .invest(
        poolId,
        minShares,
        in_amounts,
        new BigNumber(expiration.getTime()),
        refferal
      )
      .send();
    await confirmOperation(this.Tezos, operation.hash);
    return operation;
  }

  async divestLiquidity(
    poolId: BigNumber,
    mintokenAmounts: Map<string, BigNumber>,
    sharesBurned: BigNumber,
    expiration: Date
  ): Promise<TransactionOperation> {
    const amts = new MichelsonMap<string, BigNumber>();
    mintokenAmounts.forEach((value, key) => {
      amts.set(key, value);
    });
    const operation = await this.contract.methods
      .divest(poolId, amts, sharesBurned, new BigNumber(expiration.getTime()))
      .send();
    await confirmOperation(this.Tezos, operation.hash);
    return operation;
  }

  async divestImbalanced(
    poolId: BigNumber,
    tokenAmounts: Map<string, BigNumber>,
    maxSharesBurned: BigNumber,
    expiration: Date,
    referral: string = null
  ): Promise<TransactionOperation> {
    const amts = new MichelsonMap<string, BigNumber>();
    tokenAmounts.forEach((value, key) => {
      amts.set(key, value);
    });

    const operation = await this.contract.methods
      .divest_imbalanced(
        poolId,
        amts,
        maxSharesBurned,
        new BigNumber(expiration.getTime()),
        referral
      )
      .send();
    await confirmOperation(this.Tezos, operation.hash);
    return operation;
  }

  async divestOneCoin(
    poolId: BigNumber,
    sharesBurned: BigNumber,
    tokenIdx: BigNumber,
    mintokenAmount: BigNumber,
    expiration: Date
  ): Promise<TransactionOperation> {
    const operation = await this.contract.methods
      .divest_one_coin(
        poolId,
        sharesBurned,
        tokenIdx,
        mintokenAmount,
        new BigNumber(expiration.getTime())
      )
      .send();
    await confirmOperation(this.Tezos, operation.hash);
    return operation;
  }
  async setAdmin(new_admin: string): Promise<TransactionOperation> {
    await this.updateStorage({});
    const operation = await this.contract.methods.set_admin(new_admin).send();

    await confirmOperation(this.Tezos, operation.hash);
    return operation;
  }
  async addRemManager(
    add: boolean,
    manager: string
  ): Promise<TransactionOperation> {
    await this.updateStorage({});
    const operation = await this.contract.methods
      .add_rem_managers(add, manager)
      .send();
    await confirmOperation(this.Tezos, operation.hash);
    return operation;
  }
  async setDevAddress(dev: string): Promise<TransactionOperation> {
    await this.updateStorage({});
    const operation = await this.contract.methods.set_dev_address(dev).send();

    await confirmOperation(this.Tezos, operation.hash);
    return operation;
  }
  async setFees(
    pool_id: BigNumber,
    fees: FeeType
  ): Promise<TransactionOperation> {
    const operation = await this.contract.methods
      .set_fees(
        pool_id,
        fees.lp_fee,
        fees.stakers_fee,
        fees.ref_fee,
        fees.dev_fee
      )
      .send();

    await confirmOperation(this.Tezos, operation.hash);
    return operation;
  }
  async setDefaultReferral(ref: string): Promise<TransactionOperation> {
    const operation = await this.contract.methods
      .set_default_referral(ref)
      .send();
    await confirmOperation(this.Tezos, operation.hash);
    return operation;
  }

  async approveFA2Token(
    tokenAddress: string,
    tokenId: BigNumber,
    tokenAmount: number,
    address: string
  ): Promise<TransactionOperation> {
    await this.updateStorage();
    const token = await this.Tezos.contract.at(tokenAddress);
    const operation = await token.methods
      .update_operators([
        {
          [tokenAmount ? "add_operator" : "remove_operator"]: {
            owner: await this.Tezos.signer.publicKeyHash(),
            operator: address,
            token_id: tokenId,
          },
        },
      ])
      .send();
    await confirmOperation(this.Tezos, operation.hash);
    return operation;
  }

  async approveFA12Token(
    tokenAddress: string,
    tokenAmount: number,
    address: string
  ): Promise<TransactionOperation> {
    await this.updateStorage();
    const token = await this.Tezos.contract.at(tokenAddress);
    const operation = await token.methods.approve(address, tokenAmount).send();
    await confirmOperation(this.Tezos, operation.hash);
    return operation;
  }

  async setDexFunction(index: number, lambdaName: string): Promise<void> {
    const ligo = getLigo(true);
    const stdout = execSync(
      `${ligo} compile expression pascaligo 'Set_dex_function(record [index =${index}n; func = Bytes.pack(${lambdaName})])' --michelson-format json --init-file $PWD/contracts/main/Dex.ligo`,
      { maxBuffer: 1024 * 500 }
    );
    const operation = await this.Tezos.contract.transfer({
      to: this.contract.address,
      amount: 0,
      parameter: {
        entrypoint: "set_dex_function",
        value: JSON.parse(stdout.toString()).args[0].args[0].args[0].args[0],
      },
    });
    await confirmOperation(this.Tezos, operation.hash);
  }

  async setDexFunctionBatch(
    funcs_map: LambdaFunctionType[] = dexLambdas
  ): Promise<void> {
    let batch = this.Tezos.contract.batch();
    const ligo = getLigo(true);
    for (const lambdaFunction of funcs_map) {
      console.debug(
        `[BATCH:DEX:SETFUNCTION] ${lambdaFunction.index}\t${lambdaFunction.name}`
      );
      const stdout = execSync(
        `${ligo} compile expression pascaligo 'Set_dex_function(record [index =${lambdaFunction.index}n; func = Bytes.pack(${lambdaFunction.name})])' --michelson-format json --init-file $PWD/contracts/main/Dex.ligo`,
        { maxBuffer: 1024 * 500 }
      );
      batch = batch.withTransfer({
        to: this.contract.address,
        amount: 0,
        parameter: {
          entrypoint: "set_dex_function",
          value: JSON.parse(stdout.toString()).args[0].args[0].args[0].args[0],
        },
      });
    }
    const batchOp = await batch.send();
    await confirmOperation(this.Tezos, batchOp.hash);
  }
  async setFunctionBatchCompilled(
    type: "Dex" | "Token" | "Permit" | "Admin",
    batchBy: number,
    comp_funcs_map
  ): Promise<Dex> {
    let batch = this.Tezos.contract.batch();
    let idx = 0;
    for (const lambdaFunction of comp_funcs_map) {
      batch = batch.withTransfer({
        to: this.contract.address,
        amount: 0,
        parameter: {
          entrypoint: `set_${type.toLowerCase()}_function`,
          value: lambdaFunction,
        },
      });
      idx = idx + 1;
      if (idx % batchBy == 0 || idx == comp_funcs_map.length) {
        const batchOp = await batch.send();
        await confirmOperation(this.Tezos, batchOp.hash);
        console.debug(
          `[BATCH:${type.toUpperCase()}:SETFUNCTION] ${idx}/${
            comp_funcs_map.length
          }`,
          batchOp.hash
        );
        if (idx < comp_funcs_map.length) batch = this.Tezos.contract.batch();
      }
    }
    return this;
  }

  async setFunctionCompilled(
    type: "Dex" | "Token" | "Permit" | "Admin",
    comp_funcs_map
  ): Promise<void> {
    let idx = 0;
    for (const lambdaFunction of comp_funcs_map) {
      const op = await this.Tezos.contract.transfer({
        to: this.contract.address,
        amount: 0,
        parameter: {
          entrypoint: `set_${type.toLowerCase()}_function`,
          value: lambdaFunction,
        },
      });
      idx = idx + 1;
      await confirmOperation(this.Tezos, op.hash);
    }
  }

  async setTokenFunction(index: number, lambdaName: string): Promise<void> {
    const ligo = getLigo(true);
    const stdout = execSync(
      `${ligo} compile expression pascaligo 'Set_token_function(record [index =${index}n; func = Bytes.pack(${lambdaName})])' --michelson-format json --init-file $PWD/contracts/main/Dex.ligo`,
      { maxBuffer: 1024 * 500 }
    );
    const operation = await this.Tezos.contract.transfer({
      to: this.contract.address,
      amount: 0,
      parameter: {
        entrypoint: "set_token_function",
        value: JSON.parse(stdout.toString()).args[0].args[0].args[0].args[0],
      },
    });
    await confirmOperation(this.Tezos, operation.hash);
  }

  async setTokenFunctionBatch(
    funcs_map: LambdaFunctionType[] = tokenLambdas
  ): Promise<void> {
    let batch = this.Tezos.contract.batch();
    const ligo = getLigo(true);
    for (const lambdaFunction of funcs_map) {
      console.debug(
        `[BATCH:TOKEN:SETFUNCTION] ${lambdaFunction.index}\t${lambdaFunction.name}`
      );
      const stdout = execSync(
        `${ligo} compile expression pascaligo 'Set_token_function(record [index =${lambdaFunction.index}n; func = Bytes.pack(${lambdaFunction.name})])' --michelson-format json --init-file $PWD/contracts/main/Dex.ligo`,
        { maxBuffer: 1024 * 500 }
      );
      batch = batch.withTransfer({
        to: this.contract.address,
        amount: 0,
        parameter: {
          entrypoint: "set_token_function",
          value: JSON.parse(stdout.toString()).args[0].args[0].args[0].args[0],
        },
      });
    }
    const batchOp = await batch.send();
    await confirmOperation(this.Tezos, batchOp.hash);
  }
}
