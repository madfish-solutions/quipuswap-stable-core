(* Modules *)
#import "../partials/errors.ligo" "Errors"
#if TEST
#import "../partials/constants_test.ligo" "Constants"
#else
#import "../partials/constants.ligo" "Constants"
#endif
(* Types *)
#include "../partials/common_types.ligo"
#include "../partials/fa12/types.ligo"
#include "../partials/fa2/types.ligo"
#include "../partials/strategy/types.ligo"
#if !FACTORY
#include "../partials/dev/types.ligo"
#else
#endif
#include "../partials/dex_core/storage.ligo"
#include "../partials/admin/types.ligo"
#include "../partials/dex_core/types.ligo"
#include "../partials/dex_core/events.ligo"
(* Helpers and functions *)
#include "../partials/utils.ligo"
#if FACTORY
#include "../partials/dex_core/factory/helpers.ligo"
#else
#include "../partials/dex_core/standalone/helpers.ligo"
#endif
#include "../partials/dex_core/helpers.ligo"
#include "../partials/fa2/helpers.ligo"
#include "../partials/strategy/helpers.ligo"
#include "../partials/dex_core/math.ligo"
(* Lambda entrypoints *)
#include "../partials/admin/lambdas.ligo"
#include "../partials/fa2/lambdas.ligo"
#include "../partials/strategy/lambdas.ligo"
#include "../partials/dex_core/lambdas.ligo"
#if !FACTORY
#include "../partials/dev/lambdas.ligo"
#include "../partials/admin/standalone/lambdas.ligo"
(* Call methods *)
#include "../partials/dev/methods.ligo"
#else
#endif
#include "../partials/admin/methods.ligo"
#include "../partials/fa2/methods.ligo"
#include "../partials/strategy/methods.ligo"
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
    case p of [
#if !FACTORY
    | Set_dex_function(params)      -> s := set_function(FDex, params, s)
    | Set_admin_function(params)    -> s := set_function(FAdmin, params, s)
    | Set_token_function(params)    -> s := set_function(FToken, params, s)
    | Set_dev_function(params)      -> s := set_function(FDev, params, s)
    | Set_strategy_function(params) -> s := set_function(FStrat, params, s)
    | Use_dev(params)               -> s.storage.dev_store := call_dev(params, s.storage.dev_store)
#else
    | Factory_action(params)        -> s := factory_action(params, s)
#endif
    | _ -> skip
    ]
  } with case p of [
    | User_action(params) -> call_user_action(params, s)
    | Use_admin(params) -> call_admin(params, s)
    | Use_strategy(params) -> call_strategy(params, s)
    | _ -> (Constants.no_operations, s)
    ]