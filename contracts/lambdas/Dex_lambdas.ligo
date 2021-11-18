(* 0n Initialize exchange after the previous liquidity was drained *)
function initialize_exchange(
  const p               : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    var operations: list(operation) := CONSTANTS.no_operations;
    case p of
    | AddPair(params) -> {
      is_admin(s.admin);

      (* Params check *)
      const n_tokens = Set.size(params.input_tokens);

      assert_with_error(
        n_tokens < CONSTANTS.max_tokens_count
        and n_tokens >= CONSTANTS.min_tokens_count
        and n_tokens = Map.size(params.tokens_info), ERRORS.wrong_tokens_count);

      function get_tokens_from_param(
        var result    : tmp_tokens_type;
        const value   : token_type)
                      : tmp_tokens_type is
        block {
          result.tokens[result.index] := value;
          result.index := result.index + 1n;
        }
        with result;

      const result: tmp_tokens_type = Set.fold(
        get_tokens_from_param,
        params.input_tokens,
        default_tmp_tokens);

      const tokens : tokens_type = result.tokens;
      const token_bytes : bytes = Bytes.pack(tokens);
      var (pair_i, token_id) := get_pair_info(token_bytes,
        s.pools_count,
        s.pool_to_id,
        s.pools);
      s.tokens[token_id] := tokens;

      assert_with_error(pair_i.total_supply = 0n, ERRORS.pair_listed);

      if s.pools_count = token_id
      then {
        s.pool_to_id[token_bytes] := token_id;
        s.pools_count := s.pools_count + 1n;
      }
      else skip;

      assert_with_error(
        CONSTANTS.max_a >= params.a_constant,
        ERRORS.a_limit);

      function map_res_to_zero(
        const _key  : token_pool_index;
        const value : token_info_type)
                    : token_info_type is
        value with record [
          reserves = 0n;
          virtual_reserves = 0n;
        ];

      patch pair_i with record [
        initial_A = params.a_constant;
        future_A = params.a_constant;
        initial_A_time = Tezos.now;
        future_A_time = Tezos.now;
        tokens_info = Map.map(map_res_to_zero, params.tokens_info);
      ];

      function get_inputs(
        const _key        : token_pool_index;
        var token_info    : token_info_type)
                          : nat is
        block {
          assert_with_error(
            token_info.reserves = token_info.virtual_reserves,
            ERRORS.wrong_tokens_in);
        } with token_info.reserves;

      const res = add_liq(record [
        referral = (None: option(address));
        pair_id = token_id;
        pair    = pair_i;
        inputs  = Map.map(get_inputs, params.tokens_info);
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
  const p               : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    var operations: list(operation) := CONSTANTS.no_operations;
    case p of
    | Swap(params) -> {
        const dx = params.amount;
        assert_with_error(dx =/= 0n, ERRORS.zero_in);

        const tokens : tokens_type = unwrap(s.tokens[params.pair_id], ERRORS.pair_not_listed);
        const tokens_count = Map.size(tokens);
        const i = params.idx_from;
        const j = params.idx_to;
        assert_with_error(i < tokens_count or j < tokens_count, ERRORS.wrong_index);

        var pair : pair_type := unwrap(s.pools[params.pair_id], ERRORS.pair_not_listed);
        var dy := preform_swap(i, j, dx, pair);
        const after_fees = perform_fee_slice(dy, pair.fee, pair.staker_accumulator.total_staked);
        dy := after_fees.0;

        const to_stakers = after_fees.3;

        const referral: address = unwrap_or(params.referral, s.default_referral);
        const token_j = unwrap(tokens[j], ERRORS.no_token);
        s.referral_rewards[(referral, token_j)] :=
          unwrap_or(s.referral_rewards[(referral, token_j)], 0n) +
          after_fees.1;
        s.dev_rewards[token_j] := unwrap_or(s.dev_rewards[token_j], 0n) + after_fees.2;

        if to_stakers > 0n
         then pair.staker_accumulator.accumulator[j] := unwrap_or(pair.staker_accumulator.accumulator[j], 0n)
          + to_stakers * CONSTANTS.stkr_acc_precision / pair.staker_accumulator.total_staked;
        else skip;

        assert_with_error(dy >= params.min_amount_out, ERRORS.high_min_out);

        var token_info_i := unwrap(pair.tokens_info[i], ERRORS.no_token_info);
        patch token_info_i with record [
          virtual_reserves = token_info_i.virtual_reserves + dx;
          reserves = token_info_i.reserves + dx;
        ];
        var token_info_j := unwrap(pair.tokens_info[j], ERRORS.no_token_info);
        patch token_info_j with record [
          virtual_reserves = nat_or_error(token_info_j.virtual_reserves - dy, ERRORS.low_virtual_reserves);
          reserves = nat_or_error(token_info_j.reserves - dy, ERRORS.low_reserves);
        ];

        pair.tokens_info[i] := token_info_i;
        pair.tokens_info[j] := token_info_j;
        s.pools[params.pair_id] := pair;

        operations := typed_transfer(
          Tezos.self_address,
          unwrap_or(params.receiver, Tezos.sender),
          dy,
          token_j
        ) # operations;
        operations := typed_transfer(
          Tezos.sender,
          Tezos.self_address,
          dx,
          unwrap(tokens[i], ERRORS.no_token)
        ) # operations;
    }
    | _ -> skip
    end
  } with (operations, s)

(* 2n Provide liquidity (balanced) to the pool,
note: tokens should be approved before the operation *)
function invest_liquidity(
  const p               : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    var operations: list(operation) := CONSTANTS.no_operations;
    case p of
    | Invest(params) -> {
        const result = add_liq(record[
          referral= params.referral;
          pair_id = params.pair_id;
          pair    = unwrap(s.pools[params.pair_id], ERRORS.pair_not_listed);
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
  const p               : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    var operations: list(operation) := CONSTANTS.no_operations;
    case p of
    | Divest(params) -> {
        assert_with_error(s.pools_count > params.pair_id, ERRORS.pair_not_listed);
        assert_with_error(params.shares =/= 0n, ERRORS.zero_in);

        var   pair          : pair_type := unwrap(s.pools[params.pair_id], ERRORS.pair_not_listed);
        const total_supply  : nat = pair.total_supply;

        function divest_reserves(
          var acc: (
            map(token_pool_index, token_info_type) *
            list(operation)
          );
          const entry: (token_pool_index * token_type)
        ) : (
            map(token_pool_index, token_info_type) *
            list(operation)
          ) is
          block {
            var token_info := unwrap(acc.0[entry.0], ERRORS.no_token_info);

            const min_amount_out = unwrap_or(params.min_amounts_out[entry.0], 1n);
            const value = token_info.virtual_reserves * params.shares / total_supply;
            token_info.virtual_reserves := nat_or_error(token_info.virtual_reserves - value, ERRORS.low_virtual_reserves);

            assert_with_error(value >= min_amount_out, ERRORS.high_min_out);
            assert_with_error(value =/= 0n, ERRORS.dust_out);

            if value > token_info.reserves
              then skip //TODO: add request to proxy;
            else {
              acc.1 := typed_transfer(
                Tezos.sender,
                Tezos.self_address,
                value,
                entry.1
              ) # acc.1;
              token_info.reserves := nat_or_error(token_info.reserves - value, ERRORS.low_reserves);
            };
            acc.0[entry.0] := token_info;
          } with acc;

        const tokens : tokens_type = unwrap(s.tokens[params.pair_id], ERRORS.pair_not_listed);
        const res = Map.fold(divest_reserves, tokens, (pair.tokens_info, operations));
        pair.tokens_info := res.0;
        pair.total_supply := nat_or_error(pair.total_supply - params.shares, ERRORS.low_total_supply);
        const share : nat = unwrap_or(s.ledger[(Tezos.sender, params.pair_id)], 0n);
        s.ledger[(Tezos.sender, params.pair_id)] := nat_or_error(share - params.shares, ERRORS.insufficient_lp);
        s.pools[params.pair_id] := pair;
        operations := res.1;
      }
    | _                 -> skip
    end
  } with (operations, s)

(* Custom *)

(* Divest imbalanced *)
function divest_imbalanced(
  const p               : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    var operations: list(operation) := CONSTANTS.no_operations;
    case p of
    | DivestImbalanced(params) -> {
        const receiver = Tezos.sender;
        const share         : nat = unwrap_or(s.ledger[(Tezos.sender, params.pair_id)], 0n);
        assert_with_error(params.max_shares =/= 0n, ERRORS.zero_in);
        var pair := unwrap(s.pools[params.pair_id], ERRORS.pair_not_listed);
        const fees = pair.fee;
        const tokens = unwrap(s.tokens[params.pair_id], ERRORS.pair_not_listed);
        const amp : nat =  _A(
          pair.initial_A_time,
          pair.initial_A,
          pair.future_A_time,
          pair.future_A
        );
        function map_res(const _key: token_pool_index; const value: token_info_type): nat is value.virtual_reserves;
        const init_reserves = Map.map(map_res, pair.tokens_info);
        const tokens_count = Map.size(pair.tokens_info);
        // Initial invariant
        const d0 = _get_D_mem(pair.tokens_info, amp, pair.total_supply);
        var token_supply := pair.total_supply;
        function min_inputs (const key : token_pool_index; var value : token_info_type) : token_info_type is
          block{
            value.virtual_reserves :=
              nat_or_error(value.virtual_reserves - unwrap_or(params.amounts_out[key], 0n),
                ERRORS.low_virtual_reserves);
            value.reserves :=
              nat_or_error(value.reserves - unwrap_or(params.amounts_out[key], 0n),
                ERRORS.low_reserves);
          } with value;
        var new_infos := Map.map(min_inputs, pair.tokens_info);

        const d1 = _get_D_mem(new_infos, amp, pair.total_supply);

        function balance_this_divest(
          var acc     : record[
            new_reserves : map(token_pool_index, nat);
            new_balances : map(token_pool_index, nat);
            stkr         : staker_acc_type;
            dev          : map(token_type, nat)
          ];
          const entry : token_pool_index * token_info_type
          )           : record [
            new_reserves : map(token_pool_index, nat);
            new_balances : map(token_pool_index, nat);
            stkr         : staker_acc_type;
            dev          : map(token_type, nat)
          ] is
        block {
          const new_bal = entry.1.virtual_reserves;
          const old_bal = unwrap(init_reserves[entry.0], ERRORS.low_reserves);
          const ideal_bal = d1 * old_bal / d0;
          const diff = abs(ideal_bal - new_bal); // |ideal_bal - new_bal|
          const to_dev = diff * divide_fee_for_balance(fees.dev_fee, tokens_count) / CONSTANTS.fee_denominator;
          var to_lp := diff * divide_fee_for_balance(fees.lp_fee, tokens_count) / CONSTANTS.fee_denominator;
          var to_stkr := 0n;
          if acc.stkr.total_staked =/= 0n
            then to_stkr := diff * divide_fee_for_balance(fees.stakers_fee, tokens_count) / CONSTANTS.fee_denominator
          else to_lp := to_lp + diff * divide_fee_for_balance(fees.stakers_fee, tokens_count) / CONSTANTS.fee_denominator;
          const token = get_token_by_id(entry.0, Some(tokens));
          acc.dev[token] := unwrap_or(acc.dev[token], 0n) + to_dev;
          if to_stkr > 0n
          then acc.stkr.accumulator[entry.0] := unwrap_or(acc.stkr.accumulator[entry.0], 0n)
            + to_stkr * CONSTANTS.stkr_acc_precision / acc.stkr.total_staked;
          else skip;
          acc.new_reserves[entry.0] := nat_or_error(new_bal - to_stkr - to_dev, "Not enough balance");
          acc.new_balances[entry.0] := nat_or_error(new_bal - to_stkr - to_lp - to_dev, "Not enough balance");
        } with acc;
        const result = Map.fold(balance_this_divest, new_infos, record [
          new_reserves = (map []: map(token_pool_index, nat));
          new_balances = (map []: map(token_pool_index, nat));
          stkr = pair.staker_accumulator;
          dev = (map []: map(token_type, nat));
        ]);
        pair.staker_accumulator := result.stkr;
        function dev_iterated (var acc: big_map(token_type, nat); const i : token_type * nat) : big_map(token_type, nat) is
        block{
          acc[i.0] := unwrap_or(acc[i.0], 0n) + i.1;
        } with acc;
        s.dev_rewards := Map.fold(dev_iterated, result.dev, s.dev_rewards);
        function map_balances (const key : token_pool_index; var value : token_info_type) : token_info_type is
          block{
            value.virtual_reserves := case result.new_balances[key] of
                Some(res) -> nat_or_error(value.virtual_reserves - res, "Not enough reserves")
              | None -> value.virtual_reserves
              end;
            value.reserves := case result.new_balances[key] of
                Some(res) -> nat_or_error(value.reserves - res, "Not enough reserves")
              | None -> value.reserves
              end;
          } with value;
        new_infos := Map.map(map_balances, pair.tokens_info);
        const d2 = _get_D_mem(new_infos, amp, pair.total_supply);
        var burn_amount := nat_or_error(d0-d2, "d2>d0") * token_supply / d0;
        if burn_amount = 0n
          then failwith(ERRORS.zero_burn_amount)
        else skip;
        burn_amount := burn_amount + 1n; // In case of rounding errors - make it unfavorable for the "attacker"
        if burn_amount <= params.max_shares
          then failwith(ERRORS.insufficient_lp)
        else skip;
        const new_shares = nat_or_error(share - burn_amount, ERRORS.insufficient_lp);
        const tok_info = pair.tokens_info;
        function add_ops(
          var acc     : list(operation);
          const entry : token_pool_index * nat
          )           : list(operation) is
          block {
            var tok_info := unwrap(tok_info[entry.0], ERRORS.no_token_info);
            if tok_info.reserves >= entry.1
            then {
              acc := typed_transfer(
                Tezos.self_address,
                receiver,
                entry.1,
                get_token_by_id(entry.0, Some(tokens))
              ) # acc;
            }
            else skip; // TODO: proxy claim
          } with acc;
        pair := pair with record[tokens_info=new_infos];
        pair.total_supply := nat_or_error(pair.total_supply - burn_amount, "total_supply<burn_amount");
        s.pools[params.pair_id] := pair;
        s.ledger[(receiver, params.pair_id)] := new_shares;
        operations := Map.fold(add_ops, params.amounts_out, operations);
    }
    | _ -> skip
    end;
  } with (operations, s)

(* Divest one coin *)
function divest_one_coin(
  const p               : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    var operations: list(operation) := CONSTANTS.no_operations;
    case p of
    | DivestOneCoin(params) -> {
      var pool := unwrap(s.pools[params.pair_id], ERRORS.pair_not_listed);
      const sender_key = (Tezos.sender, params.pair_id);
      const token = get_token_by_id(params.token_index, s.tokens[params.pair_id]);
      assert_with_error(params.token_index>=0n and params.token_index < Map.size(pool.tokens_info), "Wrong index");
      const amp : nat =  _A(
        pool.initial_A_time,
        pool.initial_A,
        pool.future_A_time,
        pool.future_A
      );
      const result = _calc_withdraw_one_coin(amp, params.shares, params.token_index, pool);

      const dev_fee = result.dy_fee * pool.fee.dev_fee / sum_all_fee(pool.fee);
      var stkr_fee := 0n;
      if pool.staker_accumulator.total_staked >= 0n
        then stkr_fee := result.dy_fee * pool.fee.stakers_fee / sum_all_fee(pool.fee)
      else skip;

      assert_with_error(result.dy >= params.min_amount_out, "Not enough coins removed");

      var info := unwrap(pool.tokens_info[params.token_index], ERRORS.no_token_info);

      info.virtual_reserves := nat_or_error(info.virtual_reserves - (result.dy + dev_fee + stkr_fee), "Not enough reserves");
      info.reserves := nat_or_error(info.reserves - (result.dy + dev_fee + stkr_fee), "Not enough reserves");

      pool.tokens_info[params.token_index] := info;

      const new_acc_bal = unwrap_or(s.ledger[sender_key], 0n) - params.shares;
      pool.staker_accumulator.accumulator[params.token_index] := unwrap_or(pool.staker_accumulator.accumulator[params.token_index], 0n)
        + stkr_fee * CONSTANTS.stkr_acc_precision / pool.staker_accumulator.total_staked;
      s.ledger[sender_key] := nat_or_error(new_acc_bal, "Not enough balance");
      s.dev_rewards[token] := unwrap_or(s.dev_rewards[token], 0n) + dev_fee;
      s.pools[params.pair_id] := pool with record [
          total_supply  = result.ts;
        ];
      operations := typed_transfer(
          Tezos.self_address,
          Tezos.sender,
          result.dy,
          get_token_by_id(params.token_index, s.tokens[params.pair_id])
        ) # operations;
    }
    | _ -> skip
    end;
  } with (operations, s)

(* DEX admin methods *)

(* 10n ramping A constant *)
function ramp_A(
  const p               : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    var operations: list(operation) := CONSTANTS.no_operations;
    case p of
    | RampA(params) -> {
        is_admin(s.admin);
        var pair : pair_type := unwrap(s.pools[params.pair_id], ERRORS.pair_not_listed);
        assert(Tezos.now >= pair.initial_A_time + CONSTANTS.min_ramp_time);
        assert(params.future_time >= Tezos.now + CONSTANTS.min_ramp_time); //  # dev: insufficient time

        const initial_A: nat = _A(
          pair.initial_A_time,
          pair.initial_A,
          pair.future_A_time,
          pair.future_A
        );
        const future_A_p: nat = params.future_A * CONSTANTS.a_precision;

        assert((params.future_A > 0n) and (params.future_A < CONSTANTS.max_a));
        if future_A_p < initial_A
          then assert(future_A_p * CONSTANTS.max_a_change >= initial_A)
        else assert(future_A_p <= initial_A * CONSTANTS.max_a_change);

        pair.initial_A := initial_A;
        pair.future_A := future_A_p;
        pair.initial_A_time := Tezos.now;
        pair.future_A_time := params.future_time;
        s.pools[params.pair_id] := pair;
      }
    | _ -> skip
    end
  } with (operations, s)

(* 11n stop ramping A constant *)
function stop_ramp_A(
  const p               : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    var operations: list(operation) := CONSTANTS.no_operations;
    case p of
    | StopRampA(pair_id) -> {
      is_admin(s.admin);
      var pair : pair_type := unwrap(s.pools[pair_id], ERRORS.pair_not_listed);
      const current_A: nat = _A(
        pair.initial_A_time,
        pair.initial_A,
        pair.future_A_time,
        pair.future_A
      );
      pair.initial_A := current_A;
      pair.future_A := current_A;
      pair.initial_A_time := Tezos.now;
      pair.future_A_time := Tezos.now;
      s.pools[pair_id] := pair;
      }
    | _ -> skip
    end
  } with (operations, s)

(* 12n set or remove proxy *)
function set_proxy(
  const p               : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    var operations: list(operation) := CONSTANTS.no_operations;
    case p of
    | SetProxy(params) -> {
      is_admin(s.admin);
      var pair : pair_type := unwrap(s.pools[params.pair_id], ERRORS.pair_not_listed);
      // TODO: all the rewards must be claimed from the contract before in the same call
      pair.proxy_contract := params.proxy;
      s.pools[params.pair_id] := pair;
      }
    | _ -> skip
    end
  } with (operations, s)

(* 13n updates limits percent for proxy *)
function update_proxy_limits(
  const p               : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    var operations: list(operation) := CONSTANTS.no_operations;
    case p of
    | UpdateProxyLimits(params) -> {
      is_admin(s.admin);
      var pair : pair_type := unwrap(s.pools[params.pair_id], ERRORS.pair_not_listed);
      var token_info := unwrap(pair.tokens_info[params.token_index], "no such R index");

      token_info.proxy_limit := params.limit;
      pair.tokens_info[params.token_index] := token_info;

      s.pools[params.pair_id] := pair;
      (* TODO: claim rewards and old staked values *)
      }
    | _ -> skip
    end
  } with (operations, s)

(* 14n updates fees percents *)
function set_fees(
  const p               : action_type;
  var s                 : storage_type
  )                     : return_type is
  block {
    var operations: list(operation) := CONSTANTS.no_operations;
    case p of
    | SetFees(params) -> {
      is_admin(s.admin);
      var pair := unwrap(s.pools[params.pool_id], ERRORS.pair_not_listed);
      pair.fee := params.fee;
      s.pools[params.pool_id] := pair;
      }
    | _ -> skip
    end
  } with (operations, s)

(* Claimers of rewards *)

(* 6n Developer *)
function claim_dev(
  const p : action_type;
  var s   : storage_type
  )       : return_type is
  block {
    var operations: list(operation) := CONSTANTS.no_operations;
    const receiver = s.dev_address;
    case p of
      | ClaimDeveloper(params) -> {
        is_admin_or_dev(s.admin, s.dev_address);
        const bal = unwrap_or(s.dev_rewards[params.token], 0n);
        s.dev_rewards[params.token] := nat_or_error(bal-params.amount, "Amount greater than balance");
        if params.amount > 0n
          then {
            operations := typed_transfer(
              Tezos.self_address,
              receiver,
              params.amount,
              params.token
            ) # operations;
          }
        else failwith("Amount is 0")
      }
      | _ -> skip
      end;
  } with (operations, s)

(* 7n Referral *)
function claim_ref(
  const p : action_type;
  var s   : storage_type
  )       : return_type is
  block {
    var operations: list(operation) := CONSTANTS.no_operations;
    const receiver = Tezos.sender;
    case p of
      | ClaimReferral(params) -> {
        const key = (receiver, params.token);
        const bal = unwrap(s.referral_rewards[key], "ref not found");
        s.referral_rewards[key] := nat_or_error(bal-params.amount, "Amount greater than balance");
        if params.amount > 0n
          then {
            operations := typed_transfer(
              Tezos.self_address,
              receiver,
              params.amount,
              params.token
            ) # operations;
          }
        else failwith("Amount is 0")
      }
      | _ -> skip
    end;
  } with (operations, s)

(* 8n QuipuToken Stakers *)
function claim_staker(
  const p : action_type;
  var s   : storage_type
  )       : return_type is
  block {
    var operations: list(operation) := CONSTANTS.no_operations;
    const receiver = Tezos.sender;
    case p of
      | ClaimStaking(params) -> {
          const staker_key = (receiver, params.pool_id);
          var staker_acc := unwrap_or(s.stakers_balance[staker_key], record[
            balance = 0n;
            earnings = (map[] : map(nat , acc_reward_type))
          ]);
          var staker_rew_data: acc_reward_type := unwrap_or(staker_acc.earnings[params.token_index], record [
            reward  = 0n;
            former  = 0n;
          ]);
          const bal = staker_rew_data.reward;
          const new_balance = nat_or_error(bal - params.amount, "Amount greater than balance");
          if params.amount > 0n
            then {
              operations := typed_transfer(
                Tezos.self_address,
                receiver,
                params.amount,
                get_token_by_id(params.token_index, s.tokens[params.pool_id])
              ) # operations;
              staker_rew_data.former := 0n;
              staker_rew_data.reward := new_balance;
            }
          else failwith("Balance is 0");
          staker_acc.earnings[params.token_index] := staker_rew_data;
          s.stakers_balance[staker_key] := staker_acc;
        }
        | _ -> skip
        end;
  } with (operations, s)

(* 9n LP providers *)
function claim_provider(
  const p : action_type;
  var s   : storage_type
  )       : return_type is
  block {
    var operations: list(operation) := CONSTANTS.no_operations;
    const receiver = Tezos.sender;
    case p of
      | ClaimLProvider(params) -> {
        const acc_key = (receiver, params.pool_id);
        var acc_data := get_account_data(acc_key, s.account_data);
        var acc_intrst_data: acc_reward_type := unwrap_or(acc_data.earned_interest[params.token],
          record [
            reward  = 0n;
            former  = 0n;
          ]);
        const bal = acc_intrst_data.reward;
        const new_balance = nat_or_error(bal - params.amount, "Amount greater than balance");
        if params.amount > 0n
          then {
            operations := typed_transfer(
              Tezos.self_address,
              receiver,
              params.amount,
              params.token
            ) # operations;
            acc_intrst_data.former := 0n;
            acc_intrst_data.reward := new_balance;
          }
        else failwith("Balance is 0");
        acc_data.earned_interest[params.token] := acc_intrst_data;
        s.account_data[acc_key] := acc_data;
      }
      | _ -> skip
    end;
  } with (operations, s)