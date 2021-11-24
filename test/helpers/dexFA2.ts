import {
  ContractAbstraction,
  ContractProvider,
  MichelsonMap,
  TezosToolkit,
} from "@taquito/taquito";
import { TransactionOperation } from "@taquito/taquito/dist/types/operations/transaction-operation";
import { BigNumber } from "bignumber.js";
import { defaultTokenId, TokenFA2 } from "./tokenFA2";
import {
  DexStorage,
  FA12TokenType,
  FA2TokenType,
  FeeType,
  LambdaFunctionType,
  TokenInfo,
} from "./types";
import { getLigo } from "./utils";
import { execSync } from "child_process";
import { confirmOperation } from "./confirmation";
import { dexLambdas, tokenLambdas } from "../storage/Functions";
import { TokenFA12 } from "./tokenFA12";
import dex_lambdas_comp from "../../build/lambdas/Dex_lambdas.json";
import token_lambdas_comp from "../../build/lambdas/Token_lambdas.json";

const standard = process.env.EXCHANGE_TOKEN_STANDARD;

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
    // await dex.setFunctionBatchCompilled("Token", token_lambdas_comp);
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
    const storage: any = await this.contract.storage();
    this.storage = {
      storage: {
        admin: storage.storage.admin,
        default_referral: storage.storage.default_referral,
        managers: storage.storage.managers,
        dev_address: storage.storage.dev_address,
        reward_rate: storage.storage.reward_rate,
        pools_count: storage.storage.pools_count,
        tokens: {},
        pool_to_id: {},
        pools: {},
        ledger: {},
        account_data: {},
        dev_rewards: {},
        referral_rewards: {},
        stakers_balance: {},
        permits: {},
      },
      dex_lambdas: {},
      token_lambdas: {},
      metadata: {},
      token_metadata: {},
    };
    for (let key in maps) {
      if (["dex_lambdas", "token_lambdas"].includes(key)) continue;
      this.storage.storage[key] = await maps[key].reduce(
        async (prev, current) => {
          try {
            return {
              ...(await prev),
              [key == "ledger" ? current[0] : current]: await storage.storage[
                key
              ].get(current),
            };
          } catch (ex) {
            console.log(ex);
            return {
              ...(await prev),
            };
          }
        },
        Promise.resolve({})
      );
    }
    for (let key in maps) {
      if (!["dex_lambdas", "token_lambdas"].includes(key)) continue;
      this[key] = await maps[key].reduce(async (prev, current) => {
        try {
          return {
            ...(await prev),
            [current]: await storage[key].get(current.toString()),
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
      proxy_limit: BigNumber;
    }[],
    approve: boolean = true
  ): Promise<TransactionOperation> {
    let tokens_info = new MichelsonMap<number, TokenInfo>();
    let input_tokens: Array<FA2TokenType | FA12TokenType> = [];
    for (let i = 0; i < token_info.length; i++) {
      const info = token_info[i];
      if (approve) {
        await info.asset.approve(this.contract.address, info.in_amount);
      }
      let mapped_item = (input: {
        asset: TokenFA12 | TokenFA2;
        in_amount: BigNumber;
        rate: BigNumber;
        precision_multiplier: BigNumber;
        proxy_limit: BigNumber;
      }) => {
        let result: {
          rate: BigNumber;
          proxy_limit: BigNumber;
          precision_multiplier: BigNumber;
          reserves: BigNumber;
          virtual_reserves: BigNumber;
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
            proxy_limit: input.proxy_limit,
            precision_multiplier: input.precision_multiplier,
            reserves: input.in_amount,
            virtual_reserves: input.in_amount,
          };
        } else {
          input_tokens.push({
            fa12: input.asset.contract.address,
          });
          result = {
            rate: input.rate,
            proxy_limit: input.proxy_limit,
            precision_multiplier: input.precision_multiplier,
            reserves: input.in_amount,
            virtual_reserves: input.in_amount,
          };
        }
        return result;
      };
      tokens_info.set(i, mapped_item(info));
    }
    const operation = await this.contract.methods
      .addPair(a_const, input_tokens, tokens_info)
      .send();
    await confirmOperation(this.Tezos, operation.hash);
    return operation;
  }

  // async tokenToTokenRoutePayment(
  //   swaps: SwapSliceType[],
  //   amountIn: number,
  //   minAmountOut: number,
  //   receiver: string,
  //   tokenAid: BigNumber = new BigNumber(0),
  //   tokenBid: BigNumber = new BigNumber(0)
  // ): Promise<TransactionOperation> {
  //   let firstSwap = swaps[0];
  //   if (Object.keys(firstSwap.operation)[0] == "buy") {
  //     if (["FA2"].includes(standard)) {
  //       await this.approveFA2Token(
  //         firstSwap.pair.token_b_address,
  //         tokenBid,
  //         amountIn,
  //         this.contract.address
  //       );
  //     } else {
  //       await this.approveFA12Token(
  //         firstSwap.pair.token_b_address,
  //         amountIn,
  //         this.contract.address
  //       );
  //     }
  //   } else {
  //     if (["FA2", "MIXED"].includes(standard)) {
  //       await this.approveFA2Token(
  //         firstSwap.pair.token_a_address,
  //         tokenAid,
  //         amountIn,
  //         this.contract.address
  //       );
  //     } else {
  //       await this.approveFA12Token(
  //         firstSwap.pair.token_a_address,
  //         amountIn,
  //         this.contract.address
  //       );
  //     }
  //   }
  //   const operation = await this.contract.methods
  //     .use("swap", swaps, amountIn, minAmountOut, receiver)
  //     .send();
  //   await confirmOperation(this.Tezos, operation.hash);
  //   return operation;
  // }

  async swap(
    poolId: BigNumber,
    inIdx: BigNumber,
    toIdx: BigNumber,
    amountIn: BigNumber,
    minAmountOut: BigNumber,
    receiver: string = null,
    referral: string = null
  ): Promise<TransactionOperation> {
    const operation = await this.contract.methods
      .swap(poolId, inIdx, toIdx, amountIn, minAmountOut, receiver, referral)
      .send();
    await confirmOperation(this.Tezos, operation.hash);
    return operation;
  }

  async investLiquidity(
    poolId: BigNumber,
    tokenAmounts: Map<string, BigNumber>,
    minShares: BigNumber,
    refferal: string
  ): Promise<TransactionOperation> {
    let in_amounts = new MichelsonMap();
    tokenAmounts.forEach((value, key) => {
      in_amounts.set(key, value);
    });
    const operation = await this.contract.methods
      .invest(poolId, minShares, in_amounts, refferal)
      .send();
    await confirmOperation(this.Tezos, operation.hash);
    return operation;
  }

  async divestLiquidity(
    pairId: BigNumber,
    mintokenAmounts: Map<string, BigNumber>,
    sharesBurned: BigNumber
  ): Promise<TransactionOperation> {
    const amts = new MichelsonMap<string, BigNumber>();
    mintokenAmounts.forEach((value, key) => {
      amts.set(key, value);
      console.log(key, value);
    });
    const operation = await this.contract.methods
      .divest(pairId, amts, sharesBurned)
      .send();
    await confirmOperation(this.Tezos, operation.hash);
    return operation;
  }

  async divestImbalanced(
    pairId: BigNumber,
    tokenAmounts: Map<string, BigNumber>,
    maxSharesBurned: BigNumber,
    referral: string = null
  ): Promise<TransactionOperation> {
    const amts = new MichelsonMap<string, BigNumber>();
    tokenAmounts.forEach((value, key) => {
      amts.set(key, value);
      console.log(key, value);
    });

    const operation = await this.contract.methods
      .divestImbalanced(pairId, amts, maxSharesBurned, referral)
      .send();
    await confirmOperation(this.Tezos, operation.hash);
    return operation;
  }

  async divestOneCoin(
    pairId: BigNumber,
    sharesBurned: BigNumber,
    tokenIdx: BigNumber,
    mintokenAmount: BigNumber,
  ): Promise<TransactionOperation> {
    const operation = await this.contract.methods
      .divestOneCoin(pairId, sharesBurned, tokenIdx, mintokenAmount)
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
    let token = await this.Tezos.contract.at(tokenAddress);
    let operation = await token.methods
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
    let token = await this.Tezos.contract.at(tokenAddress);
    let operation = await token.methods.approve(address, tokenAmount).send();
    await confirmOperation(this.Tezos, operation.hash);
    return operation;
  }

  async setDexFunction(index: number, lambdaName: string): Promise<void> {
    let ligo = getLigo(true);
    const stdout = execSync(
      `${ligo} compile expression pascaligo 'SetDexFunction(record [index =${index}n; func = Bytes.pack(${lambdaName})])' --michelson-format json --init-file $PWD/contracts/main/Dex.ligo`,
      { maxBuffer: 1024 * 500 }
    );
    const operation = await this.Tezos.contract.transfer({
      to: this.contract.address,
      amount: 0,
      parameter: {
        entrypoint: "setDexFunction",
        value: JSON.parse(stdout.toString()).args[0].args[0].args[0].args[0],
      },
    });
    await confirmOperation(this.Tezos, operation.hash);
  }

  async setDexFunctionBatch(
    funcs_map: LambdaFunctionType[] = dexLambdas
  ): Promise<void> {
    let batch = this.Tezos.contract.batch();
    let ligo = getLigo(true);
    for (const lambdaFunction of funcs_map) {
      console.log(`${lambdaFunction.index}\t${lambdaFunction.name}`);
      const stdout = execSync(
        `${ligo} compile expression pascaligo 'SetDexFunction(record [index =${lambdaFunction.index}n; func = Bytes.pack(${lambdaFunction.name})])' --michelson-format json --init-file $PWD/contracts/main/Dex.ligo`,
        { maxBuffer: 1024 * 500 }
      );
      batch = batch.withTransfer({
        to: this.contract.address,
        amount: 0,
        parameter: {
          entrypoint: "setDexFunction",
          value: JSON.parse(stdout.toString()).args[0].args[0].args[0].args[0],
        },
      });
    }
    const batchOp = await batch.send();
    await confirmOperation(this.Tezos, batchOp.hash);
  }
  async setFunctionBatchCompilled(
    type: "Dex" | "Token",
    batchBy: number,
    comp_funcs_map
  ): Promise<void> {
    let batch = this.Tezos.contract.batch();
    let idx = 0;
    for (const lambdaFunction of comp_funcs_map) {
      batch = batch.withTransfer({
        to: this.contract.address,
        amount: 0,
        parameter: {
          entrypoint: `set${type}Function`,
          value: lambdaFunction,
        },
      });
      idx = idx + 1;
      console.log(idx, type, lambdaFunction.args[1].int);
      if (idx % batchBy == 0 || idx == comp_funcs_map.length) {
        const batchOp = await batch.send();
        console.log(`${idx}/${comp_funcs_map.length}`, batchOp.hash);
        await confirmOperation(this.Tezos, batchOp.hash);
        console.log(`Confirmed`);
        if (idx < comp_funcs_map.length) batch = this.Tezos.contract.batch();
      }
    }
  }

  async setFunctionCompilled(
    type: "Dex" | "Token",
    comp_funcs_map
  ): Promise<void> {
    let idx = 0;
    for (const lambdaFunction of comp_funcs_map) {
      const op = await this.Tezos.contract.transfer({
        to: this.contract.address,
        amount: 0,
        parameter: {
          entrypoint: `set${type}Function`,
          value: lambdaFunction,
        },
      });
      idx = idx + 1;
      console.log(idx, type, lambdaFunction.args[1].int);
      await confirmOperation(this.Tezos, op.hash);
      console.log(op.hash);
    }
  }

  async setTokenFunction(index: number, lambdaName: string): Promise<void> {
    let ligo = getLigo(true);
    const stdout = execSync(
      `${ligo} compile expression pascaligo 'SetTokenFunction(record [index =${index}n; func = Bytes.pack(${lambdaName})])' --michelson-format json --init-file $PWD/contracts/main/Dex.ligo`,
      { maxBuffer: 1024 * 500 }
    );
    const operation = await this.Tezos.contract.transfer({
      to: this.contract.address,
      amount: 0,
      parameter: {
        entrypoint: "setTokenFunction",
        value: JSON.parse(stdout.toString()).args[0].args[0].args[0].args[0],
      },
    });
    await confirmOperation(this.Tezos, operation.hash);
  }

  async setTokenFunctionBatch(
    funcs_map: LambdaFunctionType[] = tokenLambdas
  ): Promise<void> {
    let batch = this.Tezos.contract.batch();
    let ligo = getLigo(true);
    for (const lambdaFunction of funcs_map) {
      console.log(`${lambdaFunction.index}\t${lambdaFunction.name}`);
      const stdout = execSync(
        `${ligo} compile expression pascaligo 'SetTokenFunction(record [index =${lambdaFunction.index}n; func = Bytes.pack(${lambdaFunction.name})])' --michelson-format json --init-file $PWD/contracts/main/Dex.ligo`,
        { maxBuffer: 1024 * 500 }
      );
      batch = batch.withTransfer({
        to: this.contract.address,
        amount: 0,
        parameter: {
          entrypoint: "setTokenFunction",
          value: JSON.parse(stdout.toString()).args[0].args[0].args[0].args[0],
        },
      });
    }
    const batchOp = await batch.send();
    await confirmOperation(this.Tezos, batchOp.hash);
  }

  async setAdmin(new_admin: string): Promise<TransactionOperation> {
    await this.updateStorage({});
    const operation = await this.contract.methods.setAdmin(new_admin).send();

    await confirmOperation(this.Tezos, operation.hash);
    return operation;
  }
  async addRemManager(
    add: boolean,
    manager: string
  ): Promise<TransactionOperation> {
    await this.updateStorage({});
    const operation = await this.contract.methods
      .addRemManagers(add, manager)
      .send();
    await confirmOperation(this.Tezos, operation.hash);
    return operation;
  }
  async setDevAddress(dev: string): Promise<TransactionOperation> {
    await this.updateStorage({});
    const operation = await this.contract.methods.setDevAddress(dev).send();

    await confirmOperation(this.Tezos, operation.hash);
    return operation;
  }
  async setFees(
    pool_id: BigNumber,
    fees: FeeType
  ): Promise<TransactionOperation> {
    const operation = await this.contract.methods
      .setFees(
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
      .setDefaultReferral(ref)
      .send();
    await confirmOperation(this.Tezos, operation.hash);
    return operation;
  }
}
