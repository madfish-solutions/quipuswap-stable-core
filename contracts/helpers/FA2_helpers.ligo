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

[@inline]
function get_account_data(
  const key: address * token_id_t;
  const acc_bm: big_map((address * pool_id_t), account_data_t)
  ): account_data_t is
  case acc_bm[key] of
    Some(data) -> data
  | None -> (record [
    allowances      = (set[]  : set(address));
    earned_interest = (map[]  : map(token_t, account_rwrd_t));
  ]: account_data_t)
  end;

(* Perform transfers from one owner *)
[@inline]
function iterate_transfer(
  var s                 : full_storage_t;
  const user_trx_params : trsfr_fa2_prm_t)
                        : full_storage_t is
  block {
    function make_transfer(
      var s             : full_storage_t;
      const transfer    : trsfr_fa2_dst_t)
                        : full_storage_t is
      block {
        const user_key : (address * nat) =
          (user_trx_params.from_,
          transfer.token_id);
        var sender_balance : nat := unwrap_or(s.storage.ledger[user_key], 0n);
        var sender_allowance: set(address) := case s.storage.account_data[user_key] of
            Some(data) -> data.allowances
          | None -> (set[]: set(address))
          end;
        check_permissions(user_trx_params.from_, sender_allowance);
        sender_balance := nat_or_error(sender_balance - transfer.amount, "FA2_INSUFFICIENT_BALANCE");
        s.storage.ledger[user_key] := sender_balance;

        var dest_account : nat :=
          unwrap_or(s.storage.ledger[(transfer.to_, transfer.token_id)], 0n);

        dest_account := dest_account + transfer.amount;
        s.storage.ledger[(transfer.to_, transfer.token_id)] := dest_account;
    } with s;
} with List.fold(make_transfer, user_trx_params.txs, s)

(* Perform single operator update *)
[@inline]
function iterate_update_operator(
  var s                 : full_storage_t;
  const params          : upd_operator_prm_t
)                       : full_storage_t is
  block {
    case params of
      Add_operator(param) -> {
      is_owner(param.owner);
      const owner_key = (param.owner, param.token_id);
      var account_data: account_data_t := get_account_data(owner_key, s.storage.account_data);
      account_data.allowances := Set.add(param.operator, account_data.allowances);
      s.storage.account_data[owner_key] := account_data;
    }
    | Remove_operator(param) -> {
      is_owner(param.owner);
      const owner_key = (param.owner, param.token_id);
      var account_data: account_data_t := get_account_data(owner_key, s.storage.account_data);
      account_data.allowances := Set.remove(param.operator, account_data.allowances);
      s.storage.account_data[owner_key] := account_data;
    }
    end
  } with s

