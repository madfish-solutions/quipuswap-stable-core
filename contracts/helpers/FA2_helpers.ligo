(* Check permissions *)
[@inline]
function check_permissions(const from_account: address; const allowances: set(address)): unit is
  if from_account =/= Tezos.sender and not (allowances contains Tezos.sender)
    then failwith("FA2_NOT_OPERATOR");
  else Unit;

(* Balance check *)
[@inline]
function check_balance(const account_bal: nat; const to_spend: nat): unit is
  if account_bal < to_spend
    then failwith("FA2_INSUFFICIENT_BALANCE")
  else Unit;

(* Owner check *)
[@inline]
function is_owner(const owner: address): unit is
  if Tezos.sender =/= owner
    then failwith("FA2_NOT_OWNER")
  else Unit;

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
        sender_balance := nat_or_error(sender_balance - transfer.amount, "FA2_INSUFFICIENT_BALANCE");
        s.storage.ledger[user_key] := sender_balance;

        var dest_account : nat :=
          get_account((transfer.to_, transfer.token_id), s.storage);

        dest_account := dest_account + transfer.amount;
        s.storage.ledger[(transfer.to_, transfer.token_id)] := dest_account;
    } with s;
} with List.fold(make_transfer, user_trx_params.txs, s)

(* Perform single operator update *)
[@inline]
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

