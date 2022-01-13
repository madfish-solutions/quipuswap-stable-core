(* Modules *)
#import "../partials/errors.ligo" "Errors"
#if TEST
#import "../partials/constants_test.ligo" "Constants"
#else
#import "../partials/constants.ligo" "Constants"
#endif
(* Types *)
#include "../partials/common_types.ligo"
#include "../partials/admin/types.ligo"
#include "../partials/fa12/types.ligo"
#include "../partials/fa2/types.ligo"
#include "../partials/permit/types.ligo"
#include "../partials/dex_core/storage.ligo"
#include "../partials/dex_core/types.ligo"
(* Helpers and functions *)
#include "../partials/utils.ligo"
#include "../partials/dex_core/helpers.ligo"
#include "../partials/fa2/helpers.ligo"
#include "../partials/permit/helpers.ligo"
#include "../partials/dex_core/math.ligo"
(* Lambda entrypoints *)
#include "../partials/admin/lambdas.ligo"
#include "../partials/fa2/lambdas.ligo"
#include "../partials/permit/lambdas.ligo"
#include "../partials/dex_core/lambdas.ligo"
(* Call methods *)
#include "../partials/admin/methods.ligo"
#include "../partials/fa2/methods.ligo"
#include "../partials/permit/methods.ligo"
#include "../partials/dex_core/methods.ligo"
(* View methods *)
#include "../partials/fa2/views.ligo"
#include "../partials/dex_core/views.ligo"
(* Dex - Contract for exchanges between FA12 and FA2 tokens *)
function main(
  const p               : full_action_t;
  const s               : full_storage_t
)                       : full_return_t is
  case p of
  | Set_admin_function(params)  -> set_function(FAdmin, params, s)
  | Set_dex_function(params)    -> set_function(FDex, params, s)
  | Set_permit_function(params) -> set_function(FPermit, params, s)
  | Set_token_function(params)  -> set_function(FToken, params, s)
  | Use_admin(params)           -> call_admin(params, s)
  | Use_dex(params)             -> call_dex(params, s)
  | Use_permit(params)          -> call_permit(params, s, p)
  | Use_token(params)           -> call_token(params, s, p)
  end
