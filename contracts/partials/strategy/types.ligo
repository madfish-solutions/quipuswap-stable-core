type strategy_storage_t = [@layout:comb] record[
  des_reserves_rate_f : nat;
  delta_rate_f        : nat;
  min_invest          : nat;
  strategy_reserves   : nat;
];

type strategy_full_storage_t = [@layout:comb] record [
  strat_contract        : option(address);
  configuration         : map(pool_token_id_t, strategy_storage_t)
]

type conn_strategy_param = [@layout:comb] record [
  pool_id               : pool_id_t;
  strategy_contract     : option(address);
]

type conn_tok_strat_param = [@layout:comb] record [
  pool_id               : pool_id_t;
  pool_token_id         : pool_token_id_t;
  lending_market_id     : nat;
  des_reserves_rate_f   : nat;
  delta_rate_f          : nat;
  min_invest            : nat;
]