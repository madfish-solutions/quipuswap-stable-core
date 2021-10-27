import { ContractAbstraction, ContractProvider } from "@taquito/taquito";
import { TransactionOperation } from "@taquito/taquito/dist/types/operations/transaction-operation";
import { confirmOperation } from "./confirmation";
import { Token } from "./token";
import { TokenStorage } from "./types";
import { prepareProviderOptions, Tezos } from "./utils";
import BigNumber from "bignumber.js";

export class TokenFA12 implements Token {
  public contract: ContractAbstraction<ContractProvider>;
  public storage: TokenStorage;

  constructor(contract: ContractAbstraction<ContractProvider>) {
    this.contract = contract;
  }

  static async init(tokenAddress: string): Promise<TokenFA12> {
    return new TokenFA12(await Tezos.contract.at(tokenAddress));
  }

  async updateProvider(accountName: string): Promise<void> {
    let config = await prepareProviderOptions(accountName);
    await Tezos.setProvider(config);
  }

  async updateStorage(
    maps: {
      ledger?: string[];
    } = {}
  ): Promise<void> {
    const storage: any = await this.contract.storage();
    this.storage = {
      total_supply: storage.total_supply,
      ledger: {},
    };
    for (let key in maps) {
      this.storage[key] = await maps[key].reduce(async (prev, current) => {
        try {
          return {
            ...(await prev),
            [current]: await storage[key].get(current),
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
    let operation = await this.contract.methods
      .transfer(from, to, amount)
      .send();
    await confirmOperation(Tezos, operation.hash);
    return operation;
  }

  async approve(to: string, amount: BigNumber): Promise<TransactionOperation> {
    let operation = await this.contract.methods.approve(to, amount).send();
    await confirmOperation(Tezos, operation.hash);
    return operation;
  }

  async getBalance(
    owner: string,
    contract: number
  ): Promise<TransactionOperation> {
    let operation = await this.contract.methods
      .getBalance(owner, contract)
      .send();
    await confirmOperation(Tezos, operation.hash);
    return operation;
  }

  async getAllowance(
    owner: string,
    trusted: string,
    contract: number
  ): Promise<TransactionOperation> {
    let operation = await this.contract.methods
      .getAllowance(owner, trusted, contract)
      .send();
    await confirmOperation(Tezos, operation.hash);
    return operation;
  }

  async getTotalSupply(contract: number): Promise<TransactionOperation> {
    let operation = await this.contract.methods
      .getTotalSupply(null, contract)
      .send();
    await confirmOperation(Tezos, operation.hash);
    return operation;
  }
}
