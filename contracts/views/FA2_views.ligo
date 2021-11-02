(* 4n *)
function total_supply_view(
  const p               : token_action_type;
  var   s               : full_storage_type
  )                     : full_return_type is
  block {
    var operations: list(operation) := CONSTANTS.no_operations;
    case p of
    | ITotalSupply(params) -> {
      const pair : pair_type = get_pair(params.pool_id, s.storage);
      operations := Tezos.transaction(
        pair.total_supply,
        0tz,
        params.receiver
      ) # operations;
    }
    | _ -> skip
    end
  } with (operations, s)