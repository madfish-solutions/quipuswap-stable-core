#import "../partials/errors.ligo" "Errors"
#import "../partials/constants.ligo" "Constants"
#include "../partials/common_types.ligo"
#define FACTORY
#include "../partials/fa12/types.ligo"
#include "../partials/fa2/types.ligo"
#include "../partials/permit/types.ligo"
#include "../partials/dex_core/storage.ligo"
#include "../partials/admin/types.ligo"
#include "../partials/dex_core/types.ligo"
#include "../partials/dev/types.ligo"
#include "../partials/factory/storage.ligo"
#include "../partials/utils.ligo"
#include "../partials/dev/methods.ligo"
#include "../partials/factory/helpers.ligo"
#include "../partials/factory/deploy.ligo"
#include "../partials/factory/methods.ligo"
#include "../partials/factory/lambdas.ligo"
#include "../partials/factory/views.ligo"

(* Factory - Contract for deploy exchanges between FA12 and FA2 tokens *)
function main(
  const p               : fact_action_t;
  var s                 : full_storage_t)
                        : fact_return_t is
  block {
    case p of
    | Set_init_function(params)   -> s.init_func          := set_init_function(params, s)
    | Set_dev_function(params)    -> s                    := set_function(FDev,    params, s)
    | Set_admin_function(params)  -> s                    := set_function(FAdmin,  params, s)
    | Set_dex_function(params)    -> s                    := set_function(FDex,    params, s)
    | Set_token_function(params)  -> s                    := set_function(FToken,  params, s)
    | Set_permit_function(params) -> s                    := set_function(FPermit, params, s)
    | Use_dev(params)             -> s.storage.dev_store  := call_dev(params, s.storage.dev_store)
    // | Init_callback(params)       -> operations           := init_callback(params, s)
    | _ -> skip
    end
  } with case p of
    | Add_pool(params)            -> run_init_func(params, s)
    | Start_dex(params)           -> start_dex_func(params, s)
    | Use_factory(params)         -> use_factory(params, s)
    | _                           -> (Constants.no_operations, s)
    end
