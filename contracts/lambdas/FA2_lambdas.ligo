(* 0n *)
function transfer_ep(
    const p             : token_action_type;
    var s               : full_storage_t
  )                     : full_return_t is
  block {
    var operations: list(operation) := CONSTANTS.no_operations;
    case p of
    | ITransfer(params) ->  s := List.fold(iterate_transfer, params, transfer_sender_check(params, action, s))
    | _                 -> skip
    end
  } with (operations, s)

(* 1n *)
function get_balance_of(
    const p             : token_action_type;
    const s             : full_storage_t
  )                     : full_return_t is
  block {
    var operations: list(operation) := CONSTANTS.no_operations;
    case p of
    | IBalanceOf(params) -> {
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
  const p               : token_action_type;
  var   s               : full_storage_t
  )                     : full_return_t is
  block {
    var operations: list(operation) := CONSTANTS.no_operations;
    case p of
    | IUpdateOperators(params) -> s := List.fold(iterate_update_operator, params, s)
    | _ -> skip
    end
  } with (operations, s)

(* 3n *)
function update_token_metadata(
    const p             : token_action_type;
    var   s             : full_storage_t
  )                     : full_return_t is
  block {
    var operations: list(operation) := CONSTANTS.no_operations;
    case p of
    | IUpdateMetadata(params) -> {
      if s.storage.managers contains Tezos.sender
      then {
        s.token_metadata[params.token_id] := params
      }
      else failwith("not_manager");
    }
    | _ -> skip
    end
  } with (operations, s)


