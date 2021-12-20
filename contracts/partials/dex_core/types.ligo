type a_r_flag_t      is Add | Remove
type func_entry_t    is FAdmin | FPermit | FDex | FToken

// type token_pool_data    is [@layout:comb] record [
//   token_id      : nat;
//   token_info    : token_t;
// ]
type diff_t is
  Plus  of nat
| Minus of nat

type extra_receiver_t is [@layout:comb]record[
  receiver: address;
  value   : nat;
]

type prx_stake_prm_t is [@layout:comb]record[
  token: token_t;
  value: nat;
]
type prx_unstake_prm_t is [@layout:comb]record[
  token: token_t;
  value: nat;
  additional: option(extra_receiver_t);
]

type prx_claim_prm_t is record[
  token: token_t;
  sender: address;
];

type withdraw_one_return is [@layout:comb] record [
  dy                      : nat;
  dy_fee                  : nat;
  ts                      : nat;
]

type swap_prm_t          is [@layout:comb] record [
  pair_id                 : nat; (* pair identifier *)
  idx_from                : tkn_pool_idx_t;
  idx_to                  : tkn_pool_idx_t;
  amount                  : nat;
  min_amount_out          : nat;
  time_expiration         : timestamp;
  receiver                : option(address);
  referral                : option(address);
]

type tmp_get_d_t     is [@layout:comb] record [
  d                       : nat;
  prev_d                  : nat;
]

type info_ops_acc_t     is map(tkn_pool_idx_t, tkn_inf_t);

type init_prm_t  is [@layout:comb] record [
  a_constant              : nat;
  input_tokens            : set(token_t);
  tokens_info             : map(tkn_pool_idx_t, tkn_inf_t);
]

type invest_prm_t        is [@layout:comb] record [
  pair_id                 : nat; (* pair identifier *)
  shares                  : nat; (* the amount of shares to receive *)
  in_amounts              : map(nat, nat); (* amount of tokens, where `index of value` == `index of token` to be invested *)
  referral                : option(address);
]

type divest_prm_t        is [@layout:comb] record [
  pair_id                 : nat; (* pair identifier *)
  min_amounts_out         : map(tkn_pool_idx_t, nat); (* min amount of tokens, where `index of value` == `index of token` to be received to accept the divestment *)
  shares                  : nat; (* amount of shares to be burnt *)
]

type divest_imb_prm_t is [@layout:comb] record [
  pair_id                 : nat; (* pair identifier *)
  amounts_out             : map(tkn_pool_idx_t, nat); (* amounts of tokens, where `index of value` == `index of token` to be received to accept the divestment *)
  max_shares              : nat; (* amount of shares to be burnt *)
  referral                : option(address);
]

type divest_one_c_prm_t is [@layout:comb] record [
  pair_id                 : nat; (* pair identifier *)
  shares                  : nat; (* amount of shares to be burnt *)
  token_index             : tkn_pool_idx_t;
  min_amount_out          : nat;
  referral                : option(address);
]

type reserves_v_prm_t      is [@layout:comb] record [
  pair_id                 : nat; (* pair identifier *)
  receiver                : contract(map(nat, tkn_inf_t)); (* response receiver *)
]

type min_received_v_prm_t  is [@layout:comb] record [
  pair_id                 : nat; (* pair identifier *)
  i                       : nat;
  j                       : nat;
  x                       : nat;
  receiver                : contract(nat); (* response receiver *)
]

type max_rate_v_prm_t    is [@layout:comb] record [
  pair_id                 : nat; (* pair identifier *)
  receiver                : contract(map(nat, nat)); (* response receiver *)
]

type calc_w_one_c_v_prm_t is [@layout:comb] record [
  pair_id                 : nat; (* pair identifier *)
  token_amount            : nat; (* LP to burn *)
  i                       : nat; (* token index in pair *)
  receiver                : contract(nat); (* response receiver *)
]

type get_dy_v_prm_t      is [@layout:comb] record [
  pair_id                 : nat; (* pair identifier *)
  i                       : nat; (* token index *)
  j                       : nat;
  dx                      : nat;
  receiver                : contract(nat); (* response receiver *)
]

type ramp_a_prm_t      is [@layout:comb] record [
  pair_id                 : nat; (* pair identifier *)
  future_A                : nat;
  future_time             : timestamp; (* response receiver *)
]

type set_proxy_prm_t   is [@layout:comb] record [
  pair_id                 : nat; (* pair identifier *)
  proxy                   : option(address);
]

type get_a_v_prm_t         is [@layout:comb] record [
  pair_id                 : nat; (* pair identifier *)
  receiver                : contract(nat);
]

type upd_proxy_lim_prm_t is [@layout:comb] record [
  pair_id                 : nat; (* pair identifier *)
  token_index             : nat; (* pair identifier *)
  limit                   : nat;
  soft                    : nat; (* soft limit +- % *)
]

type set_fee_prm_t       is [@layout:comb] record [
  pool_id                 : pool_id_t;
  fee                     : fees_storage_t;
]

type get_fee_v_prm_t       is [@layout:comb] record [
  pool_id                 : pool_id_t;
  receiver                : contract(fees_storage_t);
]

type claim_by_tkn_prm_t is [@layout:comb] record [
  token: token_t;
  amount: nat;
]

type un_stake_prm_t is [@layout:comb] record [
  pool_id: pool_id_t;
  amount: nat;
]

type claim_by_pool_tkn_prm_t is [@layout:comb] record [
  pool_id: pool_id_t;
  token: token_t;
  amount: nat;
]
type claim_prx_t is [@layout:comb] record [
  pool_id: pool_id_t;
  token: token_t;
]

type action_t        is
(* Base actions *)
| Add_pair                 of init_prm_t  (* sets initial liquidity *)
| Swap                    of swap_prm_t          (* exchanges token to another token and sends them to receiver *)
| Invest                  of invest_prm_t        (* mints min shares after investing tokens *)
| Divest                  of divest_prm_t        (* burns shares and sends tokens to the owner *)
(* Custom actions *)
| Divest_imbalanced        of divest_imb_prm_t
| Divest_one_coin          of divest_one_c_prm_t
| Claim_developer          of claim_by_tkn_prm_t
| Claim_referral           of claim_by_tkn_prm_t
| Claim_liq_provider       of claim_by_pool_tkn_prm_t
| Ramp_A                   of ramp_a_prm_t
| Stop_ramp_A              of nat
| Set_proxy                of set_proxy_prm_t
| Update_proxy_limits      of upd_proxy_lim_prm_t
| Set_fees                 of set_fee_prm_t
| Set_default_referral     of address
| Stake                    of un_stake_prm_t
| Unstake                  of un_stake_prm_t
| Claim_proxy_rewards      of claim_prx_t
| Update_proxy_rewards     of upd_prx_rew_t
| Update_proxy_reserves    of upd_res_t
(* VIEWS *)
| Get_tokens_info           of reserves_v_prm_t      (* returns the token info *)
| Get_fees                 of get_fee_v_prm_t
// | Min_received            of min_received_v_prm_t  (* returns minReceived tokens after swapping *)
// | Tokens_per_shares       of tps_type           (* returns map of tokens amounts to recieve 1 LP *)
// | Price_cummulative       of price_cumm_type    (* returns price cumulative and timestamp per block *)
// | Calc_divest_one_coin    of calc_divest_one_coin
| Get_dy                  of get_dy_v_prm_t        (* returns the current output dy given input dx *)
| Get_A                   of get_a_v_prm_t

type full_action_t   is
| Use_admin               of admin_action_t
| Use_dex                 of action_t
| Use_permit              of permit_action_t
| Use_token               of token_action_t
| Set_admin_function        of set_lambda_func_t
(*  sets the admin specific function,
    is used before the whole system is launched
 *)
| Set_dex_function          of set_lambda_func_t
(*  sets the dex specific function,
    is used before the whole system is launched
 *)
| Set_token_function        of set_lambda_func_t
(*  sets the FA function, 
    is used before the whole system is launched
 *)
| Set_permit_function       of set_lambda_func_t
(*  sets the permit (TZIP-17) function,
    is used before the whole system is launched
 *)

type admin_func_t       is (admin_action_t * storage_t) -> storage_t
type dex_func_t         is (action_t * storage_t) -> return_t
type permit_func_t      is (permit_action_t * full_storage_t * full_action_t) -> full_storage_t
type tkn_func_t         is (token_action_t * full_storage_t * full_action_t) -> full_return_t

type add_liq_prm_t is record [
    referral: option(address);
    pair_id :nat;
    pair    : pair_t;
    inputs  : map(tkn_pool_idx_t, nat);
    min_mint_amount: nat;
  ]
// const fee_rate            : nat = 333n;
// const fee_denom           : nat = 1000n;
// const fee_num             : nat = 997n;
type balancing_acc_t   is record [
  dev_rewards             : big_map(token_t, nat);
  referral_rewards        : big_map((address * token_t), nat);
  staker_accumulator      : stkr_acc_t;
  tokens_info             : map(tkn_pool_idx_t, tkn_inf_t);
  tokens_info_without_lp  : map(tkn_pool_idx_t, tkn_inf_t);
  operations              : list(operation);
]
