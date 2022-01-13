(* Check permissions *)
[@inline] function check_permissions(
  const from_account    : address;
  const allowances      : set(address))
                        : unit is
  assert_with_error(from_account = Tezos.sender or (allowances contains Tezos.sender), Errors.FA2.not_operator);

(* Balance check *)
[@inline] function check_balance(
  const account_bal     : nat;
  const to_spend        : nat)
                        : unit is
  if account_bal < to_spend
    then failwith(Errors.FA2.insufficient_balance)
  else Unit;

(* Owner check *)
[@inline] function validate_owner(
  const owner           : address)
                        : unit is
  assert_with_error(owner = Tezos.sender, Errors.FA2.not_owner);

[@inline] function get_account_data(
  const key             : address * pool_id_t;
  const acc_bm          : big_map((address * pool_id_t), account_data_t))
                        : account_data_t is
  unwrap_or(acc_bm[key], record [ allowances = (set[]: set(address)); ]);

(* Perform transfers from one owner *)
[@inline] function iterate_transfer(
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
        var sender_balance := unwrap_or(s.storage.ledger[sender_key], 0n);
        sender_balance := nat_or_error(sender_balance - transfer.amount, Errors.FA2.insufficient_balance);
        s.storage.ledger[sender_key] := sender_balance;

        const dest_key = (transfer.to_, transfer.token_id);
        var dest_account := unwrap_or(s.storage.ledger[dest_key], 0n);
        dest_account := dest_account + transfer.amount;
        s.storage.ledger[dest_key] := dest_account;
    } with s;
} with List.fold(make_transfer, user_trx_params.txs, s)

(* Perform single operator update *)
[@inline] function iterate_update_operator(
  var s                 : full_storage_t;
  const params          : upd_operator_prm_t
)                       : full_storage_t is
  block {
    [@inline] function upd_operator(
      const param       : operator_fa2_prm_t;
      const add         : bool;
      var account_s     : big_map((address * pool_id_t), account_data_t))
                        : big_map((address * pool_id_t), account_data_t) is block {
        validate_owner(param.owner);
        const owner_key = (param.owner, param.token_id);
        var account := get_account_data(owner_key, account_s);
        account.allowances := Set.update(param.operator, add, account.allowances);
        account_s[owner_key] := account;
    } with account_s;

    s.storage.account_data := case params of
    | Add_operator(param) -> upd_operator(param, True, s.storage.account_data)
    | Remove_operator(param) -> upd_operator(param, False, s.storage.account_data)
    end
  } with s
