(* Initial exchange setup
 * note: tokens should be approved before the operation
 *)
function initialize_exchange(
  const params          : pool_init_prm_t;
  var s                 : fact_storage_t)
                        : return_t is
  block {
    var operations: list(operation) := Constants.no_operations;

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
    check_pool(token_bytes, s.pool_to_address);


    const token_id = 0n;

    // s.tokens[token_id] := tokens;

    // assert_with_error(pool_i.total_supply = 0n, Errors.Dex.pool_listed);

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

    var pool_storage: storage_t = record[
      admin = Tezos.sender;
      default_referral = params.default_referral;
      managers = params.managers;
      pools_count = 1n;
      tokens = big_map[token_id -> tokens];
      pool_to_id = big_map[token_bytes -> 0n]
      pools = big_map[0n -> pool]
      ledger = (big_map[]: big_map((address * nat), nat));
      account_data = (big_map[]: big_map((address * nat), account_data_t));
      dev_rewards = (big_map[]: big_map(token_t, nat));
      referral_rewards = (big_map[]: big_map((address * token_t), nat);
      stakers_balance = (big_map[]: big_map((address * pool_id_t), stkr_info_t);
      quipu_token = s.quipu_token;
      factory_address = Tezos.self_address;
    ]


    var pool_f_store : full_storage_t = record [
      storage = pool_storage;
      metadata = params.metadata;
      token_metadata = params.token_metadata;
      admin_lambdas = s.admin_lambdas;
      dex_lambdas = s.dex_lambdas;
      token_lambdas = s.token_lambdas;
      permit_lambdas = s.permit_lambdas;
    ];

    const deploy = deploy_dex(
      (None : option(key_hash)),
      0mutez,
      pool_f_store
    )
    const pool_address = deploy.1;
    s.pool_to_address[token_bytes] := pool_address;
    s.pools_count := s.pools_count + 1n;

    const add_liq_p: invest_prm_t = record [
      pool_id    = token_id;
      shares     = 0n;
      in_amounts = inputs;
      time_expiration = Tezos.now + 300;
      receiver = Tezos.sender;
      referral = (None: option(address));
    ];

    const operations: list(operation) = list [
      deploy.0,
      call_add_liq(add_liq_p, pool_address)
    ];
  } with (operations, s)
