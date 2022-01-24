[@view] function dev_fee(
  const _               : unit;
  const s               : full_storage_t)
                        : nat is
  s.storage.dev_store.dev_fee

[@view] function dev_address(
  const _               : unit;
  const s               : full_storage_t)
                        : address is
  s.storage.dev_store.dev_address

[@view] function get_pool(
  const t_set           : set(token_t);
  const s               : full_storage_t)
                        : option(address) is
  block {
    const result: tmp_tokens_map_t = Set.fold(get_tokens_from_param, t_set, default_tmp_tokens);
  } with s.storage.pool_to_address[Bytes.pack(result.tokens)]