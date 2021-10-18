import { ContractAbstraction, ContractProvider } from "@taquito/taquito";
import { BatchOperation } from "@taquito/taquito/dist/types/operations/batch-operation";
import { TransactionOperation } from "@taquito/taquito/dist/types/operations/transaction-operation";
import { BigNumber } from "bignumber.js";
import { TokenFA2 } from "./tokenFA2";
import { DexStorage, FeeType, LambdaFunctionType, SwapSliceType } from "./types";
import { getLigo } from "./utils";
import { execSync } from "child_process";
import { confirmOperation } from "./confirmation";
import { dexLambdas, tokenLambdas } from "../storage/Functions";


const standard = process.env.EXCHANGE_TOKEN_STANDARD;

export class Dex extends TokenFA2 {
  public contract: ContractAbstraction<ContractProvider>;
  public storage: DexStorage;

  constructor(contract: ContractAbstraction<ContractProvider>) {
    super(contract);
  }

  static async init(dexAddress: string): Promise<Dex> {
    const dex = new Dex(await global.Tezos.contract.at(dexAddress));
    console.log("Lambdas");
    await dex.setTokenFunctionBatch();
    await dex.setDexFunctionBatch();
    console.log("Lambdas set.");
    return dex
  }

  async updateStorage(
    maps: {
      tokens?: string[];
      token_to_id?: string[];
      pairs?: string[];
      ledger?: any[];
      dex_lambdas?: number[];
      token_lambdas?: number[];
    } = {}
  ): Promise<void> {
    const storage: any = await this.contract.storage();
    this.storage = {
      storage: {
        admin: storage.storage.admin,
        managers: storage.storage.managers,
        dev_address: storage.storage.dev_address,
        reward_rate: storage.storage.reward_rate,
        pools_count: storage.storage.pairs_count,
        tokens: {},
        pool_to_id: {},
        pools: {},
        ledger: {},
        allowances: {},
        dev_rewards: {},
        referral_rewards: {},
        stakers_balance: {},
        pool_interest_rewards: {},
        providers_rewards: {},
        permits: {},
      },
      dex_lambdas: {},
      token_lambdas: {},
      ledger: {},
      metadata: {},
      token_metadata: {},
    };
    for (let key in maps) {
      if (["dex_lambdas", "token_lambdas"].includes(key)) continue;
      this.storage[key] = await maps[key].reduce(async (prev, current) => {
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
      }, Promise.resolve({}));
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
    tokenAAddress: string,
    tokenBAddress: string,
    tokenAAmount: number,
    tokenBAmount: number,
    tokenAid: BigNumber = new BigNumber(0),
    tokenBid: BigNumber = new BigNumber(0),
    approve: boolean = true
  ): Promise<TransactionOperation> {
    if (approve) {
      if (["FA2", "MIXED"].includes(standard)) {
        await this.approveFA2Token(
          tokenAAddress,
          tokenAid,
          tokenAAmount,
          this.contract.address
        );
      } else {
        await this.approveFA12Token(
          tokenAAddress,
          tokenAAmount,
          this.contract.address
        );
      }
      if ("FA2" == standard) {
        await this.approveFA2Token(
          tokenBAddress,
          tokenBid,
          tokenBAmount,
          this.contract.address
        );
      } else {
        await this.approveFA12Token(
          tokenBAddress,
          tokenBAmount,
          this.contract.address
        );
      }
    }

    const operation = await this.contract.methods
      .use(
        "addPair",
        tokenAAddress,
        tokenAid,
        standard.toLowerCase() == "mixed" ? "fa2" : standard.toLowerCase(),
        null,
        tokenBAddress,
        tokenBid,
        standard.toLowerCase() == "mixed" ? "fa12" : standard.toLowerCase(),
        null,
        tokenAAmount,
        tokenBAmount
      )
      .send();
    await confirmOperation(global.Tezos, operation.hash);
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
  //   await confirmOperation(global.Tezos, operation.hash);
  //   return operation;
  // }

  // async tokenToTokenPayment(
  //   tokenAAddress: string,
  //   tokenBAddress: string,
  //   opType: string,
  //   amountIn: number,
  //   minAmountOut: number,
  //   receiver: string,
  //   tokenAid: BigNumber = new BigNumber(0),
  //   tokenBid: BigNumber = new BigNumber(0)
  // ): Promise<TransactionOperation> {
  //   if (opType == "buy") {
  //     if (["FA2"].includes(standard)) {
  //       await this.approveFA2Token(
  //         tokenBAddress,
  //         tokenBid,
  //         amountIn,
  //         this.contract.address
  //       );
  //     } else {
  //       await this.approveFA12Token(
  //         tokenBAddress,
  //         amountIn,
  //         this.contract.address
  //       );
  //     }
  //   } else {
  //     if (["FA2", "MIXED"].includes(standard)) {
  //       await this.approveFA2Token(
  //         tokenAAddress,
  //         tokenAid,
  //         amountIn,
  //         this.contract.address
  //       );
  //     } else {
  //       await this.approveFA12Token(
  //         tokenAAddress,
  //         amountIn,
  //         this.contract.address
  //       );
  //     }
  //   }
  //   const swaps = [
  //     {
  //       pair: {
  //         token_a_address: tokenAAddress,
  //         token_b_address: tokenBAddress,
  //         token_a_id: tokenAid,
  //         token_b_id: tokenBid,
  //         token_a_type: {
  //           [standard.toLowerCase() == "mixed"
  //             ? "fa2"
  //             : standard.toLowerCase()]: null,
  //         },
  //         token_b_type: {
  //           [standard.toLowerCase() == "mixed"
  //             ? "fa12"
  //             : standard.toLowerCase()]: null,
  //         },
  //       },
  //       operation: { [opType]: null },
  //     },
  //   ];
  //   const operation = await this.contract.methods
  //     .use("swap", swaps, amountIn, minAmountOut, receiver)
  //     .send();
  //   await confirmOperation(global.Tezos, operation.hash);
  //   return operation;
  // }

  async investLiquidity(
    pairId: string,
    tokenAmounts: Map<BigNumber, BigNumber>,
    minShares: number,
    refferal: string
  ): Promise<TransactionOperation> {
    await this.updateStorage({ tokens: [pairId] });
    let pair = this.storage.storage.tokens[pairId];
    if (["FA2", "MIXED"].includes(standard)) {
      await this.approveFA2Token(
        pair.token_a_address,
        pair.token_a_id,

        tokenAAmount,
        this.contract.address
      );
    } else {
      await this.approveFA12Token(
        pair.token_a_address,
        tokenAAmount,
        this.contract.address
      );
    }
    if ("FA2" == standard) {
      await this.approveFA2Token(
        pair.token_b_address,
        pair.token_b_id,
        tokenBAmount,
        this.contract.address
      );
    } else {
      await this.approveFA12Token(
        pair.token_b_address,
        tokenBAmount,
        this.contract.address
      );
    }
    const operation = await this.contract.methods
      .use(
        "invest",
        pair.token_a_address,
        pair.token_a_id,
        standard.toLowerCase() == "mixed" ? "fa2" : standard.toLowerCase(),
        null,
        pair.token_b_address,
        pair.token_b_id,
        standard.toLowerCase() == "mixed" ? "fa12" : standard.toLowerCase(),
        null,
        minShares,
        tokenAAmount,
        tokenBAmount
      )
      .send();
    await confirmOperation(global.Tezos, operation.hash);
    return operation;
  }

  // async divestLiquidity(
  //   pairId: string,
  //   tokenAAmount: number,
  //   tokenBAmount: number,
  //   sharesBurned: number
  // ): Promise<TransactionOperation> {
  //   await this.updateStorage({ tokens: [pairId] });
  //   let pair = this.storage.storage.tokens[pairId];
  //   const operation = await this.contract.methods
  //     .use(
  //       "divest",
  //       pair.token_a_address,
  //       pair.token_a_id,
  //       standard.toLowerCase() == "mixed" ? "fa2" : standard.toLowerCase(),
  //       null,
  //       pair.token_b_address,
  //       pair.token_b_id,
  //       standard.toLowerCase() == "mixed" ? "fa12" : standard.toLowerCase(),
  //       null,
  //       tokenAAmount,
  //       tokenBAmount,
  //       sharesBurned
  //     )
  //     .send();
  //   await confirmOperation(global.Tezos, operation.hash);
  //   return operation;
  // }

  async approveFA2Token(
    tokenAddress: string,
    tokenId: BigNumber,
    tokenAmount: number,
    address: string
  ): Promise<TransactionOperation> {
    await this.updateStorage();
    let token = await global.Tezos.contract.at(tokenAddress);
    let operation = await token.methods
      .update_operators([
        {
          [tokenAmount ? "add_operator" : "remove_operator"]: {
            owner: await global.Tezos.signer.publicKeyHash(),
            operator: address,
            token_id: tokenId,
          },
        },
      ])
      .send();
    await confirmOperation(global.Tezos, operation.hash);
    return operation;
  }

  async approveFA12Token(
    tokenAddress: string,
    tokenAmount: number,
    address: string
  ): Promise<TransactionOperation> {
    await this.updateStorage();
    let token = await global.Tezos.contract.at(tokenAddress);
    let operation = await token.methods.approve(address, tokenAmount).send();
    await confirmOperation(global.Tezos, operation.hash);
    return operation;
  }

  async setDexFunction(index: number, lambdaName: string): Promise<void> {
    let ligo = getLigo(true);
    const stdout = execSync(
      `${ligo} compile-parameter --michelson-format=json $PWD/contracts/main/Dex.ligo main 'SetDexFunction(record index =${index}n; func = ${lambdaName}; end)'`,
      { maxBuffer: 1024 * 500 }
    );
    const operation = await global.Tezos.contract.transfer({
      to: this.contract.address,
      amount: 0,
      parameter: {
        entrypoint: "setDexFunction",
        value: JSON.parse(stdout.toString()).args[0].args[0].args[0].args[0],
      },
    });
    await confirmOperation(global.Tezos, operation.hash);
  }

  async setDexFunctionBatch(
    funcs_map: LambdaFunctionType[] = dexLambdas
  ): Promise<void> {
    let batch = await global.Tezos.contract.batch();
    let ligo = getLigo(true);
    for (const lambdaFunction of funcs_map) {
      console.log(`${lambdaFunction.index}\t${lambdaFunction.name}`);
      const stdout = execSync(
        `${ligo} compile-parameter --michelson-format=json $PWD/contracts/main/Dex.ligo main 'SetDexFunction(record [index =${lambdaFunction.index}n; func = Bytes.pack(${lambdaFunction.name});])'`,
        { maxBuffer: 1024 * 500 }
      );
      console.log(stdout.toString());
      batch = batch.withTransfer({
        to: this.contract.address,
        amount: 0,
        parameter: {
          entrypoint: "setDexFunction",
          value: Buffer.from(
            JSON.parse(stdout.toString()).args[0].args[0].args[0].args[0],
            "ascii"
          ).toString("hex"),
        },
      });
    }
    const batchOp = await batch.send();
    await confirmOperation(global.Tezos, batchOp.hash);
  }

  async setTokenFunction(index: number, lambdaName: string): Promise<void> {
    let ligo = getLigo(true);
    const stdout = execSync(
      `${ligo} compile-parameter --michelson-format=json $PWD/contracts/main/Dex.ligo main 'SetTokenFunction(record [index =${index}n; func = Bytes.pack(${lambdaName})])'`,
      { maxBuffer: 1024 * 500 }
    );
    const operation = await global.Tezos.contract.transfer({
      to: this.contract.address,
      amount: 0,
      parameter: {
        entrypoint: "setTokenFunction",
        value: JSON.parse(stdout.toString()).args[0].args[0].args[0].args[0],
      },
    });
    await confirmOperation(global.Tezos, operation.hash);
  }

  async setTokenFunctionBatch(
    funcs_map: LambdaFunctionType[] = tokenLambdas
  ): Promise<void> {
    let batch = await global.Tezos.contract.batch();
    let ligo = getLigo(true);
    for (const lambdaFunction of funcs_map) {
      console.log(`${lambdaFunction.index}\t${lambdaFunction.name}`);
      const stdout = execSync(
        `${ligo} compile-parameter --michelson-format=json $PWD/contracts/main/Dex.ligo main 'SetTokenFunction(record [index =${lambdaFunction.index}n; func = Bytes.pack(${lambdaFunction.name})])'`,
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
    await confirmOperation(global.Tezos, batchOp.hash);
  }

  async setAdmin(new_admin: string): Promise<TransactionOperation> {
    await this.updateStorage({});
    console.log(global.Tezos);
    console.log(this.storage);
    const operation = await this.contract.methods.set_admin(new_admin).send();
    console.log(operation.hash);
    await confirmOperation(global.Tezos, operation.hash);
    return operation;
  }
  async addRemManager(
    add: boolean,
    manager: string
  ): Promise<TransactionOperation> {
    await this.updateStorage({});
    console.log(global.Tezos);
    console.log(this.storage);
    const operation = await this.contract.methods
      .addRemManagers(add, manager)
      .send();
    console.log(operation.hash);
    await confirmOperation(global.Tezos, operation.hash);
    return operation;
  }
  async setDevAddress(dev: string): Promise<TransactionOperation> {
    await this.updateStorage({});
    console.log(global.Tezos);
    console.log(this.storage);
    const operation = await this.contract.methods.set_dev_address(dev).send();
    console.log(operation.hash);
    await confirmOperation(global.Tezos, operation.hash);
    return operation;
  }
  async togglePubInit(): Promise<TransactionOperation> {
    await this.updateStorage({});
    console.log(global.Tezos);
    console.log(this.storage);
    const operation = await this.contract.methods.set_public_init(null).send();
    console.log(operation.hash);
    await confirmOperation(global.Tezos, operation.hash);
    return operation;
  }
  async setFees(pool_id: BigNumber, fees: FeeType): Promise<TransactionOperation> {
    await this.updateStorage({});
    const params = {
      pair_id: pool_id,
      fee: fees,
    };
    console.log(global.Tezos);
    console.log(this.storage);
    const operation = await this.contract.methods
      .set_fees(params)
      .send();
    console.log(operation.hash);
    await confirmOperation(global.Tezos, operation.hash);
    return operation;
  }
}
