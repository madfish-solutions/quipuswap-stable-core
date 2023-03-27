type strat_pool_data_t is [@layout:comb] record[
  pool_contract         : address;
  pool_id               : nat;
  token_map             : tokens_map_t;
]

type conn_strategy_param is [@layout:comb] record [
  pool_id               : pool_id_t;
  strategy_contract     : option(address);
]

type upd_state_t    is [@layout:comb] record [
  tokens                : map(token_pool_idx_t, nat);
  manual                : bool;
]

type rebalance_param    is [@layout:comb] record [
  pool_id               : pool_id_t;
  pool_token_ids        : set(nat);
]

type strategy_action_t is
| Connect_strategy                of conn_strategy_param
| Rebalance                       of rebalance_param