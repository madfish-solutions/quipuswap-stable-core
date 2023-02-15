[@inline] function check_pool(
  const t_bytes         : bytes;
  const pool_map        : big_map(bytes, address))
                        : unit is
  case pool_map[t_bytes] of [
  | None -> unit
  | Some(_address) -> failwith(Errors.Dex.pool_listed)
  ]


[@inline] function call_add_liq(
  const params          : invest_param_t;
  const receiver        : address)
                        : operation is
  Tezos.transaction(
    params,
    0mutez,
    unwrap(
      (Tezos.get_entrypoint_opt("%invest", receiver): option(contract(invest_param_t))),
      Errors.Factory.not_dex
    )
  )

[@inline] function set_lambd_dex(
  const params          : big_map(nat, bytes);
  const receiver        : address)
                        : operation is
  Tezos.transaction(
    params,
    0mutez,
    unwrap(
      (Tezos.get_entrypoint_opt("%copy_dex_function", receiver): option(contract(big_map(nat, bytes)))),
      Errors.Factory.not_dex
    )
  )

[@inline] function unfreeze_dex(
  const receiver        : address)
                        : operation is
  Tezos.transaction(
    Unit,
    0mutez,
    unwrap(
      (Tezos.get_entrypoint_opt("%freeze", receiver): option(contract(unit))),
      Errors.Factory.not_dex
    )
  )

[@inline] function set_init_function(
  const params          : bytes;
  var s                 : full_storage_t)
                        : option(bytes) is
  block {
    require(Tezos.get_sender() = s.storage.dev_store.dev_address, Errors.Dex.not_developer);
    case s.init_func of [
    | Some(_) -> failwith(Errors.Dex.func_set)
    | None -> skip
    ]
  } with Some(params)

[@inline] function run_init_func(
  const params          : pool_init_param_t;
  const s               : full_storage_t)
                        : fact_return_t is
  block {
    const lambda: bytes = unwrap(s.init_func, Errors.Dex.unknown_func);
    const func: init_func_t = unwrap((Bytes.unpack(lambda) : option(init_func_t)), Errors.Dex.wrong_use_function);
  } with func(params, s)

[@inline] function pack_pool_key(
  const deployer        : address;
  const tokens          : tokens_map_t)
                        : bytes is
  block {
    const key_to_pack: key_to_pack_t = record [ tokens=tokens; deployer=deployer ];
  } with Bytes.pack(key_to_pack);

function manage_startup_charges(
  const wl              : set(address);
  const price           : nat;
  const burn_rate_f     : nat;
  const quipu_token     : fa2_token_t;
  var operations        : list(operation);
  var quipu_rewards     : nat)
                        : record [ ops: list(operation); rewards: nat ] is
  block {
    if not (wl contains Tezos.get_sender())
    then {
      const to_burn = price * burn_rate_f / Constants.burn_rate_precision;
      const to_factory = abs(price - to_burn);
      operations := typed_transfer(
        Tezos.get_sender(),
        Tezos.get_self_address(),
        to_factory,
        Fa2(quipu_token)
      ) # operations;
      operations := typed_transfer(
        Tezos.get_sender(),
        Constants.burn_address,
        to_burn,
        Fa2(quipu_token)
      ) # operations;
      quipu_rewards := quipu_rewards + to_factory;
    }
    else skip;
    const return = record[
      ops = operations;
      rewards = quipu_rewards;
    ]
  } with return

function form_pool_storage(
  const tokens          : tokens_map_t;
  const tokens_info     : map(token_pool_idx_t, token_info_t);
  const a_constant      : nat;
  const fees            : fees_storage_t;
  const default_referral: address;
  const managers        : set(address);
  const quipu_token     : fa2_token_t;
  const a_lambdas       : big_map(nat, bytes);
  const t_lambdas       : big_map(nat, bytes);
  const s_lambdas       : big_map(nat, bytes))
                        : pool_f_storage_t is
  block {
    const default_token_id = 0n;
    const pool: pool_t = (record [
      initial_A_f         = a_constant * Constants.a_precision;
      future_A_f          = a_constant * Constants.a_precision;
      initial_A_time      = Tezos.get_now();
      future_A_time       = Tezos.get_now();
      tokens_info         = tokens_info;
      fee                 = fees;
      strategy            = record[
        strat_contract      = (None: option(address));
        configuration       = (map[]: map(token_pool_idx_t, strategy_storage_t));
      ];
      staker_accumulator  = record [
                              accumulator_f = (map []: map(token_pool_idx_t, nat));
                              total_fees    = (map []: map(token_pool_idx_t, nat));
                              total_staked  = 0n;
                            ];
      total_supply        = 0n;
    ]: pool_t);

    const pool_storage: storage_t = (record[
      admin               = Tezos.get_sender();
      default_referral    = default_referral;
      managers            = managers;
      pools_count         = 1n;
      tokens              = big_map[default_token_id -> tokens];
      pool_to_id          = big_map[Bytes.pack(tokens) -> default_token_id];
      pools               = big_map[default_token_id -> pool];
      ledger              = (big_map[]: big_map((address * nat), nat));
      token_metadata      = big_map[
                              default_token_id -> record[
                                token_id   = default_token_id;
                                token_info = Constants.default_token_metadata
                              ];
                            ];
      allowances          = (big_map[]: big_map((address * nat), allowances_data_t));
      dev_rewards         = (big_map[]: big_map(token_t, nat));
      referral_rewards    = (big_map[]: big_map((address * token_t), nat));
      stakers_balance     = (big_map[]: big_map((address * pool_id_t), staker_info_t));
      quipu_token         = quipu_token;
      factory_address     = Tezos.get_self_address();
      started             = False;
    ]: storage_t);
  } with (record [
      storage       = pool_storage;
      metadata      = big_map[
                      "" -> 0x74657a6f732d73746f726167653a646578;
                      "dex" -> Constants.default_dex_metadata;
                    ];
      admin_lambdas = a_lambdas;
      dex_lambdas   = (big_map[]: big_map(nat, bytes)); // too large for injection in one operation
      token_lambdas = t_lambdas;
      strat_lambdas = s_lambdas;
    ]: pool_f_storage_t)