import { MichelsonMap } from "@taquito/michelson-encoder";

export default {
  storage: {
    admin: null,
    managers: [],
    dev_address: null,
    fee: {
      lp_fee: "0",
      stakers_fee: "0",
      ref_fee: "0",
      dev_fee: "0",

    },
    is_public_init: false,
    reward_rate: '0',
    pairs_count: "0",
    tokens: MichelsonMap.fromLiteral({}),
    token_to_id: MichelsonMap.fromLiteral({}),
    metadata:MichelsonMap.fromLiteral({}),
    token_metadata:MichelsonMap.fromLiteral({}),
    pairs: MichelsonMap.fromLiteral({}),
    ledger: MichelsonMap.fromLiteral({}),
  },
  metadata: MichelsonMap.fromLiteral({}),
  dex_lambdas: MichelsonMap.fromLiteral({}),
  token_lambdas: MichelsonMap.fromLiteral({}),
};
