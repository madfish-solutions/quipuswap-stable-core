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
import token_lambdas_comp from "../../../build/lambdas/test/Token_lambdas.json";
import { defaultTokenId, TokenFA12, TokenFA2 } from "../../Token";
import { DevEnabledContract } from "../../Developer/API/devAPI";

export class Dex extends TokenFA2 implements DevEnabledContract {
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
        8,
        admin_lambdas_comp
      );
      await setFunctionBatchCompilled(
        tezos,
        dexAddress,
        "Token",
        5,
        token_lambdas_comp
      );
      await setFunctionBatchCompilled(
        tezos,
        dexAddress,
        "Dex",
        8,
        dex_lambdas_comp
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
      if (["dex_lambdas", "token_lambdas", "admin_lambdas"].includes(key))
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
      if (!["dex_lambdas", "token_lambdas", "admin_lambdas"].includes(key))
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
    a_const: BigNumber = new BigNumber("100000"),
    token_info: {
      asset: TokenFA12 | TokenFA2;
      in_amount: BigNumber;
      rate: BigNumber;
      precision_multiplier: BigNumber;
    }[],
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
      .add_pool(a_const, input_tokens, tokens_info)
      .send();
    await confirmOperation(tezos, operation.hash);
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
    referral: string = null,
    tezos: TezosToolkit
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
    await confirmOperation(tezos, operation.hash);
    return operation;
  }

  async investLiquidity(
    poolId: BigNumber,
    tokenAmounts: Map<string, BigNumber>,
    minShares: BigNumber,
    expiration: Date,
    receiver: TezosAddress = null,
    referral: TezosAddress = null,
    tezos: TezosToolkit
  ): Promise<TransactionOperation> {
    const in_amounts = new MichelsonMap();
    tokenAmounts.forEach((value, key) => {
      in_amounts.set(key, value.toNumber());
    });
    const operation = await this.contract.methods
      .invest(
        poolId,
        minShares,
        in_amounts,
        new BigNumber(expiration.getTime()).dividedToIntegerBy(1000),
        receiver,
        referral
      )
      .send();
    await confirmOperation(tezos, operation.hash);
    return operation;
  }

  async divestLiquidity(
    poolId: BigNumber,
    mintokenAmounts: Map<string, BigNumber>,
    sharesBurned: BigNumber,
    expiration: Date,
    receiver: TezosAddress = null,
    tezos: TezosToolkit
  ): Promise<TransactionOperation> {
    const amts = new MichelsonMap<string, BigNumber>();
    mintokenAmounts.forEach((value, key) => {
      amts.set(key, value);
    });
    const operation = await this.contract.methods
      .divest(
        poolId,
        amts,
        sharesBurned,
        new BigNumber(expiration.getTime()).dividedToIntegerBy(1000),
        receiver
      )
      .send();
    await confirmOperation(tezos, operation.hash);
    return operation;
  }

  async divestImbalanced(
    poolId: BigNumber,
    tokenAmounts: Map<string, BigNumber>,
    maxSharesBurned: BigNumber,
    expiration: Date,
    receiver: TezosAddress = null,
    referral: TezosAddress = null,
    tezos: TezosToolkit
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
        new BigNumber(expiration.getTime()).dividedToIntegerBy(1000),
        receiver,
        referral
      )
      .send();
    await confirmOperation(tezos, operation.hash);
    return operation;
  }

  async divestOneCoin(
    poolId: BigNumber,
    sharesBurned: BigNumber,
    tokenIdx: BigNumber,
    mintokenAmount: BigNumber,
    expiration: Date,
    receiver: TezosAddress = null,
    referral: TezosAddress = null,
    tezos: TezosToolkit
  ): Promise<TransactionOperation> {
    const operation = await this.contract.methods
      .divest_one_coin(
        poolId,
        sharesBurned,
        tokenIdx,
        mintokenAmount,
        new BigNumber(expiration.getTime()).dividedToIntegerBy(1000),
        receiver,
        referral
      )
      .send();
    await confirmOperation(tezos, operation.hash);
    return operation;
  }
  async setAdmin(
    new_admin: string,
    tezos: TezosToolkit
  ): Promise<TransactionOperation> {
    await this.updateStorage({});
    const operation = await this.contract.methods.set_admin(new_admin).send();

    await confirmOperation(tezos, operation.hash);
    return operation;
  }
  async addRemManager(
    add: boolean,
    manager: string,
    tezos: TezosToolkit
  ): Promise<TransactionOperation> {
    await this.updateStorage({});
    const operation = await this.contract.methods
      .add_rem_managers(add, manager)
      .send();
    await confirmOperation(tezos, operation.hash);
    return operation;
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
  async setFees(
    pool_id: BigNumber,
    fees: FeeType,
    tezos: TezosToolkit
  ): Promise<TransactionOperation> {
    const operation = await this.contract.methods
      .set_fees(pool_id, fees.lp, fees.stakers, fees.ref)
      .send();

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
  async setDefaultReferral(
    ref: string,
    tezos: TezosToolkit
  ): Promise<TransactionOperation> {
    const operation = await this.contract.methods
      .set_default_referral(ref)
      .send();
    await confirmOperation(tezos, operation.hash);
    return operation;
  }

  async approveFA2Token(
    tokenAddress: string,
    tokenId: BigNumber,
    tokenAmount: number,
    address: string,
    tezos: TezosToolkit
  ): Promise<TransactionOperation> {
    await this.updateStorage();
    const token = await tezos.contract.at(tokenAddress);
    const operation = await token.methods
      .update_operators([
        {
          [tokenAmount ? "add_operator" : "remove_operator"]: {
            owner: await tezos.signer.publicKeyHash(),
            operator: address,
            token_id: tokenId,
          },
        },
      ])
      .send();
    await confirmOperation(tezos, operation.hash);
    return operation;
  }

  async approveFA12Token(
    tokenAddress: string,
    tokenAmount: number,
    address: string,
    tezos: TezosToolkit
  ): Promise<TransactionOperation> {
    await this.updateStorage();
    const token = await tezos.contract.at(tokenAddress);
    const operation = await token.methods.approve(address, tokenAmount).send();
    await confirmOperation(tezos, operation.hash);
    return operation;
  }
}
