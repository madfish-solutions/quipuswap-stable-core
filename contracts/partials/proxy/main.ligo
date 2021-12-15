(*  Proxy
 *  Contract for proxying the reserves to farms and earn additional reward
 *)
function main(
  const p               : action_t;
  const s               : storage_t
)                       : return_t is
  block{
    const return: return_t = case p of
      Set_admin(params)         -> set_admin(params, s)
    | Stake(params)             -> stake(params, s)
    | Claim(params)             -> claim(params, s)
    | Unstake(params)           -> unstake(params, s)
    | Unwrap_FA2_balance(params)-> unwrap_fa2_bal(params, s)
    | Balance_cb(params)        -> balance_cb(params, s)
    end;
  } with return;