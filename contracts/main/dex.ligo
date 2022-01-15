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
#if !FACTORY
#include "../partials/dev/types.ligo"
#else
#endif
#include "../partials/dex_core/storage.ligo"
#include "../partials/dex_core/types.ligo"
(* Helpers and functions *)
#include "../partials/utils.ligo"
#if FACTORY
#include "../partials/dex_core/factory/helpers.ligo"
#else
#include "../partials/dex_core/standalone/helpers.ligo"
#include "../partials/dev/lambdas.ligo"
#endif
#include "../partials/dex_core/helpers.ligo"
#include "../partials/fa2/helpers.ligo"
#include "../partials/permit/helpers.ligo"
#include "../partials/dex_core/math.ligo"
(* Lambda entrypoints *)
#include "../partials/admin/lambdas.ligo"
#include "../partials/fa2/lambdas.ligo"
#include "../partials/permit/lambdas.ligo"
#if !FACTORY
#include "../partials/dex_core/standalone/lambdas.ligo"
#include "../partials/dev/methods.ligo"
#else
#endif
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
  var s                 : full_storage_t
)                       : full_return_t is
  block {
    var operations := Constants.no_operations;
    case p of
    | Use_admin(params)           -> s := call_admin(params, s)
    | Use_dex(params)             -> {
      const run = call_dex(params, s);
      operations := run.0;
      s := run.1;
    }
    | Use_permit(params)          -> s := call_permit(params, s, p)
    | Use_token(params)           -> {
      const run = call_token(params, s, p);
      operations := run.0;
      s := run.1;
    }
#if !FACTORY
    | Set_admin_function(params)  -> s := set_function(FAdmin, params, s)
    | Set_dex_function(params)    -> s := set_function(FDex, params, s)
    | Set_permit_function(params) -> s := set_function(FPermit, params, s)
    | Set_token_function(params)  -> s := set_function(FToken, params, s)
    | Set_dev_function(params)    -> s := set_function(FDev, params, s)
    | Use_dev(params)             -> s.storage.dev_store := call_dev(params, s.storage.dev_store)
#else
#endif
    end;
  } with (operations, s)
