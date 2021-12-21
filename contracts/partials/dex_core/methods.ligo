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
    (* Admin actions *)
    | Ramp_A(_)               -> 12n
    | Stop_ramp_A(_)          -> 13n
    | Set_fees(_)             -> 16n
    | Set_default_referral(_) -> 17n
    (* QUIPU stakers *)
    | Stake(_)                -> 18n
    | Unstake(_)              -> 19n
    (* VIEWS *)
    | Get_tokens_info(_)      -> 20n
    | Get_fees(_)             -> 21n
    | Get_dy(_)               -> 22n
    | Get_A(_)                -> 23n

    end;

    const lambda_bytes : bytes = unwrap(s.dex_lambdas[idx], Errors.unknown_func);
    const func: dex_func_t = unwrap((Bytes.unpack(lambda_bytes) : option(dex_func_t)), Errors.wrong_use_function);
    const result: return_t = func(p, s.storage);
    s.storage := result.1;
} with (result.0, s)

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