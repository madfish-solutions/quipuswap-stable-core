const default_strategy_configuration = record [
  des_reserves_rate_f = 0n;
  delta_rate_f        = 0n;
  min_invest          = 0n;
  strategy_reserves   = 0n;
  is_rebalance        = True;
]

function connect_strategy(
  const p               : strategy_action_t;
  var s                 : storage_t)
                        : return_t is
 block {
  var operations: list(operation) := Constants.no_operations;
  case p of [
    | Connect_strategy(params) -> {
      var pool : pool_t := unwrap(s.pools[params.pool_id], Errors.Dex.pool_not_listed);
      function check_reserves(
        const token_id: token_pool_idx_t;
        const config  : strategy_storage_t)
                      : unit is
        require(config.strategy_reserves = 0n, Errors.Strategy.unclaimed_reserves);
      Map.iter(check_reserves, pool.strategy.configuration);
      pool.strategy.strat_contract := case params.strategy_contract of [
        | Some(addr) -> {
          const is_registered_strategy = check_is_registered_strategy(addr, s);
          const is_pool_params_correct = check_strategy_pool_params(params.pool_id, addr);
          require(is_registered_strategy, Errors.Strategy.not_registered);
          require(is_pool_params_correct, Errors.Strategy.wrong_params);
        } with params.strategy_contract
        | None -> params.strategy_contract
      ];
      s.pools[params.pool_id] := pool;
    }
    | _ -> unreachable(Unit)
  ]
 } with (operations, s)

function connect_token_to_strategy(
  const p               : strategy_action_t;
  const s               : storage_t)
                        : return_t is
 block {
  var operations: list(operation) := Constants.no_operations;
  case p of [
    | Connect_token_strategy(params) -> {
      const token = get_token_by_id(
        params.pool_token_id,
        s.tokens[params.pool_id]
      );
      const connect_token_params: strat_upd_info_t = record[
        token = token;
        pool_token_id = params.pool_id;
        lending_market_id = params.lending_market_id
      ];
      // TODO: send connection to strategy
    }
    | _ -> unreachable(Unit)
  ]
 } with (operations, s)

function update_token_strategy_params(
  const p               : strategy_action_t;
  var s                 : storage_t)
                        : return_t is
 block {
  case p of [
    | Set_token_strategy(params) -> {
      var pool : pool_t := unwrap(s.pools[params.pool_id], Errors.Dex.pool_not_listed);
      require(params.des_reserves_rate_f + params.delta_rate_f < Constants.precision, Errors.Math.percent_overflow);
      pool.strategy.configuration[params.pool_token_id] := unwrap_or(
        pool.strategy.configuration[params.pool_token_id],
        default_strategy_configuration
      ) with record [
        des_reserves_rate_f = params.des_reserves_rate_f;
        delta_rate_f        = params.delta_rate_f;
        min_invest          = params.min_invest;
      ];
      s.pools[params.pool_id] := pool;
    }
    | _ -> unreachable(Unit)
  ]
 } with (Constants.no_operations, s)

function set_rebalance(
  const p               : strategy_action_t;
  var s                 : storage_t)
                        : return_t is
 block {
  case p of [
    | Set_token_strategy_rebalance(params) -> {
      var pool : pool_t := unwrap(s.pools[params.pool_id], Errors.Dex.pool_not_listed);
      pool.strategy.configuration[params.pool_token_id] := unwrap(
          pool.strategy.configuration[params.pool_token_id],
          Errors.Strategy.unknown_token
        ) with record [
          is_rebalance = params.flag;
      ];
      s.pools[params.pool_id] := pool;
    }
    | _ -> unreachable(Unit)
  ]
 } with (Constants.no_operations, s)

 function strategy_rebalance(
  const p               : strategy_action_t;
  var s                 : storage_t)
                        : return_t is
 block {
  var operations: list(operation) := Constants.no_operations;
  case p of [
    | Rebalance(params) -> skip
    | _ -> unreachable(Unit)
  ]
 } with (operations, s)