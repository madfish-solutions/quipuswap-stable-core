import {
  ContractAbstraction,
  ContractProvider,
  MichelsonMap,
  TezosToolkit,
  TransactionOperation,
} from "@taquito/taquito";
import {
  BytesString,
  FA12TokenType,
  FA2TokenType,
  setFunctionBatchCompilled,
  TezosAddress,
} from "../../../utils/helpers";
import { FactoryStorage } from "./types";
import admin_lambdas_comp from "../../../build/lambdas/factory/Admin_lambdas.json";
import dex_lambdas_comp from "../../../build/lambdas/factory/Dex_lambdas.json";
import token_lambdas_comp from "../../../build/lambdas/factory/Token_lambdas.json";
import strat_lambdas_comp from "../../../build/lambdas/test/Strategy_lambdas.json";
import { confirmOperation } from "../../../utils/confirmation";
import BigNumber from "bignumber.js";
import { defaultTokenId, TokenFA12, TokenFA2 } from "../../Token";
import { FeeType, TokenInfo } from "../../Dex/API/types";
import fs from "fs";
import { DevEnabledContract } from "../../Developer/API/devAPI";
import { StrategyFactorySetter } from "../../Strategy/API/strategyFactoryMethod";
const init_func_bytes = fs
  .readFileSync("./build/lambdas/factory/add_pool.txt")
  .toString();

export class DexFactory implements DevEnabledContract, StrategyFactorySetter {
  public contract: ContractAbstraction<ContractProvider>;
  public storage: FactoryStorage;

  constructor(contract: ContractAbstraction<ContractProvider>) {
    this.contract = contract;
  }
  static async init(
    tezos: TezosToolkit,
    factoryAddress: string
  ): Promise<DexFactory> {
    const factory = new DexFactory(await tezos.contract.at(factoryAddress));
    const op = await factory.contract.methods
      .set_init_function(init_func_bytes)
      .send();
    await op.confirmation(2);
    await setFunctionBatchCompilled(
      tezos,
      factoryAddress,
      "Admin",
      8,
      admin_lambdas_comp.filter((value) => value.args[1].int !== "8")
    );
    // await setFunctionBatchCompilled(
    //   tezos,
    //   factoryAddress,
    //   "Dev",
    //   2,
    //   dev_lambdas_comp
    // );
    await setFunctionBatchCompilled(
      tezos,
      factoryAddress,
      "Token",
      3,
      token_lambdas_comp
    );
    await setFunctionBatchCompilled(
      tezos,
      factoryAddress,
      "Dex",
      3,
      dex_lambdas_comp
    );
    await setFunctionBatchCompilled(
      tezos,
      factoryAddress,
      "Strategy",
      3,
      strat_lambdas_comp
    );
    await factory.updateStorage();
    return factory;
  }

  async updateStorage(
    maps: {
      pool_to_address?: BytesString[];
    } = {}
  ): Promise<void> {
    this.storage = (await this.contract.storage()) as FactoryStorage;
    for (const key in maps) {
      if (
        [
          "dex_lambdas",
          // "dev_lambdas",
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
              [current]: await this.storage.storage[key].get(current),
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
          // "dev_lambdas",
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

  async setDevAddress(
    dev: string,
    tezos: TezosToolkit
  ): Promise<TransactionOperation> {
    await this.updateStorage({});
    const operation = await this.contract.methods.set_dev_address(dev).send();

    await operation.confirmation(2);
    return operation;
  }

  async setDevFee(
    fee: BigNumber,
    tezos: TezosToolkit
  ): Promise<TransactionOperation> {
    const operation = await this.contract.methods.set_dev_fee(fee).send();
    await operation.confirmation(2);
    return operation;
  }
  async setInitPrice(
    price: BigNumber,
    tezos: TezosToolkit
  ): Promise<TransactionOperation> {
    const operation = await this.contract.methods.set_price(price).send();
    await operation.confirmation(2);
    return operation;
  }
  async setBurnRate(
    rate: BigNumber,
    tezos: TezosToolkit
  ): Promise<TransactionOperation> {
    const operation = await this.contract.methods.set_burn_rate(rate).send();
    await operation.confirmation(2);
    return operation;
  }
  async addRemWhitelist(
    add: boolean,
    candidate: TezosAddress,
    tezos: TezosToolkit
  ): Promise<TransactionOperation> {
    await this.updateStorage({});
    const operation = await this.contract.methods
      .set_whitelist(add, candidate)
      .send();
    await operation.confirmation(2);
    return operation;
  }
  async claimRewards(tezos: TezosToolkit): Promise<TransactionOperation> {
    await this.updateStorage({});
    const operation = await this.contract.methods.claim_rewards(null).send();
    await operation.confirmation(2);
    return operation;
  }
  async addPool(
    tezos: TezosToolkit,
    token_info: {
      asset: TokenFA12 | TokenFA2;
      in_amount: BigNumber;
      rate_f: BigNumber;
      precision_multiplier_f: BigNumber;
    }[],
    default_referral: TezosAddress,
    a_constant: BigNumber = new BigNumber("100000"),
    managers: TezosAddress[] = [],
    fees: FeeType = {
      lp_f: new BigNumber("0"),
      stakers_f: new BigNumber("0"),
      ref_f: new BigNumber("0"),
    },
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
        rate_f: BigNumber;
        precision_multiplier_f: BigNumber;
      }) => {
        let result: {
          rate_f: BigNumber;
          precision_multiplier_f: BigNumber;
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
            rate_f: input.rate_f,
            precision_multiplier_f: input.precision_multiplier_f,
            reserves: input.in_amount,
          };
        } else {
          input_tokens.push({
            fa12: input.asset.contract.address,
          });
          result = {
            rate_f: input.rate_f,
            precision_multiplier_f: input.precision_multiplier_f,
            reserves: input.in_amount,
          };
        }
        return result;
      };
      tokens_info.set(i, mapped_item(info));
    }
    const opr = this.contract.methodsObject.add_pool({
      a_constant,
      input_tokens,
      tokens_info,
      default_referral,
      managers,
      fees,
    });
    const operation = await opr.send();
    await operation.confirmation(2);
    const inputs = new MichelsonMap();
    tokens_info.forEach((value, key) =>
      inputs.set(key, { token: input_tokens[key], value: value.reserves })
    );
    const op = await this.contract.methods.start_dex(inputs).send();
    await op.confirmation(2);
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
