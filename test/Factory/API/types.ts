import { BytesString, FA2, TezosAddress } from "../../../utils/helpers";
import BigNumber from "bignumber.js";
import { MichelsonMap } from "@taquito/taquito";
import { DevStorage } from "../../Developer/API/storage";

export declare type InnerFactoryStore = {
  dev_store: DevStorage;
  init_price: BigNumber;
  burn_rate_f: BigNumber;
  pools_count: BigNumber;
  pool_id_to_address: MichelsonMap<BigNumber, TezosAddress>;
  pool_to_address: MichelsonMap<BytesString, TezosAddress>;
  quipu_token: FA2;
  quipu_rewards: BigNumber;
  whitelist: TezosAddress[];
  deployers: MichelsonMap<TezosAddress, TezosAddress>;
};

export declare type FactoryStorage = {
  storage: InnerFactoryStore;
  admin_lambdas: MichelsonMap<string, BytesString>;
  dex_lambdas: MichelsonMap<string, BytesString>;
  token_lambdas: MichelsonMap<string, BytesString>;
  strat_lambdas: MichelsonMap<string, BytesString>;
  init_func?: BytesString;
  metadata: MichelsonMap<string, BytesString>;
};
