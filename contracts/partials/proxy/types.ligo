type stake_prm_t is [@layout:comb] record [
  value: nat;
]

type receiver_t is [@ layout:comb] record [
  to: address;
  value: nat;
]

type unstake_prm_t is [@layout:comb] record [
  value: nat;
  additional: optional(receiver_t);
]

type claim_prm_t is unit

type tmp_t is [@layout:comb] record [
  action_flag: nat;
  sender: address;
  extra: optional(receiver_t)
  value: optional(nat)
]

type liq_tok_info_t is [@ layout:comb]record[
  token : token_t;
  value : nat;
]

type action_t is
  Set_admin           of address
| Stake               of stake_prm_t
| Unstake             of unstake_prm_t
| Claim               of claim_prm_t
| Unwrap_FA2_balance  of unwrap_fa2_bal(params, s)
| Balance_cb          of balance_cb(params, s)
