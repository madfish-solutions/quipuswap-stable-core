import { MichelsonMap } from "@taquito/michelson-encoder";
import { DexStorage, FA2 } from "./types";
import { BigNumber } from "bignumber.js";

const dex_storage: DexStorage = {
  storage: {
    admin: null as string,
    dev_address: null as string,
    default_referral: null as string,
    managers: [],

    reward_rate: new BigNumber("0"),

    pools_count: new BigNumber("0"),
    tokens: new MichelsonMap(),
    pool_to_id: new MichelsonMap(),
    pools: new MichelsonMap(),
    ledger: new MichelsonMap(),
    account_data: new MichelsonMap(),
    dev_rewards: new MichelsonMap(),
    referral_rewards: new MichelsonMap(),
    stakers_balance: new MichelsonMap(),
    quipu_token: null as FA2,
  },
  metadata: new MichelsonMap(),
  token_metadata: new MichelsonMap(),
  admin_lambdas: new MichelsonMap(),
  dex_lambdas: new MichelsonMap(),
  token_lambdas: new MichelsonMap(),
  permit_lambdas: new MichelsonMap(),
  permits: new MichelsonMap(),
  permits_counter: new BigNumber("0"),
  default_expiry: new BigNumber("2592000"),
};
export default dex_storage;
