type token_id_t      is nat
type pool_id_t       is nat
type tkn_pool_idx_t  is nat

type fa12_token_t  is address

type fa2_token_t     is [@layout:comb] record [
  token_address           : address; (* token A address *)
  token_id                : token_id_t; (* token A identifier *)
]

type token_t         is
| Fa12                    of fa12_token_t
| Fa2                     of fa2_token_t

type set_lambda_func_t  is [@layout:comb] record [
  func                    : bytes; (* code of the function *)
  index                   : nat; (* the key in functions map *)
]