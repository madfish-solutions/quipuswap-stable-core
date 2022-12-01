(* 0n *)
function transfer_ep(
    const p             : token_action_t;
    var s               : full_storage_t)
                        : full_return_t is
  case p of [
  | Transfer(params)  -> (Constants.no_operations, List.fold(iterate_transfer, params, s))
  | _                 -> unreachable(Unit)
  ]

(* 2n *)
function update_operators(
  const p               : token_action_t;
  var   s               : full_storage_t)
                        : full_return_t is
  case p of [
  | Update_operators(params) -> (Constants.no_operations, List.fold(iterate_update_operator, params, s))
  | _ -> unreachable(Unit)
  ]

(* 3n *)
function update_token_metadata(
    const p             : token_action_t;
    var   s             : full_storage_t)
                        : full_return_t is
  block {
    var operations := Constants.no_operations;
    case p of [
    | Update_metadata(params) -> {
      require(s.storage.managers contains Tezos.get_sender(), Errors.Dex.not_manager);
      s.storage.token_metadata[params.token_id] := params
    }
    | _ -> unreachable(Unit)
    ]
  } with (operations, s)


