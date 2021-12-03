import { MichelsonMap } from "@taquito/michelson-encoder";
import { DexStorage } from "../helpers/types";

const dex_storage = {
  storage: {
    admin: null as string,
    dev_address: null as string,
    default_referral: null as string,
    managers: [],

    reward_rate: "0",

    pools_count: "0",
    tokens: MichelsonMap.fromLiteral({}),
    pool_to_id: MichelsonMap.fromLiteral({}),
    pools: MichelsonMap.fromLiteral({}),
    ledger: MichelsonMap.fromLiteral({}),
    account_data: MichelsonMap.fromLiteral({}),
    dev_rewards: MichelsonMap.fromLiteral({}),
    referral_rewards: MichelsonMap.fromLiteral({}),
    stakers_balance: MichelsonMap.fromLiteral({}),
    quipu_token: {},
  },
  metadata: MichelsonMap.fromLiteral({}),
  token_metadata: MichelsonMap.fromLiteral({}),
  admin_lambdas: MichelsonMap.fromLiteral({}),
  dex_lambdas: MichelsonMap.fromLiteral({}),
  token_lambdas: MichelsonMap.fromLiteral({}),
  permit_lambdas: MichelsonMap.fromLiteral({}),
  permits: MichelsonMap.fromLiteral({}),
  permits_counter: "0",
  default_expiry: "2592000",
};
export default dex_storage;
