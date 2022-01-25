(*

The function is responsible for fiding the appropriate method
based on the argument type.

*)
[@inline] function call_dex(
  const p               : dex_action_t;
  var s                 : full_storage_t)
                        : full_return_t is
  block {
#if FACTORY
    assert_with_error(s.storage.started, Errors.Dex.not_started);
#endif
    const idx : nat = case p of
    (* Base actions *)
    | Swap(_)                 -> 0n
    | Invest(_)               -> 1n
    | Divest(_)               -> 2n
    (* Custom actions *)
    | Divest_imbalanced(_)    -> 3n
    | Divest_one_coin(_)      -> 4n
    | Claim_referral(_)       -> 5n
    (* QUIPU stakers *)
    | Stake(_)                -> 6n
    | Unstake(_)              -> 7n
    end;

    const lambda_bytes : bytes = unwrap(s.dex_lambdas[idx], Errors.Dex.unknown_func);
    const func: dex_func_t = unwrap((Bytes.unpack(lambda_bytes) : option(dex_func_t)), Errors.Dex.wrong_use_function);
    const result: return_t = func(p, s.storage);
    s.storage := result.1;
    s := sender_check(Tezos.sender, s, Use_dex(p), Errors.Permit.not_permitted)
} with (result.0, s)


[@inline] function call_permittable_action(
  const p               : permittable_action_t;
  var s                 : full_storage_t)
                        : full_return_t is
  block {
    var operations: list(operation) := Constants.no_operations;
    case p of
    | Use_permit(params) -> s := call_permit(params, s)
    | _ -> skip
    end
  } with case p of
    | Use_dex(params)   -> call_dex(params, s)
    | Use_token(params) -> call_token(params, s)
    | _ -> (operations, s)
    end