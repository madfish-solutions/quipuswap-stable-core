(* This methods called only by admin and modifies only `storage` property of full storage *)
[@inline] function call_admin(
  const p               : admin_action_t;
  var s                 : full_storage_t)
                        : full_return_t is
  block {
#if FACTORY
    assert_with_error(s.storage.started, Errors.Dex.not_started);
#endif

    const idx : nat = case p of
    | Add_rem_managers(_) -> 0n
    | Set_admin(_)        -> 1n
    (* Admin actions *)
    | Claim_developer(_)      -> 2n
    | Ramp_A(_)               -> 3n
    | Stop_ramp_A(_)          -> 4n
    | Set_fees(_)             -> 5n
    | Set_default_referral(_) -> 6n
#if !FACTORY
    | Add_pool(_)             -> 7n
#endif
    end;

    if not (idx = 2n)
    then check_admin(s.storage.admin)
    else skip;

    const lambda_bytes : bytes = unwrap(s.admin_lambdas[idx], Errors.Dex.unknown_func);
    const func: admin_func_t = unwrap((Bytes.unpack(lambda_bytes) : option(admin_func_t)), Errors.Dex.wrong_use_function);
    const (operations, storage) = func(p, s.storage);
  } with (operations, s with record[ storage = storage ])
