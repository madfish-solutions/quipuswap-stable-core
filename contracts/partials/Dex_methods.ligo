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
    | AddPair(_)              -> 0n
    | Swap(_)                 -> 1n
    | Invest(_)               -> 2n
    | Divest(_)               -> 3n
    (* Custom actions *)
    | DivestImbalanced(_)     -> 4n
    | DivestOneCoin(_)        -> 5n
    | ClaimDeveloper(_)       -> 6n
    | ClaimReferral(_)        -> 7n
    | ClaimLProvider (_)      -> 8n
    (* Admin actions *)
    | RampA(_)                -> 9n
    | StopRampA(_)            -> 10n
    | SetProxy(_)             -> 11n
    | UpdateProxyLimits(_)    -> 12n
    | SetFees(_)              -> 13n
    | SetDefaultReferral(_)   -> 14n
    (* QUIPU stakers *)
    | Stake(_)                -> 16n
    | Unstake(_)              -> 17n
    (* VIEWS *)
    | GetTokensInfo(_)        -> 18n
    | GetFees(_)              -> 19n
    | GetDy(_)                -> 20n
    | GetA(_)                 -> 21n

    end;

    const lambda_bytes : bytes = case s.dex_lambdas[idx] of
        | Some(l) -> l
        | None -> (failwith(ERRORS.unknown_func) : bytes)
      end;

    const res : return_t = case (Bytes.unpack(lambda_bytes) : option(dex_func_t)) of
        | Some(f) -> f(p, s.storage)
        | None -> (failwith("cant-unpack-use-lambda"): return_t)
      end;

    s.storage := res.1;
} with (res.0, s)

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
    | Transfer(_)        -> 0n
    | Balance_of(_)       -> 1n
    | Update_operators(_) -> 2n
    | Update_metadata(_)  -> 3n
    | Total_supply(_)     -> 4n
    end;

    const lambda_bytes : bytes = case s.token_lambdas[idx] of
        | Some(l) -> l
        | None -> (failwith(ERRORS.unknown_func) : bytes)
      end;

    const (operations, new_storage) : full_return_t = case (Bytes.unpack(lambda_bytes) : option(tkn_func_t)) of
        | Some(f) -> f(p, s, action)
        | None -> (failwith("cant-unpack-use-lambda"): full_return_t)
      end;
  } with (operations, new_storage)


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

    const lambda_bytes : bytes = case s.permit_lambdas[idx] of
        | Some(l) -> l
        | None -> (failwith(ERRORS.unknown_func) : bytes)
      end;

    const storage : full_storage_t = case (Bytes.unpack(lambda_bytes) : option(permit_func_t)) of
        | Some(f) -> f(p, s, action)
        | None -> (failwith("cant-unpack-use-lambda"): full_storage_t)
      end;
  } with (CONSTANTS.no_operations, storage)

[@inline]
function call_admin(
  const p               : admin_action_t;
  var s                 : full_storage_t)
                        : full_return_t is
  block {
    is_admin(s.storage.admin);
    const idx : nat = case p of
    | AddRemManagers(_)  -> 0n
    | SetDevAddress(_)   -> 1n
    | SetRewardRate(_)   -> 2n
    | SetAdmin(_)        -> 3n
    end;

    const lambda_bytes : bytes = case s.admin_lambdas[idx] of
        | Some(l) -> l
        | None -> (failwith(ERRORS.unknown_func) : bytes)
      end;
    const storage : storage_t = case (Bytes.unpack(lambda_bytes) : option(admin_func_t)) of
        | Some(f) -> f(p, s.storage)
        | None -> (failwith("cant-unpack-use-lambda"): storage_t)
      end;
  } with (CONSTANTS.no_operations, s with record[ storage = storage ])

[@inline]
function set_function(
  const f_type          : func_entry_t;
  const params          : set_lambda_func_t;
  var   s               : full_storage_t)
                        : full_return_t is
  block {
    is_admin(s.storage.admin);
    const storage = case f_type of
      FAdmin -> s with record[
        admin_lambdas = set_func_or_fail(params, CONSTANTS.admin_func_count, s.admin_lambdas)
    ]
    | FPermit -> s with record[
        permit_lambdas = set_func_or_fail(params, CONSTANTS.permit_func_count, s.permit_lambdas)
    ]
    | FDex -> s with record[
        dex_lambdas = set_func_or_fail(params, CONSTANTS.dex_func_count, s.dex_lambdas)
    ]
    | FToken -> s with record[
        token_lambdas = set_func_or_fail(params, CONSTANTS.token_func_count, s.token_lambdas)
    ]
    end
  } with (CONSTANTS.no_operations, storage)