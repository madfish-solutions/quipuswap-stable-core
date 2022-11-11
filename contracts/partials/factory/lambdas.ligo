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
    const n_tokens = Set.cardinal(params.input_tokens);

    require(
      n_tokens <= Constants.max_tokens_count
      and n_tokens >= Constants.min_tokens_count
      and n_tokens = Map.size(params.tokens_info),
      Errors.Dex.wrong_tokens_count
    );
    require((params.a_constant > 0n) and (Constants.max_a >= params.a_constant), Errors.Dex.a_limit);
    require(sum_all_fee(params.fees, 0n) < Constants.fee_denominator / 2n, Errors.Dex.fee_overflow);

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

    const deploy = deploy_dex(
      (None : option(key_hash)),
      0mutez,
      form_pool_storage(
        tokens,
        tokens_info,
        params.a_constant,
        params.fees,
        params.default_referral,
        params.managers,
        s.storage.quipu_token,
        s.admin_lambdas,
        s.token_lambdas,
        s.strat_lambdas
      )
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
