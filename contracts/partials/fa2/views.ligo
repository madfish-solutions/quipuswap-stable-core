(* 1n *)
[@view] function get_balance(
  const p               : list(balc_of_fa2_req_t);
  const s               : full_storage_t)
                        : list(balc_of_fa2_res_t) is
  block {
    function bal_look_up(
      const request     : balc_of_fa2_req_t)
                        : balc_of_fa2_res_t is
      block {
        require(request.token_id < s.storage.pools_count, Errors.FA2.undefined);
        const user_balance = unwrap_or(s.storage.ledger[(request.owner, request.token_id)], 0n);
      } with record [
            request = request;
            balance = user_balance;
          ];
   } with List.map(bal_look_up, p)

function get_balance_of(
    const p             : token_action_t;
    const s             : full_storage_t)
                        : full_return_t is
  block {
    var operations := Constants.no_operations;
    case p of [
    | Balance_of(params) -> {
      operations := Tezos.transaction(
          get_balance(params.requests, s),
          0mutez,
          params.callback
        ) # operations;
    }
    | _                 -> unreachable(Unit)
    ]
  } with (operations, s)

(* 4n *)
[@view] function get_total_supply(
  const token_id        : token_id_t;
  const s               : full_storage_t)
                        : nat is
  block {
    const pool = unwrap(s.storage.pools[token_id], Errors.Dex.pool_not_listed);
   } with pool.total_supply

function total_supply_view(
  const p               : token_action_t;
  const s               : full_storage_t)
                        : full_return_t is
  block {
    var operations := Constants.no_operations;
    case p of [
    | Total_supply(params) -> {
      operations := Tezos.transaction(
        get_total_supply(params.token_id, s),
        0tz,
        params.receiver
      ) # operations;
    }
    | _ -> unreachable(Unit)
    ]
  } with (operations, s)