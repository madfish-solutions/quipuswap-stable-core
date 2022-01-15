type a_r_flag_t         is Add | Remove

type func_entry_t       is FAdmin | FPermit | FDex | FToken | FDev

type stkr_info_req_t    is [@layout:comb] record [
  user                    : address;
  pool_id                 : pool_id_t;
]

type stkr_res           is [@layout:comb] record [
  balance                 : nat;
  rewards                 : map(tkn_pool_idx_t, nat);
]

type stkr_info_res_t    is [@layout:comb] record [
  request                 : stkr_info_req_t;
  info                    : stkr_res;
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

type swap_prm_t         is [@layout:comb] record [
  pool_id                 : nat; (* pool identifier *)
  idx_from                : tkn_pool_idx_t;
  idx_to                  : tkn_pool_idx_t;
  amount                  : nat;
  min_amount_out          : nat;
  time_expiration         : timestamp;
  receiver                : option(address);
  referral                : option(address);
]

type tmp_get_d_t        is [@layout:comb] record [
  d                       : nat;
  prev_d                  : nat;
]

type info_ops_acc_t     is record [
  tokens_info             : map(tkn_pool_idx_t, tkn_inf_t);
  operations              : list(operation);
]

type init_prm_t         is [@layout:comb] record [
  a_constant              : nat;
  input_tokens            : set(token_t);
  tokens_info             : map(tkn_pool_idx_t, tkn_inf_t);
]

type invest_prm_t       is [@layout:comb] record [
  pool_id                 : nat; (* pool identifier *)
  shares                  : nat; (* the amount of shares to receive *)
  in_amounts              : map(nat, nat); (* amount of tokens, where `index of value` == `index of token` to be invested *)
  time_expiration         : timestamp;
  receiver                : option(address);
  referral                : option(address);
]

type divest_prm_t       is [@layout:comb] record [
  pool_id                 : nat; (* pool identifier *)
  min_amounts_out         : map(tkn_pool_idx_t, nat); (* min amount of tokens, where `index of value` == `index of token` to be received to accept the divestment *)
  shares                  : nat; (* amount of shares to be burnt *)
  time_expiration         : timestamp;
  receiver                : option(address);
]

type divest_imb_prm_t   is [@layout:comb] record [
  pool_id                 : nat; (* pool identifier *)
  amounts_out             : map(tkn_pool_idx_t, nat); (* amounts of tokens, where `index of value` == `index of token` to be received to accept the divestment *)
  max_shares              : nat; (* amount of shares to be burnt *)
  time_expiration         : timestamp;
  receiver                : option(address);
  referral                : option(address);
]

type divest_one_c_prm_t is [@layout:comb] record [
  pool_id                 : nat; (* pool identifier *)
  shares                  : nat; (* amount of shares to be burnt *)
  token_index             : tkn_pool_idx_t;
  min_amount_out          : nat;
  time_expiration         : timestamp;
  receiver                : option(address);
  referral                : option(address);
]

type clc_w_one_v_prm_t  is [@layout:comb] record [
  pool_id                 : nat; (* pool identifier *)
  token_amount            : nat; (* LP to burn *)
  i                       : nat; (* token index in pool *)
]

type get_dy_v_prm_t     is [@layout:comb] record [
  pool_id                 : nat; (* pool identifier *)
  i                       : nat; (* token index *)
  j                       : nat;
  dx                      : nat;
]

type ramp_a_prm_t       is [@layout:comb] record [
  pool_id                 : nat; (* pool identifier *)
  future_A                : nat;
  future_time             : timestamp; (* response receiver *)
]

type get_a_v_prm_t      is [@layout:comb] record [
  pool_id                 : nat; (* pool identifier *)
  receiver                : contract(nat);
]

type set_fee_prm_t      is [@layout:comb] record [
  pool_id                 : pool_id_t;
  fee                     : fees_storage_t;
]

type get_fee_v_prm_t    is [@layout:comb] record [
  pool_id                 : pool_id_t;
  receiver                : contract(fees_storage_t);
]

type claim_by_tkn_prm_t is [@layout:comb] record [
  token                   : token_t;
  amount                  : nat;
]

type un_stake_prm_t     is [@layout:comb] record [
  pool_id                 : pool_id_t;
  amount                  : nat;
]

type action_t           is
(* Base actions *)
| Add_pool                of init_prm_t          (* sets initial liquidity *)
| Swap                    of swap_prm_t          (* exchanges token to another token and sends them to receiver *)
| Invest                  of invest_prm_t        (* mints min shares after investing tokens *)
| Divest                  of divest_prm_t        (* burns shares and sends tokens to the owner *)
(* Custom actions *)
| Divest_imbalanced       of divest_imb_prm_t
| Divest_one_coin         of divest_one_c_prm_t
| Claim_developer         of claim_by_tkn_prm_t
| Claim_referral          of claim_by_tkn_prm_t
| Ramp_A                  of ramp_a_prm_t
| Stop_ramp_A             of nat
| Set_fees                of set_fee_prm_t
| Set_default_referral    of address
| Stake                   of un_stake_prm_t
| Unstake                 of un_stake_prm_t

type full_action_t      is
| Use_admin               of admin_action_t
| Use_dex                 of action_t
| Use_permit              of permit_action_t
| Use_token               of token_action_t
#if !FACTORY
| Use_dev                 of dev_action_t
| Set_admin_function      of set_lambda_func_t
(*  sets the admin specific function, is used before the whole system is launched *)
| Set_dex_function          of set_lambda_func_t
(*  sets the dex specific function, is used before the whole system is launched *)
| Set_token_function        of set_lambda_func_t
(*  sets the FA function, is used before the whole system is launched *)
| Set_permit_function       of set_lambda_func_t
(*  sets the permit (TZIP-17) function, is used before the whole system is launched *)
| Set_dev_function        of set_lambda_func_t
#else
#endif

type admin_func_t       is (admin_action_t * storage_t) -> storage_t

type dex_func_t         is (action_t * storage_t) -> return_t

type permit_func_t      is (permit_action_t * full_storage_t * full_action_t) -> full_storage_t

type tkn_func_t         is (token_action_t * full_storage_t * full_action_t) -> full_return_t

type add_liq_prm_t      is record [
  referral                : option(address);
  pool_id                 : nat;
  pool                    : pool_t;
  inputs                  : map(tkn_pool_idx_t, nat);
  min_mint_amount         : nat;
  receiver                : option(address);
]

type balancing_acc_t    is record [
  dev_rewards             : big_map(token_t, nat);
  referral_rewards        : big_map((address * token_t), nat);
  staker_accumulator      : stkr_acc_t;
  tokens_info             : map(tkn_pool_idx_t, tkn_inf_t);
  tokens_info_without_lp  : map(tkn_pool_idx_t, tkn_inf_t);
]
