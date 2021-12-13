type farm_inf_t is [@layout:comb] record [
  location: address;
  reward_token: token_t;
  liquidity_token: optional(liq_tok_info_t);
]

type storage_t is [@layout:comb] record [
  admin: address;
  stake_token: token_t;
  staked: nat;
  dex: address;
  tmp: optional(tmp_t);

  stake_info: farm_inf_t;
]

type return_t is list(operation) * storage_t