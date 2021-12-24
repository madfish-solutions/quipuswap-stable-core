(* 0n *)
function transfer_ep(
    const p             : token_action_t;
    var s               : full_storage_t;
    const action        : full_action_t
  )                     : full_return_t is
  block {
    var operations: list(operation) := Constants.no_operations;
    case p of
    | Transfer(params) ->  s := List.fold(iterate_transfer, params, transfer_sender_check(params, action, s))
    | _                 -> skip
    end
  } with (operations, s)

(* 2n *)
function update_operators(
  const p               : token_action_t;
  var   s               : full_storage_t;
  const action          : full_action_t
  )                     : full_return_t is
  block {
    var operations: list(operation) := Constants.no_operations;
    case p of
    | Update_operators(params) -> s := List.fold(
      iterate_update_operator,
      params,
      sender_check(Tezos.sender, s, action, "FA2_NOT_OWNER")
    )
    | _ -> skip
    end
  } with (operations, s)

(* 3n *)
function update_token_metadata(
    const p             : token_action_t;
    var   s             : full_storage_t;
    const _action       : full_action_t
  )                     : full_return_t is
  block {
    var operations: list(operation) := Constants.no_operations;
    case p of
    | Update_metadata(params) -> {
      assert_with_error(s.storage.managers contains Tezos.sender, Errors.not_manager);
      s.token_metadata[params.token_id] := params
    }
    | _ -> skip
    end
  } with (operations, s)


