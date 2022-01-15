#import "../partials/errors.ligo" "Errors"
#import "../partials/constants.ligo" "Constants"
#include "../partials/common_types.ligo"
#define FACTORY
#include "../partials/admin/types.ligo"
#include "../partials/fa12/types.ligo"
#include "../partials/fa2/types.ligo"
#include "../partials/permit/types.ligo"
#include "../partials/dex_core/storage.ligo"
#include "../partials/dex_core/types.ligo"
#include "../partials/dev/types.ligo"
#include "../partials/factory/storage.ligo"
#include "../partials/utils.ligo"
#include "../partials/dev/methods.ligo"
#include "../partials/factory/deploy.ligo"
#include "../partials/factory/helpers.ligo"
#include "../partials/factory/methods.ligo"
#include "../partials/factory/views.ligo"

(* Dex - Contract for exchanges between FA12 and FA2 tokens *)
function main(
  const p               : fact_action_t;
  var s                 : full_storage_t
)                       : fact_return_t is
  block {
    var operations := Constants.no_operations;
    case p of
    | Use_dev(params)             -> s.storage.dev_store := call_dev(params, s.storage.dev_store)
    | _ -> skip
    end
  } with case p of
    | Set_admin_function(params)  -> (operations, set_function(FAdmin,  params, s))
    | Set_dex_function(params)    -> (operations, set_function(FDex,    params, s))
    | Set_permit_function(params) -> (operations, set_function(FPermit, params, s))
    | Set_token_function(params)  -> (operations, set_function(FToken,  params, s))
    | Set_dev_function(params)    -> (operations, set_function(FDev,    params, s))
    | Init_dex(params)            -> initialize_exchange(params, s)
    | Init_callback(params)       -> (init_callback(params), s)
    | Use_factory(params)         -> use_factory(params, s)
    | _ -> (operations, s)
    end
