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


