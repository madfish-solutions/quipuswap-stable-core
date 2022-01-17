import {
  BytesString,
  DevStorage,
  FA2,
  TezosAddress,
} from "../../../utils/helpers";
import BigNumber from "bignumber.js";
import { MichelsonMap } from "@taquito/taquito";

export declare type InnerFactoryStore = {
  dev_store: DevStorage;
  init_price: BigNumber;
  burn_rate: BigNumber;
  pools_count: BigNumber;
  pool_to_address: MichelsonMap<BytesString, TezosAddress>;
  quipu_token: FA2;
  quipu_rewards: BigNumber;
  whitelist: TezosAddress[];
};

export declare type FactoryStorage = {
  storage: InnerFactoryStore;
  admin_lambdas: MichelsonMap<string, BytesString>;
  permit_lambdas: MichelsonMap<string, BytesString>;
  dex_lambdas: MichelsonMap<string, BytesString>;
  token_lambdas: MichelsonMap<string, BytesString>;
};
