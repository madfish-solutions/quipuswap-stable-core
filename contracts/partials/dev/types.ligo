type dev_action_t       is
| Set_dev_address         of address
| Set_dev_fee             of nat

type dev_storage_t      is [@layout:comb] record [
  dev_address             : address;
  dev_fee_f               : nat;
  dev_lambdas             : big_map(nat, bytes);
]

type dev_func_t         is (dev_action_t * dev_storage_t) -> dev_storage_t