type fact_storage_t     is [@layout:comb] record [
  dev_fee                 : nat;
  dev_address             : address;
  pools_count             : nat;
  pool_to_address         : big_map(bytes, address);
  quipu_token             : fa2_token_t;
]