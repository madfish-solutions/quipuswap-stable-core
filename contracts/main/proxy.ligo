(* Modules *)
#import "../partials/errors.ligo" "Errors"
#import "../partials/constants.ligo" "Constants"
(* Types *)
#include "../partials/common_types.ligo"
#include "../partials/proxy/types.ligo"
//#include "../partials/proxy/farm/storage.ligo"
#include "../partials/proxy/landing/storage.ligo"
(* Helpers and functions *)
#include "../partials/utils.ligo"
#include "../partials/proxy/helpers.ligo"
(* Methods *)
//#include "../partials/proxy/farm/methods.ligo"
#include "../partials/proxy/landing/methods.ligo"
#include "../partials/proxy/methods.ligo"
(* View methods *)
// #include "../partials/proxy/views.ligo"

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
