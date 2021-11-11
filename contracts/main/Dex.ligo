#import "../partials/Constants.ligo" "CONSTANTS"
#import "../partials/Errors.ligo" "ERRORS"
#include "../interfaces/IDex.ligo"
#include "../partials/Utils.ligo"
#include "../helpers/FA2_helpers.ligo"
#include "../lambdas/FA2_lambdas.ligo"
#include "../views/FA2_views.ligo"
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
  // | Use_token(params)         -> call_token(params, s)
  | Transfer(params)          -> call_token(ITransfer(params), s)
  | Balance_of(params)        -> call_token(IBalanceOf(params), s)
  | Update_operators(params)  -> call_token(IUpdateOperators(params), s)
  | Update_metadata(params)   -> call_token(IUpdateMetadata(params), s)
  | Total_supply(params)      -> call_token(ITotalSupply(params), s)
  // | Get_reserves(params)      -> get_reserves(params, s)
  // | Close                     -> (CONSTANTS.no_operations, close(s))
  | SetDexFunction(params)    -> (
      CONSTANTS.no_operations,
      if params.index <= CONSTANTS.dex_func_count
        then set_dex_function(params.index, params.func, s)
      else (failwith(ERRORS.high_func_index): full_storage_type)
    )
  | SetTokenFunction(params)  -> (
      CONSTANTS.no_operations,
      if params.index <= CONSTANTS.token_func_count
        then set_token_function(params.index, params.func, s)
      else (failwith(ERRORS.high_func_index): full_storage_type)
    )
  | AddRemManagers(params)    -> add_rem_managers(params, s)
  | SetDevAddress(addr)       -> set_dev_address(addr, s)
  | SetRewardRate(params)     -> set_reward_rate(params, s)
  | SetAdmin(addr)            -> set_admin(addr, s)
  end
