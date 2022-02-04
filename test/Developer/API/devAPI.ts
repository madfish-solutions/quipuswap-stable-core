import { TransactionOperation, TezosToolkit } from "@taquito/taquito";
import { Contract } from "../../utils/types";
import { DevStorage } from "./storage";
import BigNumber from "bignumber.js";

export declare interface DevEnabledContract extends Contract {
  storage: any & { storage: any & { dev_store: DevStorage } };
  setDevAddress: (
    dev: string,
    tezos: TezosToolkit
  ) => Promise<TransactionOperation>;
  setDevFee: (
    fee: BigNumber,
    tezos: TezosToolkit
  ) => Promise<TransactionOperation>;
}
