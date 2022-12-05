import {
  ContractAbstraction,
  ContractProvider,
  MichelsonMap,
  TezosToolkit,
} from "@taquito/taquito";
import { TransactionOperation } from "@taquito/taquito/dist/types/operations/transaction-operation";
import { BigNumber } from "bignumber.js";
import { DexStorage, FeeType, TokenInfo } from "./types";
import {
  FA12TokenType,
  FA2TokenType,
  getLigo,
  setFunctionBatchCompilled,
  TezosAddress,
} from "../../../utils/helpers";
import { execSync } from "child_process";
import { confirmOperation } from "../../../utils/confirmation";
import { dexLambdas, tokenLambdas } from "../../storage/Functions";
import admin_lambdas_comp from "../../../build/lambdas/test/Admin_lambdas.json";
import dex_lambdas_comp from "../../../build/lambdas/test/Dex_lambdas.json";
import dev_lambdas_comp from "../../../build/lambdas/test/Dev_lambdas.json";
import strat_lambdas_comp from "../../../build/lambdas/test/Strategy_lambdas.json";
import token_lambdas_comp from "../../../build/lambdas/test/Token_lambdas.json";
import { defaultTokenId, TokenFA12, TokenFA2 } from "../../Token";
import { DevEnabledContract } from "../../Developer/API/devAPI";
import { StrategyFactorySetter } from "../../Strategy/API/strategyFactoryMethod";

export class Dex
  extends TokenFA2
  implements DevEnabledContract, StrategyFactorySetter
{
  public contract: ContractAbstraction<ContractProvider>;
  public storage: DexStorage;

  constructor(
    tezos: TezosToolkit,
    contract: ContractAbstraction<ContractProvider>
  ) {
    super(tezos, contract);
  }

  static async init(
    tezos: TezosToolkit,
    dexAddress: string,
    fromFactory = false
  ): Promise<Dex> {
    const dex = new Dex(tezos, await tezos.contract.at(dexAddress));
    // await dex.setFunctionBatchCompilled("Admin", 4, admin_lambdas_comp);
    // await dex.setFunctionBatchCompilled("Dev", 2, token_lambdas_comp);
    if (!fromFactory) {
      await setFunctionBatchCompilled(
        tezos,
        dexAddress,
        "Admin",
        9,
        admin_lambdas_comp
      );
      await setFunctionBatchCompilled(
        tezos,
        dexAddress,
        "Token",
        3,
        token_lambdas_comp
      );
      await setFunctionBatchCompilled(
        tezos,
        dexAddress,
        "Dex",
        3,
        dex_lambdas_comp
      );
      await setFunctionBatchCompilled(
        tezos,
        dexAddress,
        "Strategy",
        3,
        strat_lambdas_comp
      );
    }
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
          "strat_lambdas",
        ].includes(key)
      )
        continue;
      this.storage.storage[key] = await maps[key].reduce(
        async (prev, current) => {
          try {
            return {
              ...(await prev),
              [key == "ledger" || key == "configuration"
                ? current[0]
                : current]: await this.storage.storage[key].get(current),
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
          "strat_lambdas",
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

  async addPool(
    aConst: BigNumber = new BigNumber("100000"),
    tokenInfo: {
      asset: TokenFA12 | TokenFA2;
      in_amount: BigNumber;
      rate_f: BigNumber;
      precision_multiplier_f: BigNumber;
    }[],
    approve = true
  ): Promise<TransactionOperation> {
    const tokens_info = new MichelsonMap<
      number,
      {
        rate_f: string;
        precision_multiplier_f: string;
        reserves: string;
      }
    >();
    const input_tokens: Array<FA2TokenType | FA12TokenType> = [];
    for (let i = 0; i < tokenInfo.length; i++) {
      const info = tokenInfo[i];
      if (approve) {
        await info.asset.approve(this.contract.address, info.in_amount);
      }
      const mapped_item = (input: {
        asset: TokenFA12 | TokenFA2;
        in_amount: BigNumber;
        rate_f: BigNumber;
        precision_multiplier_f: BigNumber;
      }) => {
        let result: {
          rate_f: string;
          precision_multiplier_f: string;
          reserves: string;
        };
        if (input.asset instanceof TokenFA2) {
          input_tokens.push({
            fa2: {
              token_address: input.asset.contract.address,
              token_id: new BigNumber(defaultTokenId),
            },
          });
          result = {
            rate_f: input.rate_f.toString(),
            precision_multiplier_f: input.precision_multiplier_f.toString(),
            reserves: input.in_amount.toString(),
          };
        } else {
          input_tokens.push({
            fa12: input.asset.contract.address,
          });
          result = {
            rate_f: input.rate_f.toString(),
            precision_multiplier_f: input.precision_multiplier_f.toString(),
            reserves: input.in_amount.toString(),
          };
        }
        return result;
      };
      tokens_info.set(i, mapped_item(info));
    }
    const operation = await this.contract.methodsObject
      .add_pool({
        a_constant: aConst.toString(),
        input_tokens: input_tokens,
        tokens_info,
        fees: {
          lp_f: "0",
          stakers_f: "0",
          ref_f: "0",
        },
      })
      .send();
    await operation.confirmation(2);
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
    const operation = await this.contract.methodsObject
      .swap({
        pool_id: poolId.toString(),
        idx_from: inIdx.toString(),
        idx_to: toIdx.toString(),
        amount: amountIn.toString(),
        min_amount_out: minAmountOut.toString(),
        deadline: new BigNumber(expiration.getTime())
          .dividedToIntegerBy(1000)
          .toString(),
        receiver: receiver,
        referral: referral,
      })
      .send();
    await operation.confirmation(2);
    return operation;
  }

  async investLiquidity(
    poolId: BigNumber,
    tokenAmounts: Map<string, BigNumber>,
    minShares: BigNumber,
    expiration: Date,
    receiver: TezosAddress = null,
    referral: TezosAddress = null
  ): Promise<TransactionOperation> {
    const in_amounts = new MichelsonMap();
    tokenAmounts.forEach((value, key) => {
      in_amounts.set(key, value.toString());
    });
    const operation = await this.contract.methodsObject
      .invest({
        pool_id: poolId.toString(),
        shares: minShares.toString(),
        in_amounts: in_amounts,
        deadline: expiration.toISOString(),
        receiver: receiver,
        referral: referral,
      })
      .send();
    await operation.confirmation(2);
    return operation;
  }

  async divestLiquidity(
    poolId: BigNumber,
    mintokenAmounts: Map<string, BigNumber>,
    sharesBurned: BigNumber,
    expiration: Date,
    receiver: TezosAddress = null
  ): Promise<TransactionOperation> {
    const amts = new MichelsonMap<string, string>();
    mintokenAmounts.forEach((value, key) => {
      amts.set(key, value.toString());
    });
    const operation = await this.contract.methodsObject
      .divest({
        pool_id: poolId.toString(),
        min_amounts_out: amts,
        shares: sharesBurned.toString(),
        deadline: new BigNumber(expiration.getTime())
          .dividedToIntegerBy(1000)
          .toString(),
        receiver: receiver,
      })
      .send();
    await operation.confirmation(2);
    return operation;
  }

  async divestImbalanced(
    poolId: BigNumber,
    tokenAmounts: Map<string, BigNumber>,
    maxSharesBurned: BigNumber,
    expiration: Date,
    receiver: TezosAddress = null,
    referral: TezosAddress = null
  ): Promise<TransactionOperation> {
    const amts = new MichelsonMap<string, BigNumber>();
    tokenAmounts.forEach((value, key) => {
      amts.set(key, value);
    });

    const operation = await this.contract.methodsObject
      .divest_imbalanced({
        pool_id: poolId.toString(),
        amounts_out: amts,
        max_shares: maxSharesBurned.toString(),
        deadline: new BigNumber(expiration.getTime())
          .dividedToIntegerBy(1000)
          .toString(),
        receiver: receiver,
        referral: referral,
      })
      .send();
    await operation.confirmation(2);
    return operation;
  }

  async divestOneCoin(
    poolId: BigNumber,
    sharesBurned: BigNumber,
    tokenIdx: BigNumber,
    mintokenAmount: BigNumber,
    expiration: Date,
    receiver: TezosAddress = null,
    referral: TezosAddress = null
  ): Promise<TransactionOperation> {
    const operation = await this.contract.methodsObject
      .divest_one_coin({
        pool_id: poolId.toString(),
        shares: sharesBurned.toString(),
        token_index: tokenIdx.toString(),
        min_amount_out: mintokenAmount.toString(),
        deadline: new BigNumber(expiration.getTime())
          .dividedToIntegerBy(1000)
          .toString(),
        receiver: receiver,
        referral: referral,
      })
      .send();
    await operation.confirmation(2);
    return operation;
  }
  async setAdmin(newAdmin: string): Promise<TransactionOperation> {
    await this.updateStorage({});
    const operation = await this.contract.methods.set_admin(newAdmin).send();

    await operation.confirmation(2);
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
    await operation.confirmation(2);
    return operation;
  }
  async setDevAddress(dev: string): Promise<TransactionOperation> {
    await this.updateStorage({});
    const operation = await this.contract.methods.set_dev_address(dev).send();

    await operation.confirmation(2);
    return operation;
  }

  async connectStrategy(
    poolId: BigNumber,
    strategy: string | null = null
  ): Promise<TransactionOperation> {
    await this.updateStorage({});
    const operation = await this.contract.methods
      .connect_strategy(poolId, strategy)
      .send();

    await operation.confirmation(2);
    // await confirmOperation(tezos, operation.hash);
    return operation;
  }

  async setTokenStrategy(
    poolId: BigNumber,
    poolTokenId: BigNumber,
    desiredReservesRate_f: BigNumber,
    deltaRate_f: BigNumber,
    minInvestment: BigNumber
  ): Promise<TransactionOperation> {
    await this.updateStorage({});
    const operation = await this.contract.methodsObject
      .set_token_strategy({
        pool_id: poolId.toString(),
        pool_token_id: poolTokenId.toString(),
        des_reserves_rate_f: desiredReservesRate_f.toString(),
        delta_rate_f: deltaRate_f.toString(),
        min_invest: minInvestment.toString(),
      })
      .send();

    await operation.confirmation(2);
    // await confirmOperation(tezos, operation.hash);
    return operation;
  }

  async setTokenStrategyRebalance(
    poolId: BigNumber,
    poolTokenId: BigNumber,
    flag: boolean
  ): Promise<TransactionOperation> {
    await this.updateStorage({});
    const operation = await this.contract.methods
      .set_token_strategy_rebalance(
        poolId.toString(),
        poolTokenId.toString(),
        flag
      )
      .send();

    await operation.confirmation(2);
    // await confirmOperation(tezos, operation.hash);
    return operation;
  }

  setIsRebalanceStrategy = (
    poolId: BigNumber,
    poolTokenId: BigNumber,
    flag: boolean
  ): Promise<TransactionOperation> =>
    this.setTokenStrategyRebalance(poolId, poolTokenId, flag);

  async rebalance(
    poolId: BigNumber,
    poolTokenIds: Set<BigNumber>
  ): Promise<TransactionOperation> {
    await this.updateStorage({});
    const operation = await this.contract.methods
      .rebalance(
        poolId.toString(),
        Array.from(poolTokenIds).map((x) => x.toNumber())
      )
      .send();

    await operation.confirmation(2);
    // await confirmOperation(tezos, operation.hash);
    return operation;
  }

  manualRebalanceStrategy = (
    poolId: BigNumber,
    poolTokenIds: Set<BigNumber>
  ): Promise<TransactionOperation> => this.rebalance(poolId, poolTokenIds);

  async connectTokenStrategy(
    poolId: BigNumber,
    poolTokenId: BigNumber,
    lendingMarketId: BigNumber
  ): Promise<TransactionOperation> {
    await this.updateStorage({});
    const operation = await this.contract.methodsObject
      .connect_token_strategy({
        pool_id: poolId.toString(),
        pool_token_id: poolTokenId.toString(),
        lending_market_id: lendingMarketId.toString(),
      })
      .send();

    await operation.confirmation(2);
    // await confirmOperation(tezos, operation.hash);
    return operation;
  }

  async setFees(
    pool_id: BigNumber,
    fees: FeeType
  ): Promise<TransactionOperation> {
    const operation = await this.contract.methods
      .set_fees(pool_id, fees.lp_f, fees.stakers_f, fees.ref_f)
      .send();

    await operation.confirmation(2);
    return operation;
  }

  async setDevFee(fee: BigNumber): Promise<TransactionOperation> {
    const operation = await this.contract.methods.set_dev_fee(fee).send();
    await operation.confirmation(2);
    return operation;
  }
  async setDefaultReferral(ref: string): Promise<TransactionOperation> {
    const operation = await this.contract.methods
      .set_default_referral(ref)
      .send();
    await operation.confirmation(2);
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
    await operation.confirmation(2);
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
    await operation.confirmation(2);
    return operation;
  }

  async manageStrategyFactories(
    strategy_factory: string,
    add: boolean
  ): Promise<TransactionOperation> {
    const op = await this.contract.methods
      .set_strategy_factory(add, strategy_factory)
      .send();
    await op.confirmation(2);
    return op;
  }
  async addStrategyFactory(
    strategy_factory: string
  ): Promise<TransactionOperation> {
    return this.manageStrategyFactories(strategy_factory, true);
  }
  async removeStrategyFactory(
    strategy_factory: string
  ): Promise<TransactionOperation> {
    return this.manageStrategyFactories(strategy_factory, false);
  }
}
