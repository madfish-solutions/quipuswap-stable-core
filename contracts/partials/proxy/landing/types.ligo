type lending_prm_t is [@layout:comb] record [
  tokenId               : token_id_t;
  amount                : nat;
]

type lending_actions is
| Mint                  of lending_prm_t
| Redeem                of lending_prm_t
| UpdateInterest        of token_id_t

type get_price_prm_t is set(token_id_t)