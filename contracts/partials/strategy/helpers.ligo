function check_strategy_bounds(
  const reserves        : nat;
  const virtual_reserves: nat;
  const desired_rate_f  : nat;
  const delta_rate_f    : nat)
                        : bool is
  block {
    const rate_f = virtual_reserves * Constants.precision / reserves;
  } with abs(rate_f - desired_rate_f) < delta_rate_f

function calculate_desired_reserves(
  const reserves        : nat;
  const strat_token_conf: strategy_storage_t)
                        : nat is
  block {
    const desired_reserves : nat = reserves * strat_token_conf.des_reserves_rate_f / Constants.precision;
    // require(check_strategy_bounds(
    //   reserves,
    //   desired_reserves,
    //   strat_token_conf.des_reserves_rate_f,
    //   strat_token_conf.delta_rate_f
    // ), Errors.Strategy.out_of_delta_bounds);
  } with if desired_reserves > strat_token_conf.min_invest
          then desired_reserves
          else 0n

[@inline] function get_prepare_entrypoint(
  const strategy_address: address)
                        : contract(list(nat)) is
  unwrap(
    (Tezos.get_entrypoint_opt("%prepare", strategy_address): option(contract(list(nat)))),
    Errors.Strategy.no_prepare_entrypoint
  );

[@inline] function get_update_state_entrypoint(
  const strategy_address: address)
                        : contract(upd_strat_state_t) is
  unwrap(
    (Tezos.get_entrypoint_opt("%update_token_state", strategy_address): option(contract(upd_strat_state_t))),
    Errors.Strategy.no_update_state_entrypoint
  );

[@inline] function get_update_token_info_entrypoint(
  const strategy_address: address)
                        : contract(strat_upd_info_t) is
  unwrap(
    (Tezos.get_entrypoint_opt("%update_token_info", strategy_address): option(contract(strat_upd_info_t))),
    Errors.Strategy.no_update_state_entrypoint
  );

function check_strategy_pool_params(
  const pool_id : nat;
  const strategy: address): bool is
  block {
    const expected: strat_pool_data_t = record[
      pool_contract = Tezos.get_self_address();
      pool_id = pool_id
    ];
    const response: strat_pool_data_t = unwrap(
      (Tezos.call_view("get_pool_data", Unit, strategy): option(strat_pool_data_t)),
      Errors.Strategy.wrong_params
    );
  } with response = expected



function operate_with_strategy(
  const pool_id         : pool_id_t;
  const token_infos     : map(token_pool_idx_t, token_info_t);
  const tokens_map_entry: option(tokens_map_t);
  var strategy          : strategy_full_storage_t;
  const manual          : bool)
                        : list(operation) * strategy_full_storage_t is
  block {
    var ops := Constants.no_operations;
    case strategy.strat_contract of [
      Some(contract) -> {
        var rebalance_params: upd_strat_state_t := list[];
        var prepare_params: list(nat) := list[];
        var send_ops: list(operation) := list[];
        for token_id -> info in map token_infos {
          case strategy.configuration[token_id] of [
              Some(config) -> {
                var new_s_reserves := config.strategy_reserves;
                const in_bounds = check_strategy_bounds(
                  info.reserves,
                  config.strategy_reserves,
                  config.des_reserves_rate_f,
                  config.delta_rate_f
                );
                if (config.is_rebalance or manual) and not in_bounds
                then {
                  new_s_reserves := calculate_desired_reserves(info.reserves, config);
                  rebalance_params := record[
                    pool_token_id = token_id;
                    new_balance = new_s_reserves
                  ] # rebalance_params;
                  prepare_params := token_id # prepare_params;
                  case is_nat(new_s_reserves - config.strategy_reserves) of [
                    | Some(value) -> {
                      // send additional reserves to Yupana through Strategy
                      if value > 0n
                      then send_ops := typed_transfer(
                            Tezos.get_self_address(),
                            contract,
                            value,
                            get_token_by_id(token_id, tokens_map_entry)
                          ) # send_ops;
                    }
                    | _ -> skip
                  ];
                };
                strategy.configuration[token_id] := config with record[
                  strategy_reserves = new_s_reserves
                ];
            }
            | _ -> skip
          ]
        };
        if List.size(rebalance_params) > 0n
        then {
          ops := list [
            Tezos.transaction(prepare_params, 0mutez, get_prepare_entrypoint(contract));
            Tezos.transaction(rebalance_params, 0mutez, get_update_state_entrypoint(contract));
          ];
          if List.size(send_ops) > 0n
          then ops := concat_lists(
            send_ops,
            ops
          );
        }
      }
    | None -> skip
    ]
  } with (ops, strategy)