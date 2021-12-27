(* 0n Initialize exchange after the previous liquidity was drained *)
function initialize_exchange(
  const p               : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var operations: list(operation) := Constants.no_operations;
    case p of
    | Add_pool(params) -> {
      check_admin(s.admin);

      (* Params check *)
      const n_tokens = Set.size(params.input_tokens);

      assert_with_error(
        n_tokens < Constants.max_tokens_count
        and n_tokens >= Constants.min_tokens_count
        and n_tokens = Map.size(params.tokens_info),
        Errors.wrong_tokens_count
      );

      function get_tokens_from_param(
        var result      : tmp_tkns_map_t;
        const value     : token_t)
                        : tmp_tkns_map_t is
        block {
          result.tokens[result.index] := value;
          result.index := result.index + 1n;
        }
        with result;

      const result: tmp_tkns_map_t = Set.fold(get_tokens_from_param, params.input_tokens, default_tmp_tokens);

      const tokens : tkns_map_t = result.tokens;
      const token_bytes : bytes = Bytes.pack(tokens);
      var (pool_i, token_id) := get_pool_info(token_bytes, s.pools_count, s.pool_to_id, s.pools);
      s.tokens[token_id] := tokens;

      assert_with_error(pool_i.total_supply = 0n, Errors.pool_listed);

      if s.pools_count = token_id
      then {
        s.pool_to_id[token_bytes] := token_id;
        s.pools_count := s.pools_count + 1n;
      }
      else skip;

      assert_with_error(
        Constants.max_a >= params.a_constant,
        Errors.a_limit);

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

      const pool = pool_i with record [
        initial_A       = params.a_constant;
        future_A        = params.a_constant;
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
      ], s);
      operations := res.0;
      s := res.1;
    }
    | _                 -> skip
    end
  } with (operations, s)

(* 1n Swap tokens *)
function swap(
  const p               : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var operations: list(operation) := Constants.no_operations;
    case p of
    | Swap(params) -> {
      check_time_expiration(params.time_expiration);
      const dx = params.amount;
      assert_with_error(dx =/= 0n, Errors.zero_in);
      const receiver = unwrap_or(params.receiver, Tezos.sender);
      const tokens : tkns_map_t = unwrap(s.tokens[params.pool_id], Errors.pool_not_listed);
      const tokens_count = Map.size(tokens);
      const i = params.idx_from;
      const j = params.idx_to;
      assert_with_error(i < tokens_count and j < tokens_count, Errors.wrong_index);
      var pool : pool_t := unwrap(s.pools[params.pool_id], Errors.pool_not_listed);
      const dy = perform_swap(i, j, dx, pool);
      const after_fees = perform_fee_slice(dy, pool.fee, pool.staker_accumulator.total_staked);
      const to_stakers = after_fees.stkr;
      const referral: address = unwrap_or(params.referral, s.default_referral);
      const token_j = unwrap(tokens[j], Errors.no_token);
      const ref_key = (referral, token_j);
      s.referral_rewards[ref_key] := unwrap_or(s.referral_rewards[ref_key], 0n) + after_fees.ref;
      s.dev_rewards[token_j] := unwrap_or(s.dev_rewards[token_j], 0n) + after_fees.dev;
      if to_stakers > 0n
      then pool.staker_accumulator.accumulator[j] := unwrap_or(pool.staker_accumulator.accumulator[j], 0n)
        + to_stakers * Constants.acc_precision / pool.staker_accumulator.total_staked;
      else skip;
      assert_with_error(after_fees.dy >= params.min_amount_out, Errors.high_min_out);
      var token_info_i := unwrap(pool.tokens_info[i], Errors.no_token_info);
      token_info_i.reserves := token_info_i.reserves + dx;
      var token_info_j := nip_off_fees(
        record[
          lp_fee = after_fees.lp;
          stakers_fee = to_stakers;
          ref_fee = after_fees.ref;
          dev_fee = after_fees.dev;
        ],
        unwrap(pool.tokens_info[j], Errors.no_token_info)
      );
      token_info_j.reserves := nat_or_error(token_info_j.reserves - after_fees.dy, Errors.no_liquidity);
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
        unwrap(tokens[i], Errors.no_token)
      ) # operations;
    }
    | _ -> skip
    end
  } with (operations, s)

(* 2n Provide liquidity (balanced) to the pool,
note: tokens should be approved before the operation *)
function invest_liquidity(
  const p               : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var operations: list(operation) := Constants.no_operations;
    case p of
    | Invest(params) -> {
        const result = add_liq(record[
          referral= params.referral;
          pool_id = params.pool_id;
          pool    = unwrap(s.pools[params.pool_id], Errors.pool_not_listed);
          inputs  = params.in_amounts;
          min_mint_amount = params.shares;
        ], s);
        operations := result.0;
        s := result.1;
    }
    | _ -> skip
    end
  } with (operations, s)


(* 3n Remove liquidity (balanced) from the pool by burning shares *)
function divest_liquidity(
  const p               : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var operations: list(operation) := Constants.no_operations;
    case p of
    | Divest(params) -> {
        assert_with_error(s.pools_count > params.pool_id, Errors.pool_not_listed);
        assert_with_error(params.shares =/= 0n, Errors.zero_in);
        var   pool          : pool_t := unwrap(s.pools[params.pool_id], Errors.pool_not_listed);
        const total_supply  : nat = pool.total_supply;
        function divest_reserves(
          var acc       : map(tkn_pool_idx_t, tkn_inf_t) * list(operation);
          const entry   : (tkn_pool_idx_t * token_t))
                        : map(tkn_pool_idx_t, tkn_inf_t) * list(operation) is
          block {
            var token_info := unwrap(acc.0[entry.0], Errors.no_token_info);
            const min_amount_out = unwrap_or(params.min_amounts_out[entry.0], 1n);
            const value = token_info.reserves * params.shares / total_supply;
            assert_with_error(value >= min_amount_out, Errors.high_min_out);
            assert_with_error(value =/= 0n, Errors.dust_out);
            token_info.reserves := nat_or_error(token_info.reserves - value, Errors.no_liquidity);
            acc.1 := typed_transfer(
              Tezos.self_address,
              Tezos.sender,
              value,
              entry.1
            ) # acc.1;
            token_info.reserves := nat_or_error(token_info.reserves - value, Errors.low_reserves);
            acc.0[entry.0] := token_info;
          } with acc;
        const tokens : tkns_map_t = unwrap(s.tokens[params.pool_id], Errors.pool_not_listed);
        const res = Map.fold(divest_reserves, tokens, (pool.tokens_info, operations));
        pool.tokens_info := res.0;
        pool.total_supply := nat_or_error(pool.total_supply - params.shares, Errors.low_total_supply);
        const key = (Tezos.sender, params.pool_id);
        const share = unwrap_or(s.ledger[key], 0n);
        s.ledger[key] := nat_or_error(share - params.shares, Errors.insufficient_lp);
        s.pools[params.pool_id] := pool;
        operations := res.1;
      }
    | _                 -> skip
    end
  } with (operations, s)

(* Custom *)

(* Divest imbalanced *)
function divest_imbalanced(
  const p               : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var operations: list(operation) := Constants.no_operations;
    case p of
    | Divest_imbalanced(params) -> {
      const receiver = Tezos.sender;
      const key = (receiver, params.pool_id);
      const share = unwrap_or(s.ledger[key], 0n);
      assert_with_error(params.max_shares =/= 0n, Errors.zero_in);
      var pool := unwrap(s.pools[params.pool_id], Errors.pool_not_listed);
      const tokens = unwrap(s.tokens[params.pool_id], Errors.pool_not_listed);
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
      function min_inputs (
        var acc         : info_ops_acc_t;
        var value       : (tkn_pool_idx_t * nat))
                        : info_ops_acc_t is
        block {
          var t_i := unwrap(
            acc.tokens_info[value.0],
            Errors.no_token_info
          );
          t_i.reserves := nat_or_error(
            t_i.reserves - value.1,
            Errors.low_reserves
          );
          acc.tokens_info[value.0] := t_i;
          if value.1 > 0n
          then acc.operations := typed_transfer(
              Tezos.self_address,
              receiver,
              value.1,
              get_token_by_id(value.0, Some(tokens))
            ) # acc.operations;
          else skip;
        } with acc;
      const result = Map.fold(min_inputs, params.amounts_out, record [
          tokens_info = init_tokens_info;
          operations = operations;
        ]);
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
        unwrap_or(params.referral, s.default_referral),
        record[
          dev_rewards = s.dev_rewards;
          referral_rewards = s.referral_rewards;
          staker_accumulator = pool.staker_accumulator;
          tokens_info = new_tokens_info;
          tokens_info_without_lp = new_tokens_info;
        ]);
      const d2 = get_D_mem(balanced.tokens_info_without_lp, amp);
      var burn_amount := nat_or_error(d0 - d2, "d2>d0") * token_supply / d0;
      assert_with_error(burn_amount =/= 0n, Errors.zero_burn_amount);
      burn_amount := burn_amount + 1n; // In case of rounding errors - make it unfavorable for the "attacker"
      assert_with_error(burn_amount <= params.max_shares, Errors.low_max_shares_in);
      const new_shares = nat_or_error(share - burn_amount, Errors.insufficient_lp);
      patch s with record [
        dev_rewards = balanced.dev_rewards;
        referral_rewards = balanced.referral_rewards;
      ];
      patch pool with record [
        staker_accumulator = balanced.staker_accumulator;
        tokens_info = balanced.tokens_info;
        total_supply = nat_or_error(pool.total_supply - burn_amount, Errors.nat_error);
      ];
      s.pools[params.pool_id] := pool;
      s.ledger[(Tezos.sender, params.pool_id)] := new_shares;
    }
    | _ -> skip
    end;
  } with (operations, s)

(* Divest one coin *)
function divest_one_coin(
  const p               : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var operations: list(operation) := Constants.no_operations;
    case p of
    | Divest_one_coin(params) -> {
      var pool := unwrap(s.pools[params.pool_id], Errors.pool_not_listed);
      const sender_key = (Tezos.sender, params.pool_id);
      const token = get_token_by_id(params.token_index, s.tokens[params.pool_id]);
      assert_with_error(params.token_index>=0n and params.token_index < Map.size(pool.tokens_info), Errors.wrong_index);
      const amp : nat =  get_A(
        pool.initial_A_time,
        pool.initial_A,
        pool.future_A_time,
        pool.future_A
      );
      const result = calc_withdraw_one_coin(amp, params.shares, params.token_index, pool);
      const lp_fee = result.dy_fee * pool.fee.lp_fee / sum_all_fee(pool.fee);
      const dev_fee = result.dy_fee * pool.fee.dev_fee / sum_all_fee(pool.fee);
      const ref_fee = result.dy_fee * pool.fee.ref_fee / sum_all_fee(pool.fee);
      const stkr_fee = result.dy_fee * pool.fee.stakers_fee / sum_all_fee(pool.fee);
      assert_with_error(result.dy >= params.min_amount_out, Errors.high_min_out);
      var info := nip_off_fees(
        record[
          lp_fee = lp_fee;
          stakers_fee = stkr_fee;
          ref_fee = ref_fee;
          dev_fee = dev_fee;
        ],
        unwrap(pool.tokens_info[params.token_index], Errors.no_token_info)
      );
      info.reserves := nat_or_error(info.reserves - result.dy, Errors.low_reserves);
      pool.tokens_info[params.token_index] := info;
      const acc_bal = unwrap_or(s.ledger[sender_key], 0n);
      check_balance(acc_bal, params.shares);
      const new_acc_bal = acc_bal - params.shares;
      if pool.staker_accumulator.total_staked > 0n
      then pool.staker_accumulator.accumulator[params.token_index] :=
        unwrap_or(
          pool.staker_accumulator.accumulator[params.token_index],
          0n
        ) + stkr_fee * Constants.acc_precision / pool.staker_accumulator.total_staked;
      else skip;
      s.ledger[sender_key] := unwrap_or(is_nat(new_acc_bal), 0n); // already checked for nat at check_balance
      s.dev_rewards[token] := unwrap_or(s.dev_rewards[token], 0n) + dev_fee;
      const referral: address = unwrap_or(params.referral, s.default_referral);
      s.referral_rewards[(referral, token)] := unwrap_or(s.referral_rewards[(referral, token)], 0n) + ref_fee;
      s.pools[params.pool_id] := pool with record [
          total_supply  = result.ts;
        ];
      if result.dy > 0n
        then operations := typed_transfer(
          Tezos.self_address,
          Tezos.sender,
          result.dy,
          get_token_by_id(params.token_index, s.tokens[params.pool_id])
        ) # operations;
      else skip;
    }
    | _ -> skip
    end;
  } with (operations, s)

(* DEX admin methods *)

(* 10n ramping A constant *)
function ramp_A(
  const p               : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var operations: list(operation) := Constants.no_operations;
    case p of
    | Ramp_A(params) -> {
        check_admin(s.admin);
        var pool : pool_t := unwrap(s.pools[params.pool_id], Errors.pool_not_listed);
        assert(Tezos.now >= pool.initial_A_time + Constants.min_ramp_time);
        assert(params.future_time >= Tezos.now + Constants.min_ramp_time); //  # dev: insufficient time
        const initial_A: nat = get_A(
          pool.initial_A_time,
          pool.initial_A,
          pool.future_A_time,
          pool.future_A
        );
        const future_A_p: nat = params.future_A * Constants.a_precision;
        assert((params.future_A > 0n) and (params.future_A < Constants.max_a));
        if future_A_p < initial_A
        then assert(future_A_p * Constants.max_a_change >= initial_A)
        else assert(future_A_p <= initial_A * Constants.max_a_change);
        pool.initial_A := initial_A;
        pool.future_A := future_A_p;
        pool.initial_A_time := Tezos.now;
        pool.future_A_time := params.future_time;
        s.pools[params.pool_id] := pool;
      }
    | _ -> skip
    end
  } with (operations, s)

(* 11n stop ramping A constant *)
function stop_ramp_A(
  const p               : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var operations: list(operation) := Constants.no_operations;
    case p of
    | Stop_ramp_A(pool_id) -> {
      check_admin(s.admin);
      var pool : pool_t := unwrap(s.pools[pool_id], Errors.pool_not_listed);
      const current_A: nat = get_A(
        pool.initial_A_time,
        pool.initial_A,
        pool.future_A_time,
        pool.future_A
      );
      pool.initial_A := current_A;
      pool.future_A := current_A;
      pool.initial_A_time := Tezos.now;
      pool.future_A_time := Tezos.now;
      s.pools[pool_id] := pool;
      }
    | _ -> skip
    end
  } with (operations, s)

(* 14n updates fees percents *)
function set_fees(
  const p               : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var operations: list(operation) := Constants.no_operations;
    case p of
    | Set_fees(params) -> {
      check_admin(s.admin);
      var pool := unwrap(s.pools[params.pool_id], Errors.pool_not_listed);
      pool.fee := params.fee;
      s.pools[params.pool_id] := pool;
    }
    | _ -> skip
    end
  } with (operations, s)

(* 16n set default referral *)
function set_default_referral(
  const p               : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var operations: list(operation) := Constants.no_operations;
    case p of
    | Set_default_referral(params) -> {
      check_admin(s.admin);
      s.default_referral := params;
    }
    | _ -> skip
    end
  } with (operations, s)

(* Claimers of rewards *)

(* 6n Developer *)
function claim_dev(
  const p               : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var operations: list(operation) := Constants.no_operations;
    const receiver = s.dev_address;
    case p of
    | Claim_developer(params) -> {
      check_admin_or_dev(s.admin, s.dev_address);
      const bal = unwrap_or(s.dev_rewards[params.token], 0n);
      s.dev_rewards[params.token] := nat_or_error(bal-params.amount, "Amount greater than balance");
      assert_with_error(params.amount > 0n, Errors.zero_in);
      operations := typed_transfer(
        Tezos.self_address,
        receiver,
        params.amount,
        params.token
      ) # operations;
    }
    | _ -> skip
    end;
  } with (operations, s)

(* 7n Referral *)
function claim_ref(
  const p               : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var operations: list(operation) := Constants.no_operations;
    const receiver = Tezos.sender;
    case p of
    | Claim_referral(params) -> {
      const key = (receiver, params.token);
      const bal = unwrap(s.referral_rewards[key], "ref not found");
      s.referral_rewards[key] := nat_or_error(bal-params.amount, "Amount greater than balance");
      assert_with_error(params.amount > 0n, Errors.zero_in);
      operations := typed_transfer(
        Tezos.self_address,
        receiver,
        params.amount,
        params.token
      ) # operations;
    }
    | _ -> skip
    end;
  } with (operations, s)

(* QuipuToken Stakers *)
(* 15n Stake *)
function stake_staker(
  const p               : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var operations: list(operation) := Constants.no_operations;
    case p of
    | Stake(params) -> {
      if params.amount > 0n
      then {
        const staker_key = (Tezos.sender, params.pool_id);
        var staker_acc := unwrap_or(s.stakers_balance[staker_key], record[
          balance = 0n;
          earnings = (map[] : map(nat , account_rwrd_t))
        ]);
        var pool := unwrap(s.pools[params.pool_id], Errors.pool_not_listed);
        const (harvested_acc, upd_ops) = harvest_staker_rewards(
          staker_acc,
          operations,
          pool.staker_accumulator,
          s.tokens[params.pool_id]
        );
        const after_updates = update_former_and_transfer(
          Add,
          params.amount,
          harvested_acc,
          pool.staker_accumulator,
          s.quipu_token,
          upd_ops
          );
        s.pools[params.pool_id] := pool with record[
          staker_accumulator = after_updates.staker_accumulator
        ];
        s.stakers_balance[staker_key] := after_updates.account;
        operations := after_updates.ops;
      }
      else failwith(Errors.zero_in);
    }
    | _ -> skip
    end;
  } with (operations, s)

(* 16n Unstake/harvest *)
function unstake_staker(
  const p               : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var operations: list(operation) := Constants.no_operations;
    const receiver = Tezos.sender;
    case p of
    | Unstake(params) -> {
      const staker_key = (receiver, params.pool_id);
      var staker_acc := unwrap_or(
        s.stakers_balance[staker_key],
        record [
          balance = 0n;
          earnings = (map[] : map(nat , account_rwrd_t))
        ]
      );
      var pool := unwrap(s.pools[params.pool_id], Errors.pool_not_listed);
      const harvest = harvest_staker_rewards(staker_acc, operations, pool.staker_accumulator, s.tokens[params.pool_id]);
      staker_acc := harvest.0;
      operations := harvest.1;
      if params.amount > 0n
      then {
        const after_updates = update_former_and_transfer(
          Remove,
          params.amount,
          staker_acc,
          pool.staker_accumulator,
          s.quipu_token,
          operations
          );
        staker_acc := after_updates.account;
        pool.staker_accumulator := after_updates.staker_accumulator;
        operations := after_updates.ops;
      }
      else skip;
      s.pools[params.pool_id] := pool;
      s.stakers_balance[staker_key] := staker_acc;
    }
    | _ -> skip
    end;
  } with (operations, s)
