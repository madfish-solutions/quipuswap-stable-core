type deploy_dex_t is (option(key_hash) * tez * pool_f_storage_t) -> (operation * address)

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
