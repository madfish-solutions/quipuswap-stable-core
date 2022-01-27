function get_dev_fee(
  const s               : storage_t)
                        : nat is
  s.dev_store.dev_fee

function get_dev_address(
  const s               : storage_t)
                        : address is
  s.dev_store.dev_address
