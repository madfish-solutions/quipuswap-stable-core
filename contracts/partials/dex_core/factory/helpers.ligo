function get_dev_fee(
  const s               : storage_t)
                        : nat is
  unwrap((Tezos.call_view("dev_fee", Unit, s.factory_address): option(nat)), Errors.Factory.no_fee)

function get_dev_address(
  const s               : storage_t)
                        : address is
  unwrap((Tezos.call_view("dev_address", Unit, s.factory_address): option(address)), Errors.Factory.no_address)