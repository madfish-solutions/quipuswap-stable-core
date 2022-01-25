type pool_f_storage_t   is full_storage_t

type callback_param_t     is [@layout:comb] record [
  in_amounts              : map(nat, nat);
  pool_address            : address;
  tokens                  : tokens_map_t;
  sender                  : address;
]

type key_to_pack_t      is [@layout:comb] record [
  tokens                : tokens_map_t;
  deployer              : address;
]

type input_t_v_t        is [@layout:comb] record [
  token                   : token_t;
  value                   : nat;
]

type start_dex_param_t    is map(nat, input_t_v_t)

type token_prec_info_t is [@layout:comb] record [
  rate                    : nat;
  precision_multiplier    : nat;
]

type pool_init_param_t    is [@layout:comb] record [
  a_constant              : nat;
  input_tokens            : set(token_t);
  tokens_info             : map(token_pool_idx_t, token_prec_info_t);
  default_referral        : address;
  managers                : set(address);
  metadata                : big_map(string, bytes);
  token_metadata          : big_map(token_id_t, token_meta_info_t);
  permit_def_expiry       : nat;
]

type inner_store_t      is [@layout:comb] record[
  dev_store               : dev_storage_t;
  init_price              : nat; (* Pool creation price in QUIPU token *)
  burn_rate               : nat; (* Percent of QUIPU tokens to be burned *)
  pools_count             : nat;
  pool_to_address         : big_map(bytes, address);
  quipu_token             : fa2_token_t;
  quipu_rewards           : nat;
  whitelist               : set(address);
  // deployers               : big_map(address, address);
]

type full_storage_t     is [@layout:comb] record [
  storage                 : inner_store_t;
  admin_lambdas           : big_map(nat, bytes); (* map with admin-related functions code *)
  dex_lambdas             : big_map(nat, bytes); (* map with exchange-related functions code *)
  token_lambdas           : big_map(nat, bytes); (* map with token-related functions code *)
  permit_lambdas          : big_map(nat, bytes); (* map with permit-related functions code *)
  init_func               : option(bytes);
]

type use_factory_t      is
| Set_whitelist           of set_man_param_t
| Set_burn_rate           of nat
| Set_price               of nat
| Claim_rewards           of unit



type fact_action_t      is
| Set_init_function       of bytes
| Set_dev_function        of set_lambda_func_t
| Set_admin_function      of set_lambda_func_t
(*  sets the admin specific function, is used before the whole system is launched *)
| Set_dex_function        of set_lambda_func_t
(*  sets the dex specific function, is used before the whole system is launched *)
| Set_token_function      of set_lambda_func_t
(*  sets the FA function, is used before the whole system is launched *)
| Set_permit_function     of set_lambda_func_t
(*  sets the permit (TZIP-17) function, is used before the whole system is launched *)
| Use_dev                 of dev_action_t
| Use_factory             of use_factory_t
| Add_pool                of pool_init_param_t
| Start_dex               of start_dex_param_t
// | Init_callback           of callback_param_t


type fact_return_t      is list(operation) * full_storage_t

type init_func_t        is (pool_init_param_t * full_storage_t) -> fact_return_t