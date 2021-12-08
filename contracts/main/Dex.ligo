#import "../partials/errors.ligo" "Errors"
#import "../partials/constants.ligo" "Constants"

#include "../interfaces/i_permit.ligo"
#include "../interfaces/i_dex.ligo"

#include "../partials/getters.ligo"
#include "../partials/utils.ligo"

#include "../helpers/fa2.ligo"
#include "../helpers/permit.ligo"
#include "../helpers/dex.ligo"

#include "../lambdas/admin.ligo"
#include "../lambdas/permit.ligo"
#include "../lambdas/fa2.ligo"
#include "../lambdas/dex.ligo"

#include "../partials/dex_methods.ligo"

#include "../views/fa2.ligo"
#include "../views/dex.ligo"


(* Dex - Contract for exchanges between FA12 and FA2 tokens *)
function main(
  const p               : full_action_t;
  const s               : full_storage_t
)                       : full_return_t is
  case p of
  | Set_admin_function(params)  -> set_function(FAdmin, params, s)
  | Use_admin(params)           -> call_admin(params, s)
  | Set_dex_function(params)    -> set_function(FDex, params, s)
  | Use_dex(params)             -> call_dex(params, s)
  | Set_token_function(params)  -> set_function(FToken, params, s)
  | Use_token(params)           -> call_token(params, s, p)
  | Set_permit_function(params) -> set_function(FPermit, params, s)
  | Use_permit(params)          -> call_permit(params, s, p)
  end
