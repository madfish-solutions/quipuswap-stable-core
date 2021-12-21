type trsfr_fa12_t       is michelson_pair(address, "from", michelson_pair(address, "to", nat, "value"), "")
type entry_fa12_t       is TransferTypeFA12 of trsfr_fa12_t
type bal_fa12_prm_t     is address * contract(nat)
type balance_fa12_t     is BalanceOfTypeFA12 of bal_fa12_prm_t
type approve_fa12_prm_t is [@layout:comb] record[
  spender : address;
  value : nat;
]
type approve_fa12_t     is ApproveFA12 of approve_fa12_prm_t
