type stake_prm_t is [@layout:comb]record[
  value: nat;
]

type claim_prm_t is unit;

type receiver_t is [@layout:comb]record[
  receiver: address;
  value   : nat;
]

type unstake_prm_t is [@layout:comb]record[
  value: nat;
  additional: option(receiver_t);
]

type tmp_t is [@layout:comb] record [
  action_flag: nat;
  sender: token_t;
  extra: option(receiver_t);
  value: option(nat);
]

type liq_tok_info_t is [@layout:comb]record[
  token : token_t;
  value : nat;
]

type dex_info_t is [@layout:comb] record [
  location    : address;
  pool_id     : pool_id_t;
  pooled_index: tkn_pool_idx_t;
]


type action_t is
  Set_admin           of address
| Stake               of stake_prm_t
| Unstake             of unstake_prm_t
| Claim               of claim_prm_t
| Unwrap_FA2_balance  of list(balance_of_fa2_res_t)
| Balance_cb          of nat
