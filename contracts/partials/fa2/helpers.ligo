(* Check permissions *)
[@inline] function check_permissions(
  const from_account    : address;
  const allowances      : set(address))
                        : unit is
  require(from_account = Tezos.get_sender() or (allowances contains Tezos.get_sender()), Errors.FA2.not_operator);

[@inline] function get_allowances(
  const key             : address * pool_id_t;
  const acc_bm          : big_map((address * pool_id_t), allowances_data_t))
                        : allowances_data_t is
  unwrap_or(acc_bm[key], (set[]: set(address)));

(* Perform transfers from one owner *)
[@inline] function iterate_transfer(
  var accum             : list(operation) * full_storage_t;
  const user_trx_params : transfer_fa2_param_t)
                        : list(operation) * full_storage_t is
  block {
    function make_transfer(
      var acc           : list(txs_event_t) * full_storage_t;
      const transfer    : transfer_fa2_dst_t)
                        : list(txs_event_t) * full_storage_t is
      block {
        require(transfer.token_id < acc.1.storage.pools_count, Errors.FA2.undefined);
        const sender_key =  (user_trx_params.from_, transfer.token_id);
        var sender_balance := unwrap_or(acc.1.storage.ledger[sender_key], 0n);
        var sender_allowance := get_allowances(sender_key, acc.1.storage.allowances);
        check_permissions(user_trx_params.from_, sender_allowance);
        sender_balance := nat_or_error(sender_balance - transfer.amount, Errors.FA2.insufficient_balance);
        acc.1.storage.ledger[sender_key] := sender_balance;

        const dest_key = (transfer.to_, transfer.token_id);
        var dest_account := unwrap_or(acc.1.storage.ledger[dest_key], 0n);
        dest_account := dest_account + transfer.amount;
        acc.1.storage.ledger[dest_key] := dest_account;
        acc.0 := (record[
          token_id = transfer.token_id;
          amount = transfer.amount;
          receiver = transfer.to_;
        ]: txs_event_t) # acc.0;
    } with acc;
  const result = List.fold(make_transfer, user_trx_params.txs, ((list[]:list(txs_event_t)), accum.1));
  accum.1 := result.1;
  accum.0 := emit_event(TransferEvent(record[
    owner = user_trx_params.from_;
    caller = Tezos.get_sender();
    txs = result.0;
  ])) # accum.0;
} with accum

(* Perform single operator update *)
[@inline] function iterate_update_operator(
  var s                 : full_storage_t;
  const params          : upd_operator_param_t)
                        : full_storage_t is
  block {
    const (param, should_add) = case params of [
    | Add_operator(param)    -> (param, True)
    | Remove_operator(param) -> (param, False)
    ];
    require(param.operator =/= param.owner, Errors.FA2.owner_as_operator);
    require(Tezos.get_sender() = param.owner, Errors.FA2.not_owner);
    require(param.token_id < s.storage.pools_count, Errors.Dex.pool_not_listed);

    const owner_key = (param.owner, param.token_id);
    const allowances = get_allowances(owner_key, s.storage.allowances);
    s.storage.allowances[owner_key] := Set.update(param.operator, should_add, allowances);
  } with s