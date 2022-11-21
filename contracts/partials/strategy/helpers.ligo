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


function operate_with_strategy(
  const token_infos     : map(token_pool_idx_t, token_info_t);
  const tokens_map_entry: option(tokens_map_t);
  var strategy          : strategy_full_storage_t)
                        : list(operation) * strategy_full_storage_t is
  block {
    var ops := Constants.no_operations;
    case strategy.strat_contract of [
      Some(contract) -> {
        var rebalance_params: upd_strat_state_t := nil;
        var prepare_params: list(nat) := nil;
        var send_ops: list(operation) := nil;
        for token_id -> info in map token_infos {
          var config := unwrap(strategy.configuration[token_id], Errors.Strategy.unknown_token);
          const need_rebalance = check_strategy_bounds(
            info.reserves,
            config.strategy_reserves,
            config.des_reserves_rate_f,
            config.delta_rate_f
          );
          if config.is_rebalance and need_rebalance then {
            const new_s_reserves = calculate_desired_reserves(info.reserves, config);
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
                    Tezos.self_address(unit),
                    contract,
                    value,
                    get_token_by_id(token_id, tokens_map_entry)
                  ) # send_ops;
              }
             | _ -> skip
            ];
            config.strategy_reserves := new_s_reserves;
          };
          strategy.configuration[token_id] := config;
        };
        ops := list [
          Tezos.transaction(prepare_params, 0mutez, get_prepare_entrypoint(contract));
          Tezos.transaction(rebalance_params, 0mutez, get_update_state_entrypoint(contract))
        ];
        ops := concat_lists(
          send_ops,
          ops
        );
      }
    | None -> skip
    ]
  } with (ops, strategy)