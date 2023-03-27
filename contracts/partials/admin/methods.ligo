(* This methods called only by admin and modifies only `storage` property of full storage *)
[@inline] function call_admin(
  const p               : admin_action_t;
  var s                 : full_storage_t)
                        : full_return_t is
  block {
#if FACTORY
    require(s.storage.started, Errors.Dex.not_started);
#endif

    case p of [
    | Claim_developer(_) -> skip // Claim_developer has own inner check for developer address
#if !FACTORY
    | Set_strategy_factory(_)-> skip
#endif
    | _ -> require(Tezos.get_sender() = s.storage.admin, Errors.Dex.not_contract_admin)
    ];

    const idx : nat = case p of [
    | Add_rem_managers(_) -> 0n
    | Set_admin(_)        -> 1n
    (* Admin actions *)
    | Claim_developer(_)      -> 2n
    | Ramp_A(_)               -> 3n
    | Stop_ramp_A(_)          -> 4n
    | Set_fees(_)             -> 5n
    | Set_default_referral(_) -> 6n
    | Approve_spending(_)     -> 7n
#if !FACTORY
    | Add_pool(_)             -> 8n
    | Set_strategy_factory(_) -> 9n
#endif
    ];

    const lambda_bytes : bytes = unwrap(s.admin_lambdas[idx], Errors.Dex.unknown_func);
    const func: admin_func_t = unwrap((Bytes.unpack(lambda_bytes) : option(admin_func_t)), Errors.Dex.wrong_use_function);
    const (operations, storage) = func(p, s.storage);
  } with (operations, s with record[ storage = storage ])
