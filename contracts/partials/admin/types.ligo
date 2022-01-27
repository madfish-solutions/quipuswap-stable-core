type set_man_param_t    is [@layout:comb] record [
  add                     : bool;
  candidate               : address;
]

type ramp_a_param_t     is [@layout:comb] record [
  pool_id                 : nat; (* pool identifier *)
  future_A                : nat;
  future_time             : timestamp; (* response receiver *)
]

type set_fee_param_t    is [@layout:comb] record [
  pool_id                 : pool_id_t;
  fee                     : fees_storage_t;
]

#if !FACTORY
type init_param_t       is [@layout:comb] record [
  a_constant              : nat;
  input_tokens            : set(token_t);
  tokens_info             : map(token_pool_idx_t, token_info_t);
]
#endif

type admin_action_t     is
| Add_rem_managers        of set_man_param_t
| Set_admin               of address
| Claim_developer         of claim_by_token_param_t
| Ramp_A                  of ramp_a_param_t
| Stop_ramp_A             of nat
| Set_fees                of set_fee_param_t
| Set_default_referral    of address
#if !FACTORY
| Add_pool                of init_param_t          (* sets initial liquidity *)
#endif
