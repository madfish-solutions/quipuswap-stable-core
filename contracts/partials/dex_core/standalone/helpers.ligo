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
  block {
    function check_strategy_factory(const accumulator: bool; const entry: address): bool is 
      accumulator or unwrap(
        (Tezos.call_view("is_registered", strategy, entry): option(bool)),
        Errors.Factory.no_strategy_factory
      )
  } with Set.fold(check_strategy_factory, s.strategy_factory, False)

