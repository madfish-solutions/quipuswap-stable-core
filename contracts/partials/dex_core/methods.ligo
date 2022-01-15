(*

The function is responsible for fiding the appropriate method
based on the argument type.

*)
[@inline] function call_dex(
  const p               : action_t;
  var s                 : full_storage_t)
                        : full_return_t is
  block {
    const idx : nat = case p of
    (* Base actions *)
    | Add_pool(_)             -> 0n
    | Swap(_)                 -> 1n
    | Invest(_)               -> 2n
    | Divest(_)               -> 3n
    (* Custom actions *)
    | Divest_imbalanced(_)    -> 4n
    | Divest_one_coin(_)      -> 5n
    | Claim_developer(_)      -> 6n
    | Claim_referral(_)       -> 7n
    (* Admin actions *)
    | Ramp_A(_)               -> 8n
    | Stop_ramp_A(_)          -> 9n
    | Set_fees(_)             -> 10n
    | Set_default_referral(_) -> 11n
    (* QUIPU stakers *)
    | Stake(_)                -> 12n
    | Unstake(_)              -> 13n
    end;

    const lambda_bytes : bytes = unwrap(s.dex_lambdas[idx], Errors.Dex.unknown_func);
    const func: dex_func_t = unwrap((Bytes.unpack(lambda_bytes) : option(dex_func_t)), Errors.Dex.wrong_use_function);
    const result: return_t = func(p, s.storage);
    s.storage := result.1;
} with (result.0, s)