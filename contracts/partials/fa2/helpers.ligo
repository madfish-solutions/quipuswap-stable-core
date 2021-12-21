(* Check permissions *)
[@inline]
function check_permissions(const from_account: address; const allowances: set(address)): unit is
  if from_account =/= Tezos.sender and not (allowances contains Tezos.sender)
    then failwith(Errors.not_operator);
  else Unit;

(* Balance check *)
[@inline]
function check_balance(const account_bal: nat; const to_spend: nat): unit is
  if account_bal < to_spend
    then failwith(Errors.insufficient_balance)
  else Unit;

(* Owner check *)
[@inline]
function is_owner(const owner: address): unit is
  if Tezos.sender =/= owner
    then failwith(Errors.not_owner)
  else Unit;

[@inline]
function get_account_data(
  const key: address * pool_id_t;
  const acc_bm: big_map((address * pool_id_t), account_data_t)
  ): account_data_t is
  unwrap_or(acc_bm[key], record [
    allowances      = (set[]  : set(address));
    earned_interest = (map[]  : map(token_t, account_rwrd_t));
  ]);

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
        const sender_key =  (user_trx_params.from_, transfer.token_id);
        var sender_balance : nat := unwrap_or(s.storage.ledger[sender_key], 0n);
        sender_balance := nat_or_error(sender_balance - transfer.amount, "FA2_INSUFFICIENT_BALANCE");
        s.storage.ledger[sender_key] := sender_balance;

        const dest_key = (transfer.to_, transfer.token_id);
        var dest_account : nat := unwrap_or(s.storage.ledger[dest_key], 0n);
        dest_account := dest_account + transfer.amount;
        s.storage.ledger[dest_key] := dest_account;
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
