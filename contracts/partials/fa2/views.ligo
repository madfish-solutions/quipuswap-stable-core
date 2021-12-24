(* 1n *)
function get_balance_of(
    const p             : token_action_t;
    const s             : full_storage_t;
    const _action       : full_action_t
  )                     : full_return_t is
  block {
    var operations: list(operation) := Constants.no_operations;
    case p of
    | Balance_of(params) -> {
      function bal_look_up(
        const l           : list (balance_of_fa2_res_t);
        const request   : balance_of_fa2_req_t
        )               : list (balance_of_fa2_res_t) is
        block {
          const entry = record [
            request   = request;
            balance   = unwrap_or(s.storage.ledger[(request.owner, request.token_id)], 0n);
          ]
        } with entry # l;
      const accumulator = List.fold(
          bal_look_up,
          params.requests,
          (nil: list(balance_of_fa2_res_t))
        );
      operations := Tezos.transaction(
          accumulator,
          0mutez,
          params.callback
        ) # operations;
    }
    | _                 -> skip
    end
  } with (operations, s)

(* 4n *)
function total_supply_view(
  const p               : token_action_t;
  var   s               : full_storage_t;
  const _action         : full_action_t
  )                     : full_return_t is
  block {
    var operations: list(operation) := Constants.no_operations;
    case p of
    | Total_supply(params) -> {
      const pair : pair_t = unwrap(s.storage.pools[params.token_id], Errors.pair_not_listed);
      operations := Tezos.transaction(
        pair.total_supply,
        0tz,
        params.receiver
      ) # operations;
    }
    | _ -> skip
    end
  } with (operations, s)