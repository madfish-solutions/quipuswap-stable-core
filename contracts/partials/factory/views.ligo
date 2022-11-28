[@view] function dev_fee(
  const _               : unit;
  const s               : full_storage_t)
                        : nat is
  s.storage.dev_store.dev_fee_f

[@view] function dev_address(
  const _               : unit;
  const s               : full_storage_t)
                        : address is
  s.storage.dev_store.dev_address

[@view] function is_registered_strategy(
  const strategy        : address;
  const s               : storage_t)
                        : bool is
  Set.fold(check_strategy_factory, s.storage.strategy_factory, False)



[@view] function get_pool(
  const params          : record [ tokens:set(token_t); deployer:address ];
  const s               : full_storage_t)
                        : option(address) is
  block {
    const result: tmp_tokens_map_t = Set.fold(get_tokens_from_param, params.tokens, default_tmp_tokens);
  } with s.storage.pool_to_address[pack_pool_key(params.deployer, result.tokens)]