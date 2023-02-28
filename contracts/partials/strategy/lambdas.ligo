function connect_strategy(
  const p               : strategy_action_t;
  var s                 : storage_t)
                        : return_t is
 block {
  var operations: list(operation) := Constants.no_operations;
  case p of [
    | Connect_strategy(params) -> {
      var pool : pool_t := unwrap(s.pools[params.pool_id], Errors.Dex.pool_not_listed);
      const tokens = unwrap(s.tokens[params.pool_id], Errors.Dex.pool_not_listed);
      // check pool for existing strategy
      case pool.strategy of [
        | Some(strategy) -> zero_reserves_guard(strategy)
        | None -> skip
      ];

      pool.strategy := case params.strategy_contract of [
        // set new strategy address
        | Some(strategy) -> {
          // check that one of factories know about new strategy contract
          const is_registered_strategy = check_is_registered_strategy(strategy, s);
          // check that new strategy contract has correct pool configuration
          const is_pool_params_correct = check_strategy_pool_params(params.pool_id, tokens, strategy);
          require(is_registered_strategy, Errors.Strategy.not_registered);
          require(is_pool_params_correct, Errors.Strategy.wrong_params);
        } with params.strategy_contract
        // or remove old
        | None -> params.strategy_contract
      ];
      s.pools[params.pool_id] := pool;
    }
    | _ -> unreachable(Unit)
  ]
 } with (operations, s)

 function strategy_rebalance(
  const p               : strategy_action_t;
  var s                 : storage_t)
                        : return_t is
 block {
  var operations: list(operation) := Constants.no_operations;
  case p of [
    | Rebalance(params) -> {
      const pool : pool_t = unwrap(s.pools[params.pool_id], Errors.Dex.pool_not_listed);
      const strategy = unwrap(pool.strategy, Errors.Strategy.no_connected_strategy);
      function map_ids(
        const acc : map(token_pool_idx_t, nat);
        const i   : nat)
                  : map(token_pool_idx_t, nat) is
          block {
            const info = get_token_info(i, pool.tokens_info);
          } with Map.add(i, info.reserves, acc);
      const infos = Set.fold(map_ids, params.pool_token_ids, (map[]: map(token_pool_idx_t, nat)));
      operations := operate_with_strategy(
            infos,
            strategy,
            True
          ) # operations
    }
    | _ -> unreachable(Unit)
  ]
 } with (operations, s)
