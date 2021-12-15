type land_inf_t is [@layout:comb] record [
  location: address;
  liquidity_info: liq_tok_info_t;
  market_id: nat;
  proxy: address;
]

type storage_t is [@layout:comb] record [
  admin: address;
  stake_token: token_t;
  staked: nat;
  dex: address;
  tmp: option(tmp_t);

  stake_info: land_inf_t;
]

type return_t is list(operation) * storage_t