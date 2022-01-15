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
  Tezos,
  TezosAddress,
} from "../../../scripts/helpers/utils";
import { FactoryStorage } from "./types";
import admin_lambdas_comp from "../../../build/lambdas/test/Admin_lambdas.json";
import permit_lambdas_comp from "../../../build/lambdas/test/Permit_lambdas.json";
import dex_lambdas_comp from "../../../build/lambdas/test/Dex_lambdas.json";
import dev_lambdas_comp from "../../../build/lambdas/test/Dev_lambdas.json";
import token_lambdas_comp from "../../../build/lambdas/test/Token_lambdas.json";
import { confirmOperation } from "../../../scripts/helpers/confirmation";
import BigNumber from "bignumber.js";
import { defaultTokenId, TokenFA12, TokenFA2 } from "../../Token";
import { TokenInfo } from "../../Dex/types";

export class DexFactory {
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
    await setFunctionBatchCompilled(
      tezos,
      factoryAddress,
      "Admin",
      4,
      admin_lambdas_comp
    );
    await setFunctionBatchCompilled(
      tezos,
      factoryAddress,
      "Dev",
      2,
      dev_lambdas_comp
    );
    await setFunctionBatchCompilled(
      tezos,
      factoryAddress,
      "Permit",
      2,
      permit_lambdas_comp
    );
    await setFunctionBatchCompilled(
      tezos,
      factoryAddress,
      "Token",
      5,
      token_lambdas_comp
    );
    await setFunctionBatchCompilled(
      tezos,
      factoryAddress,
      "Dex",
      4,
      dex_lambdas_comp
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
          "permit_lambdas",
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

  async setDevAddress(
    dev: string,
    tezos: TezosToolkit
  ): Promise<TransactionOperation> {
    await this.updateStorage({});
    const operation = await this.contract.methods.set_dev_address(dev).send();

    await confirmOperation(tezos, operation.hash);
    return operation;
  }

  async setDevFee(
    fee: BigNumber,
    tezos: TezosToolkit
  ): Promise<TransactionOperation> {
    const operation = await this.contract.methods.set_dev_fee(fee).send();
    await confirmOperation(tezos, operation.hash);
    return operation;
  }
  async setInitPrice(
    price: BigNumber,
    tezos: TezosToolkit
  ): Promise<TransactionOperation> {
    const operation = await this.contract.methods.set_price(price).send();
    await confirmOperation(tezos, operation.hash);
    return operation;
  }
  async setBurnRate(
    rate: BigNumber,
    tezos: TezosToolkit
  ): Promise<TransactionOperation> {
    const operation = await this.contract.methods.set_burn_rate(rate).send();
    await confirmOperation(tezos, operation.hash);
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
    await confirmOperation(tezos, operation.hash);
    return operation;
  }
  async claimRewards(tezos: TezosToolkit): Promise<TransactionOperation> {
    await this.updateStorage({});
    const operation = await this.contract.methods.claim_rewards(null).send();
    await confirmOperation(tezos, operation.hash);
    return operation;
  }
  async initializeExchange(
    a_const: BigNumber = new BigNumber("100000"),
    token_info: {
      asset: TokenFA12 | TokenFA2;
      in_amount: BigNumber;
      rate: BigNumber;
      precision_multiplier: BigNumber;
    }[],
    default_referral: TezosAddress,
    managers: TezosAddress[],
    metadata: MichelsonMap<string, BytesString> = new MichelsonMap(),
    token_metadata: MichelsonMap<string, BytesString> = new MichelsonMap(),
    permit_def_expiry: BigNumber,
    approve = true,
    tezos: TezosToolkit
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
      .add_pool(
        a_const,
        input_tokens,
        tokens_info,
        default_referral,
        managers,
        metadata,
        token_metadata,
        permit_def_expiry
      )
      .send();
    await confirmOperation(tezos, operation.hash);
    return operation;
  }
}
