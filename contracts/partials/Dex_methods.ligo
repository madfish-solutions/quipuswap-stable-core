(*

The function is responsible for fiding the appropriate method
based on the argument type.

*)
[@inline]
function call_dex(
  const p               : action_t;
  var s                 : full_storage_t)
                        : full_return_t is
  block {
    const idx : nat = case (p: action_t) of
    (* Base actions *)
    | Add_pair(_)             -> 0n
    | Swap(_)                 -> 1n
    | Invest(_)               -> 2n
    | Divest(_)               -> 3n
    (* Custom actions *)
    | Divest_imbalanced(_)    -> 4n
    | Divest_one_coin(_)      -> 5n
    | Claim_developer(_)      -> 6n
    | Claim_referral(_)       -> 7n
    | Claim_liq_provider (_)  -> 8n
    (* Admin actions *)
    | Ramp_A(_)               -> 9n
    | Stop_ramp_A(_)          -> 10n
    | Set_proxy(_)            -> 11n
    | Update_proxy_limits(_)  -> 12n
    | Set_fees(_)             -> 13n
    | Set_default_referral(_) -> 14n
    (* QUIPU stakers *)
    | Stake(_)                -> 16n
    | Unstake(_)              -> 17n
    (* VIEWS *)
    | Get_tokens_info(_)      -> 18n
    | Get_fees(_)             -> 19n
    | Get_dy(_)               -> 20n
    | Get_A(_)                -> 21n

    end;

    const lambda_bytes : bytes = unwrap(s.dex_lambdas[idx], Errors.unknown_func);
    const func = unwrap((Bytes.unpack(lambda_bytes) : option(dex_func_t)), "cant-unpack-use-lambda");
    const (operations, store) : return_t = func(p, s.storage);
} with (operations, s with record[ storage = store])

(*

The function is responsible for fiding the appropriate method
based on the provided index.

*)
[@inline]
function call_token(
  const p               : token_action_t;
  var s                 : full_storage_t;
  const action          : full_action_t)
                        : full_return_t is
  block {
    const idx : nat = case p of
    | Transfer(_)         -> 0n
    | Balance_of(_)       -> 1n
    | Update_operators(_) -> 2n
    | Update_metadata(_)  -> 3n
    | Total_supply(_)     -> 4n
    end;
    const lambda_bytes : bytes = unwrap(s.token_lambdas[idx], Errors.unknown_func);
    const func = unwrap((Bytes.unpack(lambda_bytes) : option(tkn_func_t)), "cant-unpack-use-lambda");
  } with func(p, s, action);


(*

The function is responsible for fiding the appropriate method
based on the provided index.

*)
[@inline]
function call_permit(
  const p               : permit_action_t;
  var s                 : full_storage_t;
  const action          : full_action_t)
                        : full_return_t is
  block {
    const idx : nat = case p of
    | Permit(_)     -> 0n
    | Set_expiry(_) -> 1n
    end;

    const lambda_bytes : bytes = unwrap(s.permit_lambdas[idx], Errors.unknown_func);
    const func = unwrap((Bytes.unpack(lambda_bytes) : option(permit_func_t)), "cant-unpack-use-lambda");
  } with (Constants.no_operations, func(p, s, action))

[@inline]
function call_admin(
  const p               : admin_action_t;
  var s                 : full_storage_t)
                        : full_return_t is
  block {
    is_admin(s.storage.admin);
    const idx : nat = case p of
    | Add_rem_managers(_) -> 0n
    | Set_dev_address(_)  -> 1n
    | Set_reward_rate(_)  -> 2n
    | Set_admin(_)        -> 3n
    end;

    const lambda_bytes : bytes = unwrap(s.admin_lambdas[idx], Errors.unknown_func);
    const func = unwrap((Bytes.unpack(lambda_bytes) : option(admin_func_t)), "cant-unpack-use-lambda");
  } with (Constants.no_operations, s with record[ storage = func(p, s.storage) ])

[@inline]
function set_function(
  const f_type          : func_entry_t;
  const params          : set_lambda_func_t;
  var   s               : full_storage_t)
                        : full_return_t is
  block { is_admin(s.storage.admin) } with (
    Constants.no_operations,
    case f_type of
      FAdmin  -> s with record[admin_lambdas  = set_func_or_fail(params, Constants.admin_func_count,  s.admin_lambdas)]
    | FPermit -> s with record[permit_lambdas = set_func_or_fail(params, Constants.permit_func_count, s.permit_lambdas)]
    | FDex    -> s with record[dex_lambdas    = set_func_or_fail(params, Constants.dex_func_count,    s.dex_lambdas)]
    | FToken  -> s with record[token_lambdas  = set_func_or_fail(params, Constants.token_func_count,  s.token_lambdas)]
    end
  )