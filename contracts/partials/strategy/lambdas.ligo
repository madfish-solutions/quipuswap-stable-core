function connect_strategy(
  const p               : strategy_action_t;
  var s                 : storage_t)
                        : return_t is
 block {
  var operations: list(operation) := Constants.no_operations;
  case p of [
    | Connect_strategy(params) -> {
      var pool : pool_t := unwrap(s.pools[params.pool_id], Errors.Dex.pool_not_listed);
      function claim_reserves(
        const token_id: token_pool_idx_t;
        const config  : strategy_storage_t)
                      : unit is
          block {
            if config.strategy_reserves > 0n
              then skip// TODO: claim tokens back
          } with unit;
      Map.iter(claim_reserves, pool.strategy.configuration);
      pool.strategy.strat_contract := params.strategy_contract;
      pool.strategy.configuration := (map[]: map(token_pool_idx_t, strategy_storage_t));
      s.pools[params.pool_id] := pool;
    }
    | _ -> unreachable(Unit)
  ]
 } with (operations, s)

function update_token_to_strategy_params(
  const p               : strategy_action_t;
  var s                 : storage_t)
                        : return_t is
 block {
  var operations: list(operation) := Constants.no_operations;
  case p of [
    | Set_token_strategy(params) -> {
      var pool : pool_t := unwrap(s.pools[params.pool_id], Errors.Dex.pool_not_listed);
      var strat_config := pool.strategy.configuration;
      require(params.des_reserves_rate_f + params.delta_rate_f < Constants.precision, Errors.Math.percent_overflow);
      strat_config[params.pool_token_id] := case Map.find_opt(params.pool_token_id, strat_config) of [
          Some(data) -> {
            (* WARNING: lending_market_id is ignored in this case
                        because pool_token_id already added to Strategy *)
            // TODO: call update stategy with new desired params?
            const _ = 0n;
          } with data with record [
              des_reserves_rate_f = params.des_reserves_rate_f;
              delta_rate_f        = params.delta_rate_f;
              min_invest          = params.min_invest;
          ]
        | None -> {
          // TODO: update lending_market_id on strategy call
          const _ = 0n;
        } with record[
          des_reserves_rate_f = params.des_reserves_rate_f;
          delta_rate_f        = params.delta_rate_f;
          min_invest          = params.min_invest;
          strategy_reserves   = 0n;
          is_rebalance        = True;
        ]
      ];
      pool.strategy.configuration := strat_config;
      s.pools[params.pool_id] := pool;
    }
    | _ -> unreachable(Unit)
  ]
 } with (operations, s)

function set_rebalance(
  const p               : strategy_action_t;
  var s                 : storage_t)
                        : return_t is
 block {
  var operations: list(operation) := Constants.no_operations;
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
 } with (operations, s)