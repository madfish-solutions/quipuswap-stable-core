(* Initial exchange setup
 * note: tokens should be approved before the operation
 *)
function initialize_exchange(
  const params          : pool_init_prm_t;
  var s                 : full_storage_t)
                        : fact_return_t is
  block {
    var operations := Constants.no_operations;
    (* Params check *)
    const n_tokens = Set.size(params.input_tokens);

    assert_with_error(
      n_tokens < Constants.max_tokens_count
      and n_tokens >= Constants.min_tokens_count
      and n_tokens = Map.size(params.tokens_info),
      Errors.Dex.wrong_tokens_count
    );
    const result: tmp_tkns_map_t = Set.fold(get_tokens_from_param, params.input_tokens, default_tmp_tokens);
    const tokens : tkns_map_t = result.tokens;
    const token_bytes : bytes = Bytes.pack(tokens);
    check_pool(token_bytes, s.storage.pool_to_address);


    const token_id = 0n;

    assert_with_error(Constants.max_a >= params.a_constant, Errors.Dex.a_limit);

    function separate_inputs(
      var acc         : map(tkn_pool_idx_t, tkn_inf_t) * map(tkn_pool_idx_t, nat);
      const entry     : tkn_pool_idx_t * tkn_inf_t)
                      : map(tkn_pool_idx_t, tkn_inf_t) * map(tkn_pool_idx_t, nat) is
      block {
        acc.1[entry.0] := entry.1.reserves;
        acc.0[entry.0] := entry.1 with record [ reserves = 0n; ]
      } with acc;

    const (tokens_info, inputs) = Map.fold(
      separate_inputs,
      params.tokens_info,
      (params.tokens_info, (map[]:map(tkn_pool_idx_t, nat)))
    );

    const pool = record [
      initial_A       = params.a_constant * Constants.a_precision;
      future_A        = params.a_constant * Constants.a_precision;
      initial_A_time  = Tezos.now;
      future_A_time   = Tezos.now;
      tokens_info     = tokens_info;
      fee             = record [
        lp_fee          = 0n;
        ref_fee         = 0n;
        stakers_fee     = 0n;
      ];
      staker_accumulator  = record [
        accumulator         = (map []: map(tkn_pool_idx_t, nat));
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
      pool_to_id = big_map[token_bytes -> 0n];
      pools = big_map[0n -> pool];
      ledger = (big_map[]: big_map((address * nat), nat));
      account_data = (big_map[]: big_map((address * nat), account_data_t));
      dev_rewards = (big_map[]: big_map(token_t, nat));
      referral_rewards = (big_map[]: big_map((address * token_t), nat));
      stakers_balance = (big_map[]: big_map((address * pool_id_t), stkr_info_t));
      quipu_token = s.storage.quipu_token;
      factory_address = Tezos.self_address;
    ];


    const pool_f_store : pool_f_storage_t = record [
      storage = pool_storage;
      metadata = params.metadata;
      token_metadata = params.token_metadata;
      admin_lambdas = s.admin_lambdas;
      dex_lambdas = (big_map[]: big_map(nat, bytes));//s.dex_lambdas;
      token_lambdas = s.token_lambdas;
      permit_lambdas = s.permit_lambdas;
      permits = (big_map[]: permits_t);
      permits_counter = 0n;
      default_expiry = params.permit_def_expiry
    ];

    const deploy = deploy_dex(
      (None : option(key_hash)),
      0mutez,
      pool_f_store
    );
    const pool_address = deploy.1;
    s.storage.pool_to_address[token_bytes] := pool_address;
    s.storage.pools_count := s.storage.pools_count + 1n;
    s.storage.deployers[pool_address] := Tezos.sender;
    // const cb_prm: callback_prm_t = record[
    //   in_amounts = inputs;
    //   pool_address = pool_address;
    //   tokens = tokens;
    //   sender = Tezos.sender;
    // ];
    // operations := Tezos.transaction(
    //   cb_prm,
    //   0mutez,
    //   unwrap(
    //     (Tezos.get_entrypoint_opt("%init_callback", Tezos.self_address): option(contract(callback_prm_t))),
    //     Errors.Dex.unknown_func
    //   )
    // ) # operations;
    operations := deploy.0 # operations;
    if not (s.storage.whitelist contains Tezos.sender)
    then {
      const to_burn = s.storage.init_price * s.storage.burn_rate / Constants.burn_rate_precision;
      const to_factory = abs(s.storage.init_price - to_burn);
      operations := typed_transfer(
        Tezos.sender,
        Tezos.self_address,
        to_factory,
        Fa2(s.storage.quipu_token)
      ) # operations;
      operations := typed_transfer(
        Tezos.sender,
        Constants.burn_address,
        to_burn,
        Fa2(s.storage.quipu_token)
      ) # operations;
      s.storage.quipu_rewards := s.storage.quipu_rewards + to_factory;
    }
    else skip;
  } with (operations, s)
