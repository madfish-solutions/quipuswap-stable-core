function get_dev_fee(
  const s               : storage_t)
                        : nat is
  s.dev_store.dev_fee_f

function get_dev_address(
  const s               : storage_t)
                        : address is
  s.dev_store.dev_address

function check_is_registered_strategy(
  const strategy        : address;
  const s               : storage_t)
                        : bool is
  check_strategy_factory(strategy, s.strategy_factory)

