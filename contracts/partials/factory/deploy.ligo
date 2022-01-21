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

[@inline] function add_dex_lambdas(
  var operations        : list(operation);
  const pool_address    : address;
  const lambdas         : big_map(nat, bytes))
                        : list(operation) is
  block {
    operations := Tezos.transaction(
      Unit,
      0mutez,
      unwrap(
        (Tezos.get_entrypoint_opt("%freeze", receiver): option(contract(unit))),
        "not_dex"
      )
    ) # operations;
    operations := set_lambd_dex(
      record[
        func = unwrap(lambdas[1n], Errors.Dex.unknown_func);
        index = 1n;
      ],
      pool_address
    ) # operations;
    operations := set_lambd_dex(
      record[
        func = unwrap(lambdas[1n], Errors.Dex.unknown_func);
        index = 1n;
      ],
      pool_address
    ) # operations;
    operations := set_lambd_dex(
      record[
        func = unwrap(lambdas[2n], Errors.Dex.unknown_func);
        index = 2n;
      ],
      pool_address
    ) # operations;
    operations := set_lambd_dex(
      record[
        func = unwrap(lambdas[3n], Errors.Dex.unknown_func);
        index = 3n;
      ],
      pool_address
    ) # operations;
    operations := set_lambd_dex(
      record[
        func = unwrap(lambdas[4n], Errors.Dex.unknown_func);
        index = 4n;
      ],
      pool_address
    ) # operations;
    operations := set_lambd_dex(
      record[
        func = unwrap(lambdas[5n], Errors.Dex.unknown_func);
        index = 5n;
      ],
      pool_address
    ) # operations;
    operations := set_lambd_dex(
      record[
        func = unwrap(lambdas[6n], Errors.Dex.unknown_func);
        index = 6n;
      ],
      pool_address
    ) # operations;
    operations := set_lambd_dex(
      record[
        func = unwrap(lambdas[7n], Errors.Dex.unknown_func);
        index = 7n;
      ],
      pool_address
    ) # operations;
    operations := set_lambd_dex(
      record[
        func = unwrap(lambdas[8n], Errors.Dex.unknown_func);
        index = 8n;
      ],
      pool_address
    ) # operations;
    operations := set_lambd_dex(
      record[
        func = unwrap(lambdas[9n], Errors.Dex.unknown_func);
        index = 9n;
      ],
      pool_address
    ) # operations;
    operations := set_lambd_dex(
      record[
        func = unwrap(lambdas[10n], Errors.Dex.unknown_func);
        index = 10n;
      ],
      pool_address
    ) # operations;
    operations := set_lambd_dex(
      record[
        func = unwrap(lambdas[11n], Errors.Dex.unknown_func);
        index = 11n;
      ],
      pool_address
    ) # operations;
    operations := set_lambd_dex(
      record[
        func = unwrap(lambdas[12n], Errors.Dex.unknown_func);
        index = 12n;
      ],
      pool_address
    ) # operations;
    operations := set_lambd_dex(
      record[
        func = unwrap(lambdas[13n], Errors.Dex.unknown_func);
        index = 13n;
      ],
      pool_address
    ) # operations;
  } with operations