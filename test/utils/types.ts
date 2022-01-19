import { ContractAbstraction, ContractProvider } from "@taquito/taquito";
import BigNumber from "bignumber.js";
import { TokenFA12, TokenFA2 } from "../Token";

export declare type TokensMap = {
  kUSD: TokenFA12;
  USDtz: TokenFA12;
  uUSD: TokenFA2;
};

export declare type AmountsMap = {
  kUSD: BigNumber;
  USDtz: BigNumber;
  uUSD: BigNumber;
};

export declare type IndexMap = {
  kUSD: string;
  USDtz: string;
  uUSD: string;
};

export declare interface Contract {
  contract: ContractAbstraction<ContractProvider>;
  storage: unknown;
  updateStorage(args: any): Promise<void>;
}
