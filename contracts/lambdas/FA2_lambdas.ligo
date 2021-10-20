(* Perform transfers from one owner *)
[@inline]
function iterate_transfer(
  var s                 : full_storage_type;
  const user_trx_params : transfer_fa2_param)
                        : full_storage_type is
  block {
    function make_transfer(
      var s             : full_storage_type;
      const transfer    : transfer_fa2_destination)
                        : full_storage_type is
      block {
        const user_key : (address * nat) =
          (user_trx_params.from_,
          transfer.token_id);
        var sender_balance : nat := get_account(user_key, s.storage);
        var sender_allowance: set(address) := case s.storage.account_data[user_key] of
            Some(data) -> data.allowances
          | None -> (set[]: set(address))
          end;
        check_permissions(user_trx_params.from_, sender_allowance);
        check_balance(sender_balance, transfer.amount);

        sender_balance := abs(sender_balance - transfer.amount);
        s.storage.ledger[user_key] := sender_balance;

        var dest_account : nat :=
          get_account((transfer.to_, transfer.token_id), s.storage);

        dest_account := dest_account + transfer.amount;
        s.storage.ledger[(transfer.to_, transfer.token_id)] := dest_account;
    } with s;
} with List.fold(make_transfer, user_trx_params.txs, s)

(* Perform single operator update *)
function iterate_update_operator(
  var s                 : full_storage_type;
  const params          : update_operator_param
)                       : full_storage_type is
  block {
    case params of
      Add_operator(param) -> {
      is_owner(param.owner);

      var account_data: account_data_type := case s.storage.account_data[(param.owner, param.token_id)] of
            Some(data) -> data
          | None -> record [
            allowances      = (set[]  : set(address));
            earned_interest = (map[]  : map(token_type, acc_reward_type));
          ]
          end;
      account_data.allowances := Set.add(param.operator, account_data.allowances);
      s.storage.account_data[(param.owner, param.token_id)] := account_data;
    }
    | Remove_operator(param) -> {
      is_owner(param.owner);

      var account_data: account_data_type := case s.storage.account_data[(param.owner, param.token_id)] of
            Some(data) -> data
          | None -> record [
            allowances      = (set[]  : set(address));
            earned_interest = (map[]  : map(token_type, acc_reward_type));
          ]
          end;
      account_data.allowances := Set.remove(param.operator, account_data.allowances);
      s.storage.account_data[(param.owner, param.token_id)] := account_data;
    }
    end
  } with s


function transfer_ep(
  const p               : token_action_type;
  var s                 : full_storage_type
)                       : full_return_type is
  block{
    case p of
    | ITransfer(params) ->  s := List.fold(iterate_transfer, params, s)
    | _                 -> skip
  end
} with (no_operations, s)

function get_balance_of(
  const p               : token_action_type;
  const s               : full_storage_type)
                        : full_return_type is
  block {
    var operations: list(operation) := no_operations;
    case p of
    | IBalanceOf(params) -> {
      function bal_look_up(
        const l           : list (balance_of_fa2_response);
        const request   : balance_of_fa2_request
        )               : list (balance_of_fa2_response) is
        block {
          const entry = record [
            request   = request;
            balance   = get_account((request.owner, request.token_id), s.storage);
          ]
        } with entry # l;
      const accumulator = List.fold(
          bal_look_up,
          params.requests,
          (nil: list(balance_of_fa2_response))
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

function update_operators(
  const p               : token_action_type;
  var   s               : full_storage_type)
                        : full_return_type is
  block {
    case p of
    | IUpdateOperators(params) -> s := List.fold(iterate_update_operator, params, s)
    | _ -> skip
    end
  } with (no_operations, s)

function update_token_metadata(
  const p               : token_action_type;
  var   s               : full_storage_type)
                        : full_return_type is
  block {
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
  } with (no_operations, s)

function total_supply_view(
  const p               : token_action_type;
  var   s               : full_storage_type)
                        : full_return_type is
  block {
    var operations: list(operation) := no_operations;
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
