#include "../partials/Constants.ligo"
#include "../partials/Errors.ligo"
#include "../interfaces/IDex.ligo"
#include "../partials/Utils.ligo"
#include "../helpers/FA2_helpers.ligo"
#include "../lambdas/FA2_lambdas.ligo"
#include "../helpers/Dex_helpers.ligo"
#include "../lambdas/Dex_lambdas.ligo"
#include "../partials/Dex_methods.ligo"
#include "../views/Dex_views.ligo"

(* Dex - Contract for exchanges between FA12 and FA2 tokens *)
function main(
  const p               : full_action_type;
  const s               : full_storage_type
)                       : full_return_type is
  case p of
  | Use_dex(params)           -> call_dex(params, s)
  | Use_token(params)         -> call_token(params, s)
  // | Transfer(params)          -> call_token(ITransfer(params), 0n, s)
  // | Balance_of(params)        -> call_token(IBalance_of(params), 2n, s)
  // | Update_operators(params)  -> call_token(IUpdate_operators(params), 1n, s)
  // | Get_reserves(params)      -> get_reserves(params, s)
  // | Close                     -> (no_operations, close(s))
  | SetDexFunction(params)    -> (
      no_operations,
      if params.index <= dex_func_count
        then set_dex_function(params.index, params.func, s)
      else (failwith(err_high_func_index): full_storage_type)
    )
  | SetTokenFunction(params)  -> (
      no_operations,
      if params.index <= token_func_count
        then set_token_function(params.index, params.func, s)
      else (failwith(err_high_func_index): full_storage_type)
    )
  | AddRemManagers(params)    -> add_rem_managers(params, s)
  | Set_dev_address(addr)     -> set_dev_address(addr, s)
  | Set_reward_rate(params)   -> set_reward_rate(params, s)
  | Set_admin(addr)           -> set_admin(addr, s)
  | Set_public_init           -> set_public_init(s)
  | Set_fees(params)          -> set_fees(params, s)
  | Get_fees(cb)              -> get_fees(cb, s)
  end
