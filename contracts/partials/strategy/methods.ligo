(* This methods called only by dev and modifies only `storage` property of full storage *)
[@inline] function call_strategy(
  const p               : strategy_action_t;
  var s                 : full_storage_t)
                        : full_return_t is
  block {
    const dev_address = get_dev_address(s.storage);
    require(Tezos.sender = dev_address, Errors.Dex.not_developer);
    const idx : nat = case p of [
    | Connect_strategy(_)               -> 0n
    | Set_token_strategy(_)             -> 1n
    | Set_token_strategy_rebalance(_)   -> 2n
    ];

    const lambda_bytes : bytes = unwrap(s.strat_lambdas[idx], Errors.Dex.unknown_func);
    const func: strat_func_t = unwrap((Bytes.unpack(lambda_bytes) : option(strat_func_t)), Errors.Dex.wrong_use_function);
    const (operations, storage) = func(p, s.storage);
  } with (operations, s with record[ storage = storage ])