(* Swap token i to j
 * note: tokens should be approved before the operation
 *)
function swap(
  const p               : dex_action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var operations: list(operation) := Constants.no_operations;
    case p of [
    | Swap(params) -> {
      check_deadline(params.deadline);
      require(params.min_amount_out > 0n, Errors.Dex.zero_min_out);
      const dx = params.amount;
      require(dx =/= 0n, Errors.Dex.zero_in);
      const tokens : tokens_map_t = unwrap(s.tokens[params.pool_id], Errors.Dex.pool_not_listed);
      const tokens_count = Map.size(tokens);
      const i = params.idx_from;
      const j = params.idx_to;
      require(i < tokens_count and j < tokens_count, Errors.Dex.wrong_index);
      const receiver = unwrap_or(params.receiver, Tezos.sender);
      var pool : pool_t := unwrap(s.pools[params.pool_id], Errors.Dex.pool_not_listed);
      const dy = perform_swap(i, j, dx, pool);
      const pool_total_staked = pool.staker_accumulator.total_staked;
      const after_fees = slice_fee(dy, pool.fee, get_dev_fee(s), pool_total_staked);
      var to_stakers_f := 0n;
      if pool_total_staked > 0n
        then {
          pool.staker_accumulator.total_fees[j] := unwrap_or(pool.staker_accumulator.total_fees[j], 0n) + after_fees.stakers;
          to_stakers_f := after_fees.stakers * Constants.accum_precision / pool_total_staked;
        }
        else skip;
      const referral: address = unwrap_or(params.referral, s.default_referral);
      const token_j = unwrap(tokens[j], Errors.Dex.no_token);
      const ref_key = (referral, token_j);

      s.referral_rewards[ref_key] := unwrap_or(s.referral_rewards[ref_key], 0n) + after_fees.ref;
      s.dev_rewards[token_j] := unwrap_or(s.dev_rewards[token_j], 0n) + after_fees.dev;
      pool.staker_accumulator.accumulator_f[j] := unwrap_or(pool.staker_accumulator.accumulator_f[j], 0n) + to_stakers_f;

      require(after_fees.dy >= params.min_amount_out, Errors.Dex.high_min_out);

      var token_info_i := unwrap(pool.tokens_info[i], Errors.Dex.no_token_info);
      var token_info_j := nip_fees_off_reserves(
        after_fees.stakers,
        after_fees.ref,
        after_fees.dev,
        unwrap(pool.tokens_info[j], Errors.Dex.no_token_info)
      );

      token_info_i.reserves := token_info_i.reserves + dx;
      token_info_j.reserves := nat_or_error(token_info_j.reserves - after_fees.dy, Errors.Dex.no_liquidity);
      pool.tokens_info[i] := token_info_i;
      pool.tokens_info[j] := token_info_j;
      s.pools[params.pool_id] := pool;
      operations := typed_transfer(
        Tezos.self_address,
        receiver,
        after_fees.dy,
        token_j
      ) # operations;
      operations := typed_transfer(
        Tezos.sender,
        Tezos.self_address,
        dx,
        unwrap(tokens[i], Errors.Dex.no_token)
      ) # operations;
    }
    | _ -> unreachable(Unit)
    ]
  } with (operations, s)

(* Provide liquidity (balanced) to the pool,
 * note: tokens should be approved before the operation
 *)
function invest_liquidity(
  const p               : dex_action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var operations: list(operation) := Constants.no_operations;
    case p of [
    | Invest(params) -> {
      check_deadline(params.deadline);

      const result = add_liq(record [
        referral        = params.referral;
        pool_id         = params.pool_id;
        pool            = unwrap(s.pools[params.pool_id], Errors.Dex.pool_not_listed);
        inputs          = params.in_amounts;
        min_mint_amount = params.shares;
        receiver        = params.receiver;
      ], s);

      operations := result.op;
      s := result.s;
    }
    | _ -> unreachable(Unit)
    ]
  } with (operations, s)


(* Remove liquidity (balanced) from the pool by burning shares *)
function divest_liquidity(
  const p               : dex_action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var operations: list(operation) := Constants.no_operations;
    case p of [
    | Divest(params) -> {
      check_deadline(params.deadline);
      require(s.pools_count > params.pool_id, Errors.Dex.pool_not_listed);
      require(params.shares =/= 0n, Errors.Dex.zero_in);

      var   pool          : pool_t := unwrap(s.pools[params.pool_id], Errors.Dex.pool_not_listed);
      const receiver = unwrap_or(params.receiver, Tezos.sender);
      const total_supply  : nat = pool.total_supply;

      function divest_reserves(
        var accum       : record [ tok_inf: map(token_pool_idx_t, token_info_t); op: list(operation) ];
        const entry     : (token_pool_idx_t * token_t))
                        : record [ tok_inf: map(token_pool_idx_t, token_info_t); op: list(operation) ] is
        block {
          var token_info := unwrap(accum.tok_inf[entry.0], Errors.Dex.no_token_info);
          const min_amount_out = unwrap_or(params.min_amounts_out[entry.0], 1n);
          require(min_amount_out > 0n, Errors.Dex.zero_min_out);
          const value = token_info.reserves * params.shares / total_supply;
          require(value >= min_amount_out, Errors.Dex.high_min_out);
          require(value =/= 0n, Errors.Dex.dust_out);
          accum.op := typed_transfer(
            Tezos.self_address,
            receiver,
            value,
            entry.1
          ) # accum.op;
          token_info.reserves := nat_or_error(token_info.reserves - value, Errors.Dex.low_reserves);
          accum.tok_inf[entry.0] := token_info;
        } with accum;

      const tokens : tokens_map_t = unwrap(s.tokens[params.pool_id], Errors.Dex.pool_not_listed);
      const res = Map.fold(divest_reserves, tokens, record [ tok_inf = pool.tokens_info; op = operations ]);

      pool.tokens_info := res.tok_inf;
      pool.total_supply := nat_or_error(pool.total_supply - params.shares, Errors.Dex.low_total_supply);

      const key = (Tezos.sender, params.pool_id);
      const share = unwrap_or(s.ledger[key], 0n);

      s.ledger[key] := nat_or_error(share - params.shares, Errors.Dex.insufficient_lp);
      s.pools[params.pool_id] := pool;
      operations := res.op;
    }
    | _                 -> unreachable(Unit)
    ]
  } with (operations, s)

(* Custom *)

(* Divest imbalanced *)
function divest_imbalanced(
  const p               : dex_action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var operations: list(operation) := Constants.no_operations;
    case p of [
    | Divest_imbalanced(params) -> {
      check_deadline(params.deadline);
      require(params.max_shares > 0n, Errors.Dex.zero_in);

      const receiver = unwrap_or(params.receiver, Tezos.sender);
      const key = (Tezos.sender, params.pool_id);
      const share = unwrap_or(s.ledger[key], 0n);


      var pool := unwrap(s.pools[params.pool_id], Errors.Dex.pool_not_listed);
      const tokens = unwrap(s.tokens[params.pool_id], Errors.Dex.pool_not_listed);
      const amp_f : nat =  get_A(
        pool.initial_A_time,
        pool.initial_A_f,
        pool.future_A_time,
        pool.future_A_f
      );
      // Initial invariant
      const init_tokens_info = pool.tokens_info;
      const d0 = get_D_mem(init_tokens_info, amp_f);
      var token_supply := pool.total_supply;

      function min_inputs(
        var accum       : info_ops_accum_t;
        var value       : (token_pool_idx_t * nat))
                        : info_ops_accum_t is
        block {
          var t_i := unwrap(
            accum.tokens_info[value.0],
            Errors.Dex.no_token_info
          );
          t_i.reserves := nat_or_error(
            t_i.reserves - value.1,
            Errors.Dex.low_reserves
          );
          require(t_i.reserves > 0n, Errors.Dex.low_reserves);
          accum.tokens_info[value.0] := t_i;
          if value.1 > 0n
          then accum.operations := typed_transfer(
              Tezos.self_address,
              receiver,
              value.1,
              unwrap(tokens[value.0], Errors.Dex.wrong_index)
            ) # accum.operations
          else skip;
        } with accum;

      const result = Map.fold(
        min_inputs,
        params.amounts_out,
        record [
          tokens_info = init_tokens_info;
          operations = operations;
        ]
      );
      var new_tokens_info := result.tokens_info;

      operations := result.operations;

      const d1 = get_D_mem(new_tokens_info, amp_f);
      const balanced = balance_inputs(
        init_tokens_info,
        d0,
        new_tokens_info,
        d1,
        tokens,
        pool.fee,
        get_dev_fee(s),
        unwrap_or(params.referral, s.default_referral),
        record[
          dev_rewards = s.dev_rewards;
          referral_rewards = s.referral_rewards;
          staker_accumulator = pool.staker_accumulator;
          tokens_info = new_tokens_info;
          tokens_info_without_lp = new_tokens_info;
        ]
      );
      const d2 = get_D_mem(balanced.tokens_info_without_lp, amp_f);
      var burn_amount := ceil_div(nat_or_error(d0 - d2, Errors.Math.nat_error) * token_supply, d0);

      require(burn_amount > 0n, Errors.Dex.zero_burn_amount);

      // burn_amount := burn_amount + 1n; // In case of rounding errors - make it unfavorable for the "attacker"

      require(burn_amount <= params.max_shares, Errors.Dex.low_max_shares_in);

      const new_shares = nat_or_error(share - burn_amount, Errors.Dex.insufficient_lp);

      patch s with record [
        dev_rewards = balanced.dev_rewards;
        referral_rewards = balanced.referral_rewards;
      ];
      patch pool with record [
        staker_accumulator = balanced.staker_accumulator;
        tokens_info = balanced.tokens_info;
        total_supply = nat_or_error(pool.total_supply - burn_amount, Errors.Math.nat_error);
      ];
      s.pools[params.pool_id] := pool;
      s.ledger[(Tezos.sender, params.pool_id)] := new_shares;
    }
    | _ -> unreachable(Unit)
    ];
  } with (operations, s)

(* Divest one coin *)
function divest_one_coin(
  const p               : dex_action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var operations: list(operation) := Constants.no_operations;
    case p of [
    | Divest_one_coin(params) -> {
      check_deadline(params.deadline);
      require(params.min_amount_out > 0n, Errors.Dex.zero_min_out);
      require(params.shares > 0n, Errors.Dex.zero_in);

      var pool := unwrap(s.pools[params.pool_id], Errors.Dex.pool_not_listed);
      require(params.token_index < Map.size(pool.tokens_info), Errors.Dex.wrong_index);
      const sender_key = (Tezos.sender, params.pool_id);
      const token = get_token_by_id(params.token_index, s.tokens[params.pool_id]);


      const amp_f : nat =  get_A(
        pool.initial_A_time,
        pool.initial_A_f,
        pool.future_A_time,
        pool.future_A_f
      );
      const dev_fee_f = get_dev_fee(s);
      const result = calc_withdraw_one_coin(amp_f, params.shares, params.token_index, dev_fee_f, pool);
      require(result.dy >= params.min_amount_out, Errors.Dex.high_min_out);
      var all_fee_f := sum_all_fee(pool.fee, dev_fee_f);
      if (all_fee_f = 0n) // check for avoid zero division
      then all_fee_f := 1n
      else skip;
      const dev_fee = result.dy_fee * dev_fee_f / all_fee_f;
      const ref_fee = result.dy_fee * pool.fee.ref_f / all_fee_f;
      var staker_fee := result.dy_fee * pool.fee.stakers_f / all_fee_f;
      if pool.staker_accumulator.total_staked > 0n
      then {
        pool.staker_accumulator.total_fees[params.token_index] := unwrap_or(pool.staker_accumulator.total_fees[params.token_index], 0n) + staker_fee;
        pool.staker_accumulator.accumulator_f[params.token_index] :=
        unwrap_or(
          pool.staker_accumulator.accumulator_f[params.token_index],
          0n
        ) + staker_fee * Constants.accum_precision / pool.staker_accumulator.total_staked;
      }
      else staker_fee := 0n;

      var info := nip_fees_off_reserves(
        staker_fee,
        ref_fee,
        dev_fee,
        unwrap(pool.tokens_info[params.token_index], Errors.Dex.no_token_info)
      );

      info.reserves := nat_or_error(info.reserves - result.dy, Errors.Dex.low_reserves);
      pool.tokens_info[params.token_index] := info;

      const account_bal = unwrap_or(s.ledger[sender_key], 0n);

      s.ledger[sender_key] := unwrap(is_nat(account_bal - params.shares), Errors.FA2.insufficient_balance);
      s.dev_rewards[token] := unwrap_or(s.dev_rewards[token], 0n) + dev_fee;

      const referral: address = unwrap_or(params.referral, s.default_referral);

      s.referral_rewards[(referral, token)] := unwrap_or(s.referral_rewards[(referral, token)], 0n) + ref_fee;
      s.pools[params.pool_id] := pool with record [
        total_supply  = result.ts;
      ];

      const receiver = unwrap_or(params.receiver, Tezos.sender);

      if result.dy > 0n
        then operations := typed_transfer(
          Tezos.self_address,
          receiver,
          result.dy,
          token
        ) # operations
      else skip;
    }
    | _ -> unreachable(Unit)
    ];
  } with (operations, s)

(* Referral *)
function claim_ref(
  const p               : dex_action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var operations: list(operation) := Constants.no_operations;
    case p of [
    | Claim_referral(params) -> {
      require(params.amount > 0n, Errors.Dex.zero_in);

      const key = (Tezos.sender, params.token);
      const bal = unwrap_or(s.referral_rewards[key], 0n);

      s.referral_rewards[key] := nat_or_error(bal - params.amount, Errors.Dex.balance_overflow);


      operations := typed_transfer(
        Tezos.self_address,
        Tezos.sender,
        params.amount,
        params.token
      ) # operations;
    }
    | _ -> unreachable(Unit)
    ];
  } with (operations, s)

(* QuipuToken Stakers *)
(* Stake *)
function stake(
  const p               : dex_action_t;
  var s                 : storage_t)
                        : return_t is
  case p of [
  | Stake(params) -> update_stake(params, s)
  | _ -> unreachable(Unit)
  ];
