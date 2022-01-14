type deploy_dex_t is (option(key_hash) * tez * full_storage_t) -> (operation * address)

const deploy_dex : deploy_dex_t =
[%Michelson(
  {|
    {
      UNPPAIIR;
      CREATE_CONTRACT
#include "../../compiled/dex4factory.tz"
      ;
      PAIR;
    }
  |} : deploy_dex_t
)];