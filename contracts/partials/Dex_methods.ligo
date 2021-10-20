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
    // s.storage.entered := check_reentrancy(s.storage.entered);

    const idx : nat = case p of
    | AddPair(_)              -> 0n
    // | Swap(_)                 -> 1n
    | Invest(_)               -> 2n
    // | Divest(_)               -> 3n
    // | Invest_one(_)           -> 4n
    // | Divest_one(_)           -> 5n
    // | Claim_admin_rewards(_)  -> 6n
    | RampA(_)                -> 7n
    | StopRampA(_)            -> 8n
    | SetProxy(_)             -> 9n
    | UpdateProxyLimits(_)    -> 10n
    // | Get_reserves(_)         -> 11n
    // | Min_received(_)         -> 12n
    // | Tokens_per_shares(_)    -> 13n
    // | Calc_divest_one_coin(_) -> 14n
    // | Get_dy(_)               -> 15n
    // | Get_a(_)                -> 16n

    end;

    const lambda_bytes : bytes = case s.dex_lambdas[idx] of
        | Some(l) -> l
        | None -> (failwith(err_unknown_func) : bytes)
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
        | None -> (failwith(err_unknown_func) : bytes)
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
//     then failwith(err_not_entered)
//     else if Tezos.sender =/= Tezos.self_address
//     then failwith(err_sender_not_self)
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
    is_admin(s.storage);
    case s.dex_lambdas[idx] of
    | Some(_) -> failwith(err_func_set)
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
    is_admin(s.storage);
    case s.token_lambdas[idx] of
    | Some(_) -> failwith(err_func_set)
    | None -> s.token_lambdas[idx] := f
    end;
  } with s


function set_fees(
  const params          : set_fee_type;
  var s                 : full_storage_type
  )                     : full_return_type is
  block {
    is_admin(s.storage);
    var pair := get_pair(params.pool_id, s.storage);
    pair.fee := params.fee;
    s.storage.pools[params.pool_id] := pair;
  } with (no_operations, s)

function add_rem_managers(
  const params          : add_rem_man_params;
  var s                 : full_storage_type)
                        : full_return_type is
  block {
    is_admin(s.storage);
    s.storage.managers := if params.add
      then Set.add(params.candidate, s.storage.managers)
    else Set.remove(params.candidate, s.storage.managers);
  } with (no_operations, s)

function set_dev_address(
  const new_addr        : address;
  var s                 : full_storage_type)
                        : full_return_type is
  block {
    is_admin(s.storage);
    s.storage.dev_address := new_addr;
  } with (no_operations, s)

function set_reward_rate(
  const rate            : nat;
  var s                 : full_storage_type)
                        : full_return_type is
  block {
    is_admin(s.storage);
    s.storage.reward_rate := rate;
  } with (no_operations, s)

function set_admin(
  const new_admin       : address;
  var s                 : full_storage_type)
                        : full_return_type is
  block {
    is_admin(s.storage);
    s.storage.admin := new_admin;
  } with (no_operations, s)
