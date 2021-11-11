(*

The function is responsible for fiding the appropriate method
based on the argument type.

*)
[@inline]
function call_dex(
  const p               : action_type;
  var s                 : full_storage_type)
                        : full_return_type is
  block {
    const idx : nat = case (p: action_type) of
    (* Base actions *)
    | AddPair(_)              -> 0n
    | Swap(_)                 -> 1n
    | Invest(_)               -> 2n
    | Divest(_)               -> 3n
    (* Custom actions *)
    | DivestImbalanced(_)     -> 4n
    | DivestOneCoin(_)        -> 5n
    // | Claim(_)                -> 6n
    | ClaimDeveloper(_)       -> 6n
    | ClaimReferral(_)        -> 7n
    | ClaimStaking(_)         -> 8n
    | ClaimLProvider (_)      -> 9n
    (* Admin actions *)
    | RampA(_)                -> 10n
    | StopRampA(_)            -> 11n
    | SetProxy(_)             -> 12n
    | UpdateProxyLimits(_)    -> 13n
    | SetFees(_)              -> 14n
    (* VIEWS *)
    | Get_reserves(_)         -> 15n
    | Get_virt_reserves(_)    -> 16n
    | Get_fees(_)             -> 17n
    // | Min_received(_)         -> 15n
    // | Tokens_per_shares(_)    -> 16n
    // | Calc_divest_one_coin(_) -> 18n
    | Get_dy(_)               -> 19n
    | Get_a(_)                -> 20n

    end;

    const lambda_bytes : bytes = case s.dex_lambdas[idx] of
        | Some(l) -> l
        | None -> (failwith(ERRORS.unknown_func) : bytes)
      end;

    const res : return_type = case (Bytes.unpack(lambda_bytes) : option(dex_func_type)) of
        | Some(f) -> f(p, s.storage)
        | None -> (failwith("cant-unpack-use-lambda"): return_type)
      end;

    s.storage := res.1;
    // res.0 := Tezos.transaction(
    //   unit,
    //   0mutez,
    //   (Tezos.self("%close") : contract(unit))
    // ) # res.0;
} with (res.0, s)

(*

The function is responsible for fiding the appropriate method
based on the provided index.

*)
[@inline]
function call_token(
  const p               : token_action_type;
  var s                 : full_storage_type)
                        : full_return_type is
  block {
    const idx : nat = case p of
    | ITransfer(_)        -> 0n
    | IBalanceOf(_)       -> 1n
    | IUpdateOperators(_) -> 2n
    | IUpdateMetadata(_)  -> 3n
    | ITotalSupply(_)     -> 4n
    end;

    const lambda_bytes : bytes = case s.token_lambdas[idx] of
        | Some(l) -> l
        | None -> (failwith(ERRORS.unknown_func) : bytes)
      end;

    const (operations, new_storage) : full_return_type = case (Bytes.unpack(lambda_bytes) : option(token_func_type)) of
        | Some(f) -> f(p, s)
        | None -> (failwith("cant-unpack-use-lambda"): full_return_type)
      end;
  } with (operations, new_storage)

// [@inline]
// function close(
//   var s                 : full_storage_type)
//                         : full_storage_type is
//   block {
//     if not s.storage.entered
//     then failwith(ERRORS.not_entered)
//     else if Tezos.sender =/= Tezos.self_address
//     then failwith(ERRORS.sender_not_self)
//     else skip;
//     s.storage.entered := False;
//   } with s

[@inline]
function set_dex_function(
  const idx             : nat;
  const f               : bytes;
  var   s               : full_storage_type)
                        : full_storage_type is
  block {
    is_admin(s.storage.admin);
    case s.dex_lambdas[idx] of
    | Some(_) -> failwith(ERRORS.func_set)
    | None -> s.dex_lambdas[idx] := f
    end;
  } with s

[@inline]
function set_token_function(
  const idx             : nat;
  const f               : bytes;
  var s                 : full_storage_type)
                        : full_storage_type is
  block {
    is_admin(s.storage.admin);
    case s.token_lambdas[idx] of
    | Some(_) -> failwith(ERRORS.func_set)
    | None -> s.token_lambdas[idx] := f
    end;
  } with s

function add_rem_managers(
  const params          : add_rem_man_params;
  var s                 : full_storage_type)
                        : full_return_type is
  block {
    is_admin(s.storage.admin);
    s.storage.managers := if params.add
      then Set.add(params.candidate, s.storage.managers)
    else Set.remove(params.candidate, s.storage.managers);
  } with (CONSTANTS.no_operations, s)

function set_dev_address(
  const new_addr        : address;
  var s                 : full_storage_type)
                        : full_return_type is
  block {
    is_admin(s.storage.admin);
    s.storage.dev_address := new_addr;
  } with (CONSTANTS.no_operations, s)

function set_reward_rate(
  const rate            : nat;
  var s                 : full_storage_type)
                        : full_return_type is
  block {
    is_admin(s.storage.admin);
    s.storage.reward_rate := rate;
  } with (CONSTANTS.no_operations, s)

function set_admin(
  const new_admin       : address;
  var s                 : full_storage_type)
                        : full_return_type is
  block {
    is_admin(s.storage.admin);
    s.storage.admin := new_admin;
  } with (CONSTANTS.no_operations, s)
