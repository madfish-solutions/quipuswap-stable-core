import { MichelsonMap } from "@taquito/michelson-encoder";

const dex_storage = {
  storage: {
    admin: null as string,
    managers: [],
    dev_address: null as string,
    reward_rate: "0",

    pools_count: "0",
    tokens: MichelsonMap.fromLiteral({}),
    pool_to_id: MichelsonMap.fromLiteral({}),
    pools: MichelsonMap.fromLiteral({}),
    ledger: MichelsonMap.fromLiteral({}),
    allowances: MichelsonMap.fromLiteral({}),
    dev_rewards: MichelsonMap.fromLiteral({}),
    referral_rewards: MichelsonMap.fromLiteral({}),
    stakers_balance: MichelsonMap.fromLiteral({}),
    pool_interest_rewards: MichelsonMap.fromLiteral({}),
    providers_rewards: MichelsonMap.fromLiteral({}),
    permits: MichelsonMap.fromLiteral({}),
  },
  metadata: MichelsonMap.fromLiteral({}),
  token_metadata: MichelsonMap.fromLiteral({}),
  dex_lambdas: MichelsonMap.fromLiteral({}),
  token_lambdas: MichelsonMap.fromLiteral({}),
};
export default dex_storage;
