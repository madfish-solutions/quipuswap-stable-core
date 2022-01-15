import { MichelsonMap } from "@taquito/taquito";
import { DevStorage, FA2, TezosAddress } from "../../../scripts/helpers/utils";
import BigNumber from "bignumber.js";
import { FactoryStorage, InnerFactoryStore } from "./types";

export const factory_storage: FactoryStorage = {
  storage: {
    dev_store: {
      dev_address: null as TezosAddress,
      dev_fee: new BigNumber(0),
      dev_lambdas: new MichelsonMap(),
    } as DevStorage,
    init_price: new BigNumber(0),
    burn_rate: new BigNumber(0),
    pools_count: new BigNumber(0),
    pool_to_address: new MichelsonMap(),
    quipu_token: null as FA2,
    quipu_rewards: new BigNumber(0),
  } as InnerFactoryStore,
  admin_lambdas: new MichelsonMap(),
  dex_lambdas: new MichelsonMap(),
  token_lambdas: new MichelsonMap(),
  permit_lambdas: new MichelsonMap(),
};

export default factory_storage;
