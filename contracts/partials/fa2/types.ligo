type trsfr_fa2_dst_t    is [@layout:comb] record [
  to_                     : address;
  token_id                : token_id_t;
  amount                  : nat;
]

type trsfr_fa2_prm_t    is [@layout:comb] record [
  from_                   : address;
  txs                     : list(trsfr_fa2_dst_t);
]

type transfer_prm_t     is list(trsfr_fa2_prm_t)

type operator_fa2_prm_t is [@layout:comb] record [
  owner                   : address;
  operator                : address;
  token_id                : token_id_t;
]

type upd_operator_prm_t is
| Add_operator            of operator_fa2_prm_t
| Remove_operator         of operator_fa2_prm_t

type operator_prm_t     is list(upd_operator_prm_t)

type tkn_meta_info_t    is [@layout:comb] record [
  token_id                : nat;
  token_info              : map(string, bytes);
]

type upd_meta_prm_t     is tkn_meta_info_t

type ts_v_prm_t         is [@layout:comb] record [
  token_id                : token_id_t; (* pool identifier *)
  receiver                : contract(nat); (* response receiver *)
]

type balc_of_fa2_req_t  is [@layout:comb] record [
  owner                   : address;
  token_id                : token_id_t;
]

type balc_of_fa2_res_t  is [@layout:comb] record [
  request                 : balc_of_fa2_req_t;
  balance                 : nat;
]

type bal_fa2_prm_t      is [@layout:comb] record [
  requests                : list(balc_of_fa2_req_t);
  callback                : contract(list(balc_of_fa2_res_t));
]

type trsfr_fa2_t        is list(trsfr_fa2_prm_t)

type entry_fa2_t        is TransferTypeFA2 of trsfr_fa2_t

type balance_fa2_t      is BalanceOfTypeFA2 of bal_fa2_prm_t

type approve_fa2_t      is ApproveFA2 of operator_prm_t

type token_action_t     is
| Transfer                of transfer_prm_t (* transfer asset from one account to another *)
| Balance_of              of bal_fa2_prm_t (* returns the balance of the account *)
| Update_operators        of operator_prm_t (* updates the token operators *)
| Update_metadata         of upd_meta_prm_t
| Total_supply            of ts_v_prm_t
