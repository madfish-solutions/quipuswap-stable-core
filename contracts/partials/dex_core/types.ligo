type func_entry_t       is FAdmin | FDex | FToken | FDev

type staker_info_req_t  is [@layout:comb] record [
  user                    : address;
  pool_id                 : pool_id_t;
]

type staker_res         is [@layout:comb] record [
  balance                 : nat;
  rewards                 : map(token_pool_idx_t, nat);
]

type staker_info_res_t  is [@layout:comb] record [
  request                 : staker_info_req_t;
  info                    : staker_res;
]

type ref_rew_req_t      is [@layout:comb] record [
  user                    : address;
  token                   : token_t;
]

type ref_rew_res_t      is [@layout:comb] record [
  request                 : ref_rew_req_t;
  reward                  : nat
]

type withdraw_one_rtrn  is [@layout:comb] record [
  dy                      : nat;
  dy_fee                  : nat;
  ts                      : nat;
]

type swap_param_t       is [@layout:comb] record [
  pool_id                 : nat; (* pool identifier *)
  idx_from                : token_pool_idx_t;
  idx_to                  : token_pool_idx_t;
  amount                  : nat;
  min_amount_out          : nat;
  deadline                : timestamp;
  receiver                : option(address);
  referral                : option(address);
]

type tmp_get_d_t        is [@layout:comb] record [
  d                       : nat;
  prev_d                  : nat;
]

type info_ops_accum_t   is record [
  tokens_info             : map(token_pool_idx_t, token_info_t);
  operations              : list(operation);
]

type invest_param_t     is [@layout:comb] record [
  pool_id                 : nat; (* pool identifier *)
  shares                  : nat; (* the amount of shares to receive *)
  in_amounts              : map(token_pool_idx_t, nat); (* amount of tokens, where `index of value` == `index of token` to be invested *)
  deadline                : timestamp;
  receiver                : option(address);
  referral                : option(address);
]

type divest_param_t     is [@layout:comb] record [
  pool_id                 : nat; (* pool identifier *)
  min_amounts_out         : map(token_pool_idx_t, nat); (* min amount of tokens, where `index of value` == `index of token` to be received to accept the divestment *)
  shares                  : nat; (* amount of shares to be burnt *)
  deadline                : timestamp;
  receiver                : option(address);
]

type divest_imb_param_t is [@layout:comb] record [
  pool_id                 : nat; (* pool identifier *)
  amounts_out             : map(token_pool_idx_t, nat); (* amounts of tokens, where `index of value` == `index of token` to be received to accept the divestment *)
  max_shares              : nat; (* amount of shares to be burnt *)
  deadline                : timestamp;
  receiver                : option(address);
  referral                : option(address);
]

type divest_one_c_param_t is [@layout:comb] record [
  pool_id                 : nat; (* pool identifier *)
  shares                  : nat; (* amount of shares to be burnt *)
  token_index             : token_pool_idx_t;
  min_amount_out          : nat;
  deadline                : timestamp;
  receiver                : option(address);
  referral                : option(address);
]

type calc_withdraw_one_param_t is [@layout:comb] record [
  pool_id                 : nat; (* pool identifier *)
  token_amount            : nat; (* LP to burn *)
  i                       : nat; (* token index in pool *)
]

type get_dy_v_param_t   is [@layout:comb] record [
  pool_id                 : nat; (* pool identifier *)
  i                       : nat; (* token index *)
  j                       : nat;
  dx                      : nat;
]

type get_a_v_param_t    is [@layout:comb] record [
  pool_id                 : nat; (* pool identifier *)
  receiver                : contract(nat);
]

type get_fee_v_param_t  is [@layout:comb] record [
  pool_id                 : pool_id_t;
  receiver                : contract(fees_storage_t);
]

type token_amt_v_param_t is [@layout:comb] record [
  pool_id               : pool_id_t;
  amounts               : map(token_pool_idx_t, nat);
  is_deposit            : bool;
]

type stake_param_t      is [@layout:comb] record [
  pool_id                 : pool_id_t;
  amount                  : nat;
]

type stake_action_t     is
| Add of stake_param_t
| Remove of stake_param_t

type dex_action_t       is
(* Base actions *)
| Swap                    of swap_param_t          (* exchanges token to another token and sends them to receiver *)
| Invest                  of invest_param_t        (* mints min shares after investing tokens *)
| Divest                  of divest_param_t        (* burns shares and sends tokens to the owner *)
(* Custom actions *)
| Divest_imbalanced       of divest_imb_param_t
| Divest_one_coin         of divest_one_c_param_t
| Claim_referral          of claim_by_token_param_t
| Stake                   of stake_action_t

type user_action_t      is
| Use_dex                 of dex_action_t
| Use_token               of token_action_t

#if FACTORY
type factory_action_t   is
| Copy_dex_function       of big_map(nat, bytes)
| Freeze                  of unit
#endif

type full_action_t      is
| Use_admin               of admin_action_t
| User_action             of user_action_t
#if !FACTORY
| Use_dev                 of dev_action_t
| Set_admin_function      of set_lambda_func_t
(*  sets the admin specific function, is used before the whole system is launched *)
| Set_dex_function        of set_lambda_func_t
(*  sets the dex specific function, is used before the whole system is launched *)
| Set_token_function      of set_lambda_func_t
(*  sets the FA function, is used before the whole system is launched *)
| Set_dev_function        of set_lambda_func_t
#else
| Factory_action          of factory_action_t
#endif

type admin_func_t       is (admin_action_t * storage_t) -> return_t

type dex_func_t         is (dex_action_t * storage_t) -> return_t

type token_func_t       is (token_action_t * full_storage_t) -> full_return_t

type add_liq_param_t    is record [
  referral                : option(address);
  pool_id                 : nat;
  pool                    : pool_t;
  inputs                  : map(token_pool_idx_t, nat);
  min_mint_amount         : nat;
  receiver                : option(address);
]

type balancing_accum_t  is record [
  dev_rewards             : big_map(token_t, nat);
  referral_rewards        : big_map((address * token_t), nat);
  staker_accumulator      : staker_accum_t;
  tokens_info             : map(token_pool_idx_t, token_info_t);
  tokens_info_without_lp  : map(token_pool_idx_t, token_info_t);
]
