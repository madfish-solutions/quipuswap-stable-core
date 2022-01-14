[@view] function dev_fee(
  var s                 : fact_storage_t)
                        : nat is
  s.dev_store.dev_fee

[@view] function dev_address(
  var s                 : fact_storage_t)
                        : address is
  s.dev_store.dev_address

[@view] function get_pool(
  const t_set           : set(token_t);
  var s                 : fact_storage_t
  const pool_map        : big_map(bytes, address))
                        : option(address) is
  block {
    const result: tmp_tkns_map_t = Set.fold(get_tokens_from_param, t_set, default_tmp_tokens);
  } with s.pool_to_address[Bytes.pack(result.tokens)]