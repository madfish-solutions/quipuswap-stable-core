(* Swap token i to j
 * note: tokens should be approved before the operation
 *)
function swap(
  const p               : dex_action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var operations: list(operation) := Constants.no_operations;
    case p of
    | Swap(params) -> {
      check_deadline(params.deadline);
      const dx = params.amount;
      assert_with_error(dx =/= 0n, Errors.Dex.zero_in);
      const receiver = unwrap_or(params.receiver, Tezos.sender);
      const tokens : tokens_map_t = unwrap(s.tokens[params.pool_id], Errors.Dex.pool_not_listed);
      const tokens_count = Map.size(tokens);
      const i = params.idx_from;
      const j = params.idx_to;
      assert_with_error(i < tokens_count and j < tokens_count, Errors.Dex.wrong_index);
      var pool : pool_t := unwrap(s.pools[params.pool_id], Errors.Dex.pool_not_listed);
      const dy = perform_swap(i, j, dx, pool);
      const after_fees = perform_fee_slice(dy, pool.fee, get_dev_fee(s), pool.staker_accumulator.total_staked);
      const to_stakers = after_fees.staker;
      const referral: address = unwrap_or(params.referral, s.default_referral);
      const token_j = unwrap(tokens[j], Errors.Dex.no_token);
      const ref_key = (referral, token_j);

      s.referral_rewards[ref_key] := unwrap_or(s.referral_rewards[ref_key], 0n) + after_fees.ref;
      s.dev_rewards[token_j] := unwrap_or(s.dev_rewards[token_j], 0n) + after_fees.dev;

      if to_stakers > 0n
      then pool.staker_accumulator.accumulator[j] := unwrap_or(pool.staker_accumulator.accumulator[j], 0n)
        + to_stakers * Constants.accum_precision / pool.staker_accumulator.total_staked;
      else skip;

      assert_with_error(after_fees.dy >= params.min_amount_out, Errors.Dex.high_min_out);

      var token_info_i := unwrap(pool.tokens_info[i], Errors.Dex.no_token_info);
      var token_info_j := nip_off_fees(
        record [
          lp      = after_fees.lp;
          stakers = to_stakers;
          ref     = after_fees.ref;
        ],
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
    | _ -> skip
    end
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
    case p of
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
    | _ -> skip
    end
  } with (operations, s)


(* Remove liquidity (balanced) from the pool by burning shares *)
function divest_liquidity(
  const p               : dex_action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var operations: list(operation) := Constants.no_operations;
    case p of
    | Divest(params) -> {
      check_deadline(params.deadline);
      assert_with_error(s.pools_count > params.pool_id, Errors.Dex.pool_not_listed);
      assert_with_error(params.shares =/= 0n, Errors.Dex.zero_in);

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
          const value = token_info.reserves * params.shares / total_supply;
          assert_with_error(value >= min_amount_out, Errors.Dex.high_min_out);
          assert_with_error(value =/= 0n, Errors.Dex.dust_out);
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
    | _                 -> skip
    end
  } with (operations, s)

(* Custom *)

(* Divest imbalanced *)
function divest_imbalanced(
  const p               : dex_action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var operations: list(operation) := Constants.no_operations;
    case p of
    | Divest_imbalanced(params) -> {
      check_deadline(params.deadline);

      const receiver = unwrap_or(params.receiver, Tezos.sender);
      const key = (Tezos.sender, params.pool_id);
      const share = unwrap_or(s.ledger[key], 0n);

      assert_with_error(params.max_shares =/= 0n, Errors.Dex.zero_in);

      var pool := unwrap(s.pools[params.pool_id], Errors.Dex.pool_not_listed);
      const tokens = unwrap(s.tokens[params.pool_id], Errors.Dex.pool_not_listed);
      const amp : nat =  get_A(
        pool.initial_A_time,
        pool.initial_A,
        pool.future_A_time,
        pool.future_A
      );
      // Initial invariant
      const init_tokens_info = pool.tokens_info;
      const d0 = get_D_mem(init_tokens_info, amp);
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
          accum.tokens_info[value.0] := t_i;
          if value.1 > 0n
          then accum.operations := typed_transfer(
              Tezos.self_address,
              receiver,
              value.1,
              get_token_by_id(value.0, Some(tokens))
            ) # accum.operations;
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

      const d1 = get_D_mem(new_tokens_info, amp);
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
      const d2 = get_D_mem(balanced.tokens_info_without_lp, amp);
      var burn_amount := ceil_div(nat_or_error(d0 - d2, Errors.Math.nat_error) * token_supply, d0);

      assert_with_error(burn_amount =/= 0n, Errors.Dex.zero_burn_amount);

      // burn_amount := burn_amount + 1n; // In case of rounding errors - make it unfavorable for the "attacker"

      assert_with_error(burn_amount <= params.max_shares, Errors.Dex.low_max_shares_in);

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
    | _ -> skip
    end;
  } with (operations, s)

(* Divest one coin *)
function divest_one_coin(
  const p               : dex_action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var operations: list(operation) := Constants.no_operations;
    case p of
    | Divest_one_coin(params) -> {
      check_deadline(params.deadline);

      var pool := unwrap(s.pools[params.pool_id], Errors.Dex.pool_not_listed);
      const sender_key = (Tezos.sender, params.pool_id);
      const token = get_token_by_id(params.token_index, s.tokens[params.pool_id]);

      assert_with_error(params.token_index>=0n and params.token_index < Map.size(pool.tokens_info), Errors.Dex.wrong_index);

      const amp : nat =  get_A(
        pool.initial_A_time,
        pool.initial_A,
        pool.future_A_time,
        pool.future_A
      );
      const dev_fee_v = get_dev_fee(s);
      const result = calc_withdraw_one_coin(amp, params.shares, params.token_index, dev_fee_v, pool);
      const lp_fee = result.dy_fee * pool.fee.lp / sum_all_fee(pool.fee, dev_fee_v);
      const dev_fee = result.dy_fee * dev_fee_v / sum_all_fee(pool.fee, dev_fee_v);
      const ref_fee = result.dy_fee * pool.fee.ref / sum_all_fee(pool.fee, dev_fee_v);
      const staker_fee = result.dy_fee * pool.fee.stakers / sum_all_fee(pool.fee, dev_fee_v);

      assert_with_error(result.dy >= params.min_amount_out, Errors.Dex.high_min_out);

      var info := nip_off_fees(
        record[
          lp = lp_fee;
          stakers = staker_fee;
          ref = ref_fee;
        ],
        dev_fee,
        unwrap(pool.tokens_info[params.token_index], Errors.Dex.no_token_info)
      );

      info.reserves := nat_or_error(info.reserves - result.dy, Errors.Dex.low_reserves);
      pool.tokens_info[params.token_index] := info;

      const account_bal = unwrap_or(s.ledger[sender_key], 0n);

      if pool.staker_accumulator.total_staked > 0n
      then pool.staker_accumulator.accumulator[params.token_index] :=
        unwrap_or(
          pool.staker_accumulator.accumulator[params.token_index],
          0n
        ) + staker_fee * Constants.accum_precision / pool.staker_accumulator.total_staked;
      else skip;

      check_balance(account_bal, params.shares);

      s.ledger[sender_key] := unwrap_or(is_nat(account_bal - params.shares), 0n);
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
        ) # operations;
      else skip;
    }
    | _ -> skip
    end;
  } with (operations, s)

(* Referral *)
function claim_ref(
  const p               : dex_action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var operations: list(operation) := Constants.no_operations;
    case p of
    | Claim_referral(params) -> {

      const key = (Tezos.sender, params.token);
      const bal = unwrap_or(s.referral_rewards[key], 0n);

      s.referral_rewards[key] := nat_or_error(bal - params.amount, Errors.Dex.balance_overflow);

      assert_with_error(params.amount > 0n, Errors.Dex.zero_in);

      operations := typed_transfer(
        Tezos.self_address,
        Tezos.sender,
        params.amount,
        params.token
      ) # operations;
    }
    | _ -> skip
    end;
  } with (operations, s)

(* QuipuToken Stakers *)
(* Stake *)
function stake_staker(
  const p               : dex_action_t;
  var s                 : storage_t)
                        : return_t is
  case p of
  | Stake(params) -> perform_un_stake(Add, params, s)
  | _ -> (Constants.no_operations, s)
  end;

(* Unstake/harvest *)
function unstake_staker(
  const p               : dex_action_t;
  var s                 : storage_t)
                        : return_t is
  case p of
  | Unstake(params) -> perform_un_stake(Remove, params, s)
  | _ -> (Constants.no_operations, s)
  end;
