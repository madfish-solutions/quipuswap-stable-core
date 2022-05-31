(* Initial exchange setup
 * note: tokens should be approved before the operation
 *)
function add_pool(
  const p               : admin_action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var operations: list(operation) := Constants.no_operations;
    case p of [
    | Add_pool(params) -> {
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
      const token_bytes : bytes = Bytes.pack(tokens);
      var (pool_i, token_id) := get_pool_info(token_bytes, s.pools_count, s.pool_to_id, s.pools);

      require(pool_i.total_supply = 0n, Errors.Dex.pool_listed);
      s.tokens[token_id] := tokens;


      if s.pools_count = token_id
      then {
        s.pool_to_id[token_bytes] := token_id;
        s.token_metadata[token_id] := record[
            token_id = token_id;
            token_info = Constants.default_token_metadata
        ];
        s.pools_count := s.pools_count + 1n;
      }
      else skip;

      function separate_inputs(
        var accum       : map(token_pool_idx_t, token_info_t) * map(token_pool_idx_t, nat);
        const entry     : token_pool_idx_t * token_info_t)
                        : map(token_pool_idx_t, token_info_t) * map(token_pool_idx_t, nat) is
        block {
          accum.1[entry.0] := entry.1.reserves;
          accum.0[entry.0] := entry.1 with record [ reserves = 0n; ]
        } with accum;

      const (tokens_info, inputs) = Map.fold(
        separate_inputs,
        params.tokens_info,
        (params.tokens_info, (map[]:map(token_pool_idx_t, nat)))
      );

      const pool = pool_i with record [
        initial_A_f     = params.a_constant * Constants.a_precision;
        future_A_f      = params.a_constant * Constants.a_precision;
        initial_A_time  = Tezos.now;
        future_A_time   = Tezos.now;
        tokens_info     = tokens_info;
      ];

      const res = add_liq(record [
        referral        = (None: option(address));
        pool_id         = token_id;
        pool            = pool;
        inputs          = inputs;
        min_mint_amount = 1n;
        receiver        = Some(Tezos.sender)
      ], s);
      operations := res.op;
      s := res.s;
    }
    | _                 -> unreachable(Unit)
    ]
  } with (operations, s)
