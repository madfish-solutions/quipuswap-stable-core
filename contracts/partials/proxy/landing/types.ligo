type lending_prm_t is [@layout:comb] record [
  tokenId               : token_id_t;
  amount                : nat;
]

type get_price_prm_t is set(token_id_t);