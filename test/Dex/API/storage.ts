import { MichelsonMap } from "@taquito/michelson-encoder";
import { DexStorage } from "./types";
import { BigNumber } from "bignumber.js";
import { FA2, TezosAddress } from "../../../utils/helpers";

const dex_storage: DexStorage = {
  storage: {
    admin: null as TezosAddress,
    default_referral: null as TezosAddress,
    managers: [],

    pools_count: new BigNumber("0"),
    tokens: new MichelsonMap(),
    pool_to_id: new MichelsonMap(),
    pools: new MichelsonMap(),
    ledger: new MichelsonMap(),
    token_metadata: new MichelsonMap(),
    allowances: new MichelsonMap(),
    dev_rewards: new MichelsonMap(),
    referral_rewards: new MichelsonMap(),
    stakers_balance: new MichelsonMap(),
    quipu_token: null as FA2,
    dev_store: {
      dev_address: null as TezosAddress,
      dev_fee_f: new BigNumber("0"),
      dev_lambdas: new MichelsonMap(),
    },
    factory_address: null as TezosAddress,
  },
  metadata: new MichelsonMap(),
  admin_lambdas: new MichelsonMap(),
  dex_lambdas: new MichelsonMap(),
  token_lambdas: new MichelsonMap(),
  strat_lambdas: new MichelsonMap(),
};
export default dex_storage;
