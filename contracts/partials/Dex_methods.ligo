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
    // | Invest(_)               -> 2n
    // | Divest(_)               -> 3n
    // | Invest_one(_)           -> 4n
    // | Divest_one(_)           -> 5n
    // | Claim_admin_rewards(_)  -> 6n
    | RampA(_)                -> 7n
    | StopRampA(_)            -> 8n
    | SetProxy(_)             -> 9n
    | UpdateProxyLimits(_)    -> 10n
    // | Get_reserves(_)         -> 11n
    // | Total_supply(_)         -> 12n
    // | Min_received(_)         -> 13n
    // | Tokens_per_shares(_)    -> 14n
    // | Price_cummulative(_)    -> 15n
    // | Calc_divest_one_coin(_) -> 16n
    // | Get_dy(_)               -> 17n
    // | Get_a(_)                -> 18n

    end;

    var res : return_type := case s.dex_lambdas[idx] of
    | Some(f) -> f(p, s.storage)
    | None    -> (failwith(err_unknown_func) : return_type)
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
    | Transfer(_)         -> 0n
    | Balance_of(_)       -> 1n
    | Update_operators(_) -> 2n
    | Update_metadata(_)  -> 3n
    end;

    const res : return_type = case s.token_lambdas[idx] of
    | Some(f) -> f(p, s.storage)
    | None -> (failwith(err_unknown_func) : return_type)
    end;
    s.storage := res.1;
  } with (res.0, s)

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
  const f               : dex_func_type;
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
  const f               : token_func_type;
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
  const fees            : fees_storage_type;
  var s                 : full_storage_type)
                        : full_return_type is
  block {
    is_admin(s.storage);
    s.storage.fee := fees;
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

function set_public_init(var s: full_storage_type): full_return_type is
  block {
    is_admin(s.storage);
    s.storage.is_public_init := not s.storage.is_public_init;
  } with (no_operations, s)

