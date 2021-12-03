#import "../partials/Errors.ligo" "ERRORS"
#import "../partials/Constants.ligo" "CONSTANTS"
#include "../interfaces/IPermit.ligo"
#include "../interfaces/IDex.ligo"
#include "../partials/Getters.ligo"
#include "../partials/Utils.ligo"
#include "../helpers/FA2_helpers.ligo"
#include "../helpers/Permit_helpers.ligo"
#include "../helpers/Dex_helpers.ligo"
#include "../lambdas/Admin_lambdas.ligo"
#include "../lambdas/Permit_lambdas.ligo"
#include "../lambdas/FA2_lambdas.ligo"
#include "../lambdas/Dex_lambdas.ligo"
#include "../partials/Dex_methods.ligo"
#include "../views/FA2_views.ligo"
#include "../views/Dex_views.ligo"


(* Dex - Contract for exchanges between FA12 and FA2 tokens *)
function main(
  const p               : full_action_t;
  const s               : full_storage_t
)                       : full_return_t is
  case p of
  | SetAdminFunction(params)  -> set_function(FAdmin, params, s)
  | Use_admin(params)         -> call_admin(params, s)
  | SetDexFunction(params)    -> set_function(FDex, params, s)
  | Use_dex(params)           -> call_dex(params, s)
  | SetTokenFunction(params)  -> set_function(FToken, params, s)
  | Use_token(params)         -> call_token(params, s, p)
  | SetPermitFunction(params) -> set_function(FPermit, params, s)
  | Use_permit(params)        -> call_permit(params, s, p)
  end
