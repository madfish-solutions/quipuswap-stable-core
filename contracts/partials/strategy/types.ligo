type strategy_storage_t is [@layout:comb] record[
  des_reserves_rate_f : nat;
  delta_rate_f        : nat;
  min_invest          : nat;
  strategy_reserves   : nat;
  is_rebalance        : bool;
];

type strategy_full_storage_t is [@layout:comb] record [
  strat_contract        : option(address);
  configuration         : map(token_pool_idx_t, strategy_storage_t)
]

type conn_strategy_param is [@layout:comb] record [
  pool_id               : pool_id_t;
  strategy_contract     : option(address);
]

type conn_tok_strat_param is [@layout:comb] record [
  pool_id                       : pool_id_t;
  pool_token_id                 : token_pool_idx_t;
  lending_market_id             : nat;
];

type set_tok_strat_param is [@layout:comb] record [
  pool_id               : pool_id_t;
  pool_token_id         : token_pool_idx_t;
  des_reserves_rate_f   : nat;
  delta_rate_f          : nat;
  min_invest            : nat;
]

type tok_strat_upd_fl_param is [@layout:comb] record [
  pool_id               : pool_id_t;
  pool_token_id         : token_pool_idx_t;
  flag                  : bool;
]

type upd_strat_state_t  is [@layout:comb] record [
  pool_token_id         : nat;
  new_balance           : nat;
]

type rebalance_param    is [@layout:comb] record [
  pool_id               : pool_id_t;
  pool_token_id         : nat;
]

type strat_upd_info_t   is [@layout:comb] record [
  token                         : token_t;
  pool_token_id                 : token_pool_idx_t;
  lending_market_id             : nat;
]


type strategy_action_t is
| Connect_strategy                of conn_strategy_param
| Connect_token_strategy          of conn_tok_strat_param
| Set_token_strategy              of set_tok_strat_param
| Set_token_strategy_rebalance    of tok_strat_upd_fl_param
| Rebalance                       of rebalance_param