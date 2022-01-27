import BigNumber from "bignumber.js";
import { MichelsonMap } from "@taquito/taquito";
import { TezosAddress } from "../../utils/helpers";
export declare type AccountTokenInfo = {
  balance: BigNumber;
  allowances: MichelsonMap<TezosAddress, BigNumber>;
};

export declare type TokenStorage = {
  total_supply?: BigNumber;
  ledger?: MichelsonMap<TezosAddress, AccountTokenInfo>;
};
