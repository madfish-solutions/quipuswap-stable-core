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

(* Lambda setter (only for admin usage in init setup) *)
[@inline] function set_function(
  const f_type          : func_entry_t;
  const params          : set_lambda_func_t;
  var   s               : full_storage_t)
                        : full_storage_t is
  block {
    check_admin(s.storage.admin);
    case f_type of
    | FAdmin  -> s.admin_lambdas := set_func_or_fail(params, Constants.admin_func_count,  s.admin_lambdas)
    | FPermit -> s.permit_lambdas := set_func_or_fail(params, Constants.permit_func_count, s.permit_lambdas)
    | FDex    -> s.dex_lambdas := set_func_or_fail(params, Constants.dex_func_count, s.dex_lambdas)
    | FToken  -> s.token_lambdas := set_func_or_fail(params, Constants.token_func_count,  s.token_lambdas)
#if FACTORY
    | _ -> skip
#else
    | FDev   -> s.storage.dev_store.dev_lambdas := set_func_or_fail(params, Constants.dev_func_count,  s.storage.dev_store.dev_lambdas)
#endif
    end
  } with s