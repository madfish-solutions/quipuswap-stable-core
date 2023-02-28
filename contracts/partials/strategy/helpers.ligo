
[@inline] function get_update_state_entrypoint(
  const strategy_address: address)
                        : contract(upd_state_t) is
  unwrap(
    (Tezos.get_entrypoint_opt("%update_state", strategy_address): option(contract(upd_state_t))),
    Errors.Strategy.no_update_state_entrypoint
  );

[@inline] function get_virtual_reserves_map(
  const strategy_address: address)
                        : map(token_pool_idx_t, nat) is
  unwrap(
    (Tezos.call_view("deposit_map", Unit, strategy_address): option(map(token_pool_idx_t, nat))),
    Errors.Strategy.no_deposit_view
  );

function zero_reserves_guard(const strategy: address) is
  block {
    // call strategy view for deposited reserves
    const virtual_reserves = get_virtual_reserves_map(strategy);
  } with Map.iter(
      function (const _: token_pool_idx_t; const deposited_reserves: nat): unit is
        require(deposited_reserves = 0n, Errors.Strategy.unclaimed_reserves),
      virtual_reserves
    );

function check_strategy_pool_params(
  const pool_id : nat;
  const tokens: tokens_map_t;
  const strategy: address): bool is
  block {
    const expected: strat_pool_data_t = record[
      pool_contract = Tezos.get_self_address();
      pool_id = pool_id;
      token_map = tokens
    ];

    const response: strat_pool_data_t = unwrap(
      (Tezos.call_view("get_pool_data", Unit, strategy): option(strat_pool_data_t)),
      Errors.Strategy.wrong_params
    );

    const match_tokens = Map.fold(
      function (const acc: bool; const entry: token_pool_idx_t * token_t): bool is
      block {
        const (token_id, response_token) = entry;
        const expected_token = unwrap(expected.token_map[token_id], Errors.Strategy.wrong_params);
        const is_same = response_token = expected_token;
      } with acc and is_same,
      response.token_map,
      True
    );

    const match = response.pool_contract = expected.pool_contract
      and response.pool_id = expected.pool_id
      and match_tokens;
  } with match

function get_should_rebalance(
  const strategy: address;
  const tokens  : map(token_pool_idx_t, nat))
                : bool is
  unwrap(
      (Tezos.call_view("should_rebalance", tokens, strategy): option(bool)),
      Errors.Strategy.no_should_rebalance_view
    )


function operate_with_strategy(
  const tokens          : map(token_pool_idx_t, nat);
  const strategy        : address;
  const manual          : bool)
                        : operation is
  Tezos.transaction(
    (record[
      tokens = tokens;
      manual = manual
    ]: upd_state_t),
    0mutez,
    get_update_state_entrypoint(strategy)
  )


function check_rebalansing_strategy(
  const strategy            : option(address);
  const tokens_to_rebalance : map(token_pool_idx_t, nat))
                            : option(operation) is
  case strategy of [
    | Some(strategy) -> if get_should_rebalance(strategy, tokens_to_rebalance)
        then Some(operate_with_strategy(
            tokens_to_rebalance,
            strategy,
            False
          ))
        else None
    | None -> None
  ];