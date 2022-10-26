function check_strategy_bounds(
  const reserves        : nat;
  const desired_reserves: nat;
  const desired_rate_f  : nat;
  const delta_rate_f    : nat)
                        : unit is
  block {
    const rate_f = reserves * Constants.precision / desired_reserves;
    const in_upper_bound = rate_f < (desired_rate_f + delta_rate_f);
    const in_lower_bound = rate_f > nat_or_error(desired_rate_f - delta_rate_f, Errors.Math.nat_error);
  } with require(in_upper_bound and in_lower_bound, Errors.Strategy.out_of_delta_bounds)

function calculate_desired_reserves(
  const reserves        : nat;
  const strat_token_conf: strategy_storage_t)
                        : nat is
  block {
    const desired_reserves : nat = reserves * strat_token_conf.des_reserves_rate_f / Constants.precision;
    check_strategy_bounds(
      reserves,
      desired_reserves,
      strat_token_conf.des_reserves_rate_f,
      strat_token_conf.delta_rate_f
    );
  } with if desired_reserves > strat_token_conf.min_invest
          then desired_reserves
          else 0n

(* Helper function to get mint lending contract entrypoint *)
[@inline] function get_update_state_entrypoint(
  const strategy_address: address)
                        : contract(upd_strat_state_t) is
  unwrap(
    (Tezos.get_entrypoint_opt("%update_token_state", strategy_address): option(contract(upd_strat_state_t))),
    Errors.Strategy.no_update_state_entrypoint
  );

function update_strategy_reserves(
  const token_pool_id   : token_pool_idx_t;
  const token           : token_t;
  const old_s_reserves  : nat;
  const new_s_reserves  : nat;
  const strat_contract  : address)
                        : list(operation) is
  block {
    const upd_state_param : upd_strat_state_t = record[
      pool_token_id = token_pool_id;
      new_balance = new_s_reserves
    ];
    var before_ops := Constants.no_operations;
    var after_ops := Constants.no_operations;
    case is_nat(new_s_reserves - old_s_reserves) of [
        Some(value) -> {
          if value > 0n
            then {
              // send additional reserves to Yupana through Strategy
              before_ops := typed_transfer(
                  Tezos.self_address(unit),
                  strat_contract,
                  nat_or_error(new_s_reserves - old_s_reserves, Errors.Math.nat_error),
                  token
                ) # before_ops;
            }
        }
      | None -> { // means that old_s_reserves > new_s_reserves, waiting for refiling from Strategy
        // TODO: make lock flag before receiving tokens from strategy
        after_ops := Constants.no_operations;
      }
    ];
    const ops = concat_lists(
      Tezos.transaction(
        upd_state_param,
        0mutez,
        get_update_state_entrypoint(strat_contract)
      ) # before_ops,
      after_ops
    )
  } with ops

function operate_with_strategy(
  const token_pool_id   : token_pool_idx_t;
  const token           : token_t;
  const reserves        : nat;
  const strategy_address: address;
  var strategy          : strategy_storage_t)
                        : list(operation) * strategy_storage_t is
  block {
    var ops := Constants.no_operations;
    if strategy.is_updatable then {
      const new_s_reserves = calculate_desired_reserves(reserves, strategy);
      ops := update_strategy_reserves(
        token_pool_id,
        token,
        strategy.strategy_reserves,
        new_s_reserves,
        strategy_address
      );
      strategy.strategy_reserves := new_s_reserves;
    }
  } with (ops, strategy)