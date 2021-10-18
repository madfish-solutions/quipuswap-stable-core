(* Check permissions *)
[@inline]
function check_permissions(const from_account: address; const allowances: set(address)): unit is
  if from_account =/= Tezos.sender and not (allowances contains Tezos.sender)
    then failwith("FA2_NOT_OPERATOR");
  else Unit;

(* Balance check *)
[@inline]
function check_balance(const account_bal: nat; const to_spend: nat): unit is
  if account_bal < to_spend
    then failwith("FA2_INSUFFICIENT_BALANCE")
  else Unit;

(* Owner check *)
[@inline]
function is_owner(const owner: address): unit is
  if Tezos.sender =/= owner
    then failwith("FA2_NOT_OWNER")
  else Unit;