import {
  ContractAbstraction,
  ContractProvider,
  TezosToolkit,
} from "@taquito/taquito";
import { TransactionOperation } from "@taquito/taquito/dist/types/operations/transaction-operation";
import { Token } from "./token";
import { TokenStorage } from "./types";
import BigNumber from "bignumber.js";
import { prepareProviderOptions } from "../../utils/helpers";
import { confirmOperation } from "../../utils/confirmation";

export class TokenFA12 implements Token {
  public contract: ContractAbstraction<ContractProvider>;
  public storage: TokenStorage;
  readonly Tezos: TezosToolkit;

  constructor(
    tezos: TezosToolkit,
    contract: ContractAbstraction<ContractProvider>
  ) {
    this.Tezos = tezos;
    this.contract = contract;
  }

  static async init(
    tezos: TezosToolkit,
    tokenAddress: string
  ): Promise<TokenFA12> {
    return new TokenFA12(tezos, await tezos.contract.at(tokenAddress));
  }

  async updateProvider(accountName: string): Promise<void> {
    const config = await prepareProviderOptions(accountName);
    this.Tezos.setProvider(config);
  }

  async updateStorage(
    maps: {
      ledger?: string[];
    } = {}
  ): Promise<void> {
    this.storage = await this.contract.storage();
    for (const key in maps) {
      this.storage[key] = await maps[key].reduce(async (prev, current) => {
        try {
          return {
            ...(await prev),
            [current]: await this.storage[key].get(current),
          };
        } catch (ex) {
          return {
            ...(await prev),
            [current]: 0,
          };
        }
      }, Promise.resolve({}));
    }
  }

  async transfer(
    tokenId: BigNumber = new BigNumber(0),
    from: string,
    to: string,
    amount: BigNumber
  ): Promise<TransactionOperation> {
    const operation = await this.contract.methods
      .transfer(from, to, amount)
      .send();
    await confirmOperation(this.Tezos, operation.hash);
    return operation;
  }

  async approve(to: string, amount: BigNumber): Promise<TransactionOperation> {
    const operation = await this.contract.methods.approve(to, amount).send();
    await confirmOperation(this.Tezos, operation.hash);
    return operation;
  }

  async getBalance(
    owner: string,
    contract: number
  ): Promise<TransactionOperation> {
    const operation = await this.contract.methods
      .getBalance(owner, contract)
      .send();
    await confirmOperation(this.Tezos, operation.hash);
    return operation;
  }

  async getAllowance(
    owner: string,
    trusted: string,
    contract: number
  ): Promise<TransactionOperation> {
    const operation = await this.contract.methods
      .getAllowance(owner, trusted, contract)
      .send();
    await confirmOperation(this.Tezos, operation.hash);
    return operation;
  }

  async getTotalSupply(contract: number): Promise<TransactionOperation> {
    const operation = await this.contract.methods
      .getTotalSupply(null, contract)
      .send();
    await confirmOperation(this.Tezos, operation.hash);
    return operation;
  }
}
