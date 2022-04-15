(* Initial exchange setup
 * note: tokens should be approved before the operation
 *)
function add_pool(
  const params          : pool_init_param_t;
  var s                 : full_storage_t)
                        : fact_return_t is
  block {
    var operations := Constants.no_operations;
    (* Params check *)
    const n_tokens = Set.size(params.input_tokens);

    require(
      n_tokens <= Constants.max_tokens_count
      and n_tokens >= Constants.min_tokens_count
      and n_tokens = Map.size(params.tokens_info),
      Errors.Dex.wrong_tokens_count
    );
    const result: tmp_tokens_map_t = Set.fold(get_tokens_from_param, params.input_tokens, default_tmp_tokens);
    const tokens : tokens_map_t = result.tokens;
    const pool_key : bytes = pack_pool_key(Tezos.sender, tokens);
    check_pool(pool_key, s.storage.pool_to_address);

    function set_reserves(
      var _key          : token_pool_idx_t;
      const value       : token_prec_info_t)
                        : token_info_t is
      record [
        rate_f = value.rate_f;
        precision_multiplier_f = value.precision_multiplier_f;
        reserves = 0n;
      ];

    const tokens_info = Map.map(set_reserves, params.tokens_info);

    const token_id = 0n;

    require(Constants.max_a >= params.a_constant, Errors.Dex.a_limit);

    const pool = record [
      initial_A_f     = params.a_constant * Constants.a_precision;
      future_A_f      = params.a_constant * Constants.a_precision;
      initial_A_time  = Tezos.now;
      future_A_time   = Tezos.now;
      tokens_info     = tokens_info;
      fee             = params.fees;
      staker_accumulator  = record [
        accumulator_f       = (map []: map(token_pool_idx_t, nat));
        total_staked        = 0n;
      ];
      total_supply        = 0n;
    ];

    const pool_storage: storage_t = record[
      admin = Tezos.sender;
      default_referral = params.default_referral;
      managers = params.managers;
      pools_count = 1n;
      tokens = big_map[token_id -> tokens];
      pool_to_id = big_map[Bytes.pack(tokens) -> 0n];
      pools = big_map[0n -> pool];
      ledger = (big_map[]: big_map((address * nat), nat));
      token_metadata = big_map[
        0n -> record[
          token_id = 0n;
          token_info = Constants.default_token_metadata
        ];
      ];
      allowances = (big_map[]: big_map((address * nat), allowances_data_t));
      dev_rewards = (big_map[]: big_map(token_t, nat));
      referral_rewards = (big_map[]: big_map((address * token_t), nat));
      stakers_balance = (big_map[]: big_map((address * pool_id_t), staker_info_t));
      quipu_token = s.storage.quipu_token;
      factory_address = Tezos.self_address;
      started = False;
    ];


    const pool_f_store : pool_f_storage_t = record [
      storage = pool_storage;
      metadata = big_map[
        "" -> 0x74657a6f732d73746f726167653a646578;
        "dex" -> Constants.default_dex_metadata;
      ];
      admin_lambdas = s.admin_lambdas;
      dex_lambdas = (big_map[]: big_map(nat, bytes));//s.dex_lambdas;//
      token_lambdas = s.token_lambdas;
    ];

    const deploy = deploy_dex(
      (None : option(key_hash)),
      0mutez,
      pool_f_store
    );
    const pool_address = deploy.1;

    s.storage.pool_to_address[pool_key] := pool_address;
    s.storage.pool_id_to_address[s.storage.pools_count] := pool_address;
    s.storage.pools_count := s.storage.pools_count + 1n;

    operations := deploy.0 # operations;
    const charges = manage_startup_charges(
      s.storage.whitelist,
      s.storage.init_price,
      s.storage.burn_rate_f,
      s.storage.quipu_token,
      operations,
      s.storage.quipu_rewards
    );

    operations := charges.ops;
    s.storage.quipu_rewards := charges.rewards;
  } with (operations, s)
