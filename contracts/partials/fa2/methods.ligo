(*

The function is responsible for fiding the appropriate method
based on the provided index.

*)
[@inline] function call_token(
  const p               : token_action_t;
  var s                 : full_storage_t)
                        : full_return_t is
  block {
#if FACTORY
    require(s.storage.started, Errors.Dex.not_started);
#endif
    const idx : nat = case p of [
    | Transfer(_)         -> 0n
    | Balance_of(_)       -> 1n
    | Update_operators(_) -> 2n
    | Update_metadata(_)  -> 3n
    | Total_supply(_)     -> 4n
    ];
    const lambda_bytes : bytes = unwrap(s.token_lambdas[idx], Errors.Dex.unknown_func);
    const func: token_func_t = unwrap((Bytes.unpack(lambda_bytes) : option(token_func_t)), Errors.Dex.wrong_use_function);
  } with func(p, s);
