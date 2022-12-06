function xp_mem(
  const tokens_info     : map(token_pool_idx_t, token_info_t))
                        : map(token_pool_idx_t, nat) is
  block {
    function count_result(
      const _key        : nat;
      var token_info    : token_info_t)
                        : nat is
      (token_info.rate_f * token_info.reserves) / Constants.precision;
  } with Map.map(count_result, tokens_info);

function xp(
  const s               : pool_t)
                        : map(token_pool_idx_t, nat) is
  xp_mem(s.tokens_info);

(* Handle ramping A up or down *)
function get_A(
  const t0              : timestamp;
  const a0              : nat;
  const t1              : timestamp;
  const a1              : nat)
                        : nat is
  block {
    var a := a1;
    if Tezos.get_now() < t1
    then {
      const t_num = nat_or_error(Tezos.get_now() - t0, Errors.Dex.timestamp_error);
      const t_den = nat_or_error(t1 - t0, Errors.Dex.timestamp_error);
      const diff = abs(a1 - a0);
      const value = diff * t_num / t_den;
      a := if a1 > a0
        then     a0 + value
        else abs(a0 - value);
        (* always a0 > (a0-a1) * (now-t0)/(t1-t0) if t1 > now && a0 > a1 *)
    }
    else skip;
  } with a

(*
  D invariant calculation in non-overflowing integer operations iteratively

  A * sum(x_i) * n**n + D = A * D * n**n + D**(n+1) / (n**n * prod(x_i))

    Converging solution:

    D[j+1] = (A * n**n * sum(x_i) - D[j]**(n+1) / (n**n prod(x_i))) / (A * n**n - 1)
*)
function get_D(
  const xp              : map(token_pool_idx_t, nat);
  const amp_f           : nat)
                        : nat is
  block {
    function sum(
      const accum       : nat;
      const i           : nat * nat)
                        : nat is
      accum + i.1;

    var sum_c: nat := Map.fold(sum, xp, 0n);
    const tokens_count = Map.size(xp);
    const a_nn_f: nat = amp_f * tokens_count;
    var tmp: tmp_get_d_t := record [ d = sum_c; prev_d = 0n; ];

    while abs(tmp.d - tmp.prev_d) > 1n
      block {
        const d_const = tmp.d;
        function count_D_P(
          const accum   : nat * nat;
          const i       : token_pool_idx_t * nat)
                        : nat * nat is
          (accum.0 * d_const, accum.1 * (i.1 * tokens_count));
        const counted = Map.fold(count_D_P, xp, (tmp.d, 1n));
        const d_P = counted.0 / counted.1;
        tmp.prev_d := tmp.d;
        tmp.d := (a_nn_f * sum_c / Constants.a_precision + d_P * tokens_count) * tmp.d / (
          nat_or_error(a_nn_f - Constants.a_precision, Errors.Dex.wrong_precision) * tmp.d / Constants.a_precision + (tokens_count + 1n) * d_P
        ); (* Equality with the precision of 1 *)
      };
  } with tmp.d

function get_D_mem(
  const tokens_info     : map(token_pool_idx_t, token_info_t);
  const amp_f           : nat)
                        : nat is
  get_D(xp_mem(tokens_info), amp_f);

(*
  Calculate x[j] if one makes x[i] = x
  Done by solving quadratic equation iteratively.
  x_1**2 + x_1 * (sum' - (A*n**n - 1) * D / (A * n**n)) = D ** (n + 1) / (n ** (2 * n) * prod' * A)
  x_1**2 + b*x_1 = c
  x_1 = (x_1**2 + c) / (2*x_1 + b)
*)
function calc_y(
  var c                 : nat;
  const a_nn_f          : nat;
  const s_              : nat;
  const d               : nat;
  const pool            : pool_t)
                        : nat is
  block {
    const tokens_count = Map.size(pool.tokens_info);
    c := ceil_div(c * d * Constants.a_precision, (a_nn_f * tokens_count));
    const b: nat = s_ + d * Constants.a_precision / a_nn_f;
    var tmp := record [ y = d; prev_y = 0n; ];
    while abs(tmp.y - tmp.prev_y) > 1n
      block {
        tmp.prev_y := tmp.y;
        tmp.y := ceil_div((tmp.y * tmp.y + c), nat_or_error(2 * tmp.y + b - d, Errors.Math.nat_error));
      }
  } with tmp.y

function get_y(
  const i               : nat;
  const j               : nat;
  const x               : nat;
  const xp              : map(token_pool_idx_t, nat);
  const s               : pool_t)
                        : nat is
  block {
    const tokens_count = Map.size(s.tokens_info);

    assert(i =/= j);                      (* dev: same coin *)
    assert(j < tokens_count); (* dev: j below zero *)
    assert(i < tokens_count); (* should be unreachable, but good for safety *)

    const amp_f = get_A(
      s.initial_A_time,
      s.initial_A_f,
      s.future_A_time,
      s.future_A_f
    );
    const a_nn_f = amp_f * tokens_count;
    const d = get_D(xp, amp_f);

    function prepare_params(
      var accum         : record [ s_: nat; c: nat * nat; ];
      const entry       : nat * nat)
                        : record [ s_: nat; c: nat * nat; ] is
    block {
      var   _x  : nat := 0n;
      const iter: nat = entry.0;
      if iter =/= j
      then {
        if iter = i
        then _x := x
        else _x := entry.1;
        accum.s_ := accum.s_ + _x;
        accum.c.0 := accum.c.0 * d;
        accum.c.1 := accum.c.1 * (_x * tokens_count);
      }
      else skip;
    } with accum;

    const res = Map.fold(prepare_params, xp, record[ s_ = 0n; c = (d, 1n); ]);
    const c = ceil_div(res.c.0, res.c.1);
  } with calc_y(c, a_nn_f, res.s_, d, s)

(*
  Calculate x[i] if one reduces D from being calculated for xp to D
  Done by solving quadratic equation iteratively.
  x_1**2 + x_1 * (sum' - (A*n**n - 1) * D / (A * n**n)) = D ** (n + 1) / (n ** (2 * n) * prod' * A)
  x_1**2 + b*x_1 = c
  x_1 = (x_1**2 + c) / (2*x_1 + b)
  # x in the input is converted to the same price/precision
*)
function get_y_D(
  const amp_f           : nat;
  const i               : nat;
  const xp              : map(token_pool_idx_t, nat);
  const d               : nat;
  const s               : pool_t)
                        : nat is
  block {
    const tokens_count = Map.size(s.tokens_info);

    require(i < tokens_count, Errors.Dex.wrong_index);  // dev: i above N_COINS

    const a_nn_f = amp_f * tokens_count;

    function prepare_params(
      var accum           : record[ s_: nat; c: nat * nat; ];
      const entry       : nat * nat)
                        : record[ s_: nat; c: nat * nat; ] is
    block{
      var   _x := 0n;
      const iter = entry.0;
      if iter =/= i
          then {
          _x := entry.1;
          accum.s_ := accum.s_ + _x;
          accum.c.0 := accum.c.0 * d;
          accum.c.1 := accum.c.1 * (_x * tokens_count);
        }
        else skip;
    } with accum;

    const res = Map.fold(prepare_params, xp, record[ s_ = 0n; c = (d, 1n); ]);
    const c = ceil_div(res.c.0, res.c.1);
  } with calc_y(c, a_nn_f, res.s_, d, s)

function calc_withdraw_one_coin(
    const amp_f         : nat;
    const token_amount  : nat;
    const i             : nat;
    const dev_fee_f     : nat;
    const pool          : pool_t)
                        : withdraw_one_rtrn is
  block {
    (*  First, need to calculate
     *  Get current D
     *  Solve Eqn against y_i for D - token_amount
     *)
    const tokens_count = Map.size(pool.tokens_info);
    const xp: map(token_pool_idx_t, nat)= xp(pool);
    const d0            : nat           = get_D(xp, amp_f);
    var   total_supply  : nat           := pool.total_supply;
    const d1            : nat           = nat_or_error(d0 - (token_amount * d0 / total_supply), Errors.Math.nat_error);
    require(d1 < d0, Errors.Dex.zero_in);
    const new_y         : nat           = get_y_D(amp_f, i, xp, d1, pool);
    const base_fee_f    : nat           = sum_all_fee(pool.fee, dev_fee_f);

    function reduce_xp(const key: token_pool_idx_t; const value: nat): nat is
      block {
        var dx_expected: nat := 0n;
        if key = i
        then dx_expected := nat_or_error((value * d1 / d0) - new_y, Errors.Math.nat_error)
        else dx_expected := nat_or_error(value - (value * d1 / d0), Errors.Math.nat_error);
        const reduced = nat_or_error(
          value - dx_expected * divide_fee_for_balance(base_fee_f, tokens_count) / Constants.fee_denominator,
          Errors.Math.nat_error
        );
    } with reduced;

    const xp_reduced = Map.map(reduce_xp, xp);
    const xp_red_i = unwrap(xp_reduced[i], Errors.Dex.wrong_index);
    var dy := nat_or_error(xp_red_i - get_y_D(amp_f, i, xp_reduced, d1, pool), Errors.Math.nat_error);
    const t_i = unwrap(pool.tokens_info[i], Errors.Dex.wrong_index);
    require(dy < t_i.reserves, Errors.Dex.low_reserves);
    const precisions_i =  t_i.precision_multiplier_f;
    const xp_i = unwrap(xp[i], Errors.Dex.wrong_index);
    dy := dy / precisions_i;

    const dy_0 = nat_or_error(xp_i - new_y, Errors.Math.nat_error) / precisions_i;  //# w/o s.fee

    total_supply := nat_or_error(pool.total_supply - token_amount, Errors.Dex.low_total_supply);

    const fee = nat_or_error(dy_0 - dy, Errors.Math.nat_error);
  } with record [ dy = dy; dy_fee = fee; ts = total_supply ]

(* Balance pool when imbalanced request *)
function balance_inputs(
  const init_tokens_info: map(token_pool_idx_t, token_info_t);
  const d0              : nat;
  const new_tokens_info : map(token_pool_idx_t, token_info_t);
  const d1              : nat;
  const tokens          : tokens_map_t;
  const fees            : fees_storage_t;
  const dev_fee_f       : nat;
  const referral        : address;
  var accumulator       : balancing_accum_t)
                        : balancing_accum_t is
  block {
    const tokens_count = Map.size(tokens);

    function balance_it(
      var accum         : balancing_accum_t;
      const entry       : token_pool_idx_t * token_info_t)
                        : balancing_accum_t is
      block {
        const i = entry.0;
        var token_info := entry.1;
        const old_info = unwrap(init_tokens_info[i], Errors.Dex.wrong_index);
        const ideal_balance = d1 * old_info.reserves / d0;
        const diff = abs(ideal_balance - token_info.reserves);
        const to_dev = diff * divide_fee_for_balance(dev_fee_f, tokens_count) / Constants.fee_denominator;
        const to_ref = diff * divide_fee_for_balance(fees.ref_f, tokens_count) / Constants.fee_denominator;
        var to_lp := diff * divide_fee_for_balance(fees.lp_f, tokens_count) / Constants.fee_denominator;
        var to_stakers := 0n;

        if accum.staker_accumulator.total_staked =/= 0n
        then {
          to_stakers := diff * divide_fee_for_balance(fees.stakers_f, tokens_count) / Constants.fee_denominator;
          accum.staker_accumulator.total_fees[i] := unwrap_or(accum.staker_accumulator.total_fees[i], 0n) + to_stakers;
          accum.staker_accumulator.accumulator_f[i] := unwrap_or(accum.staker_accumulator.accumulator_f[i], 0n) + to_stakers * Constants.accum_precision / accum.staker_accumulator.total_staked;
        }
        else to_lp := to_lp + diff * divide_fee_for_balance(fees.stakers_f, tokens_count) / Constants.fee_denominator;

        const token = unwrap(tokens[i], Errors.Dex.wrong_index);

        accum.dev_rewards[token] := unwrap_or(accum.dev_rewards[token], 0n) + to_dev;
        accum.referral_rewards[(referral, token)] := unwrap_or(accum.referral_rewards[(referral, token)], 0n) + to_ref;
        token_info := nip_fees_off_reserves(
          to_stakers,
          to_ref,
          to_dev,
          token_info
        );
        accum.tokens_info[i] := token_info;
        token_info.reserves := nat_or_error(token_info.reserves - to_lp, Errors.Dex.low_reserves);
        accum.tokens_info_without_lp[i] := token_info;
    } with accum;
  } with Map.fold(balance_it, new_tokens_info, accumulator);

function perform_swap(
  const i               : token_pool_idx_t;
  const j               : token_pool_idx_t;
  const dx              : nat;
  const pool            : pool_t)
                        : nat is
  block {
    const xp        = xp(pool);
    const xp_i      = unwrap(xp[i], Errors.Dex.wrong_index);
    const xp_j      = unwrap(xp[j], Errors.Dex.wrong_index);
    const t_i       = unwrap(pool.tokens_info[i], Errors.Dex.wrong_index);
    const t_j       = unwrap(pool.tokens_info[j], Errors.Dex.wrong_index);
    const rate_i_f  = t_i.rate_f;
    const rate_j_f  = t_j.rate_f;
    const x         = xp_i + ((dx * rate_i_f) / Constants.precision);
    const y         = get_y(i, j, x, xp, pool);
    var dy          := nat_or_error(xp_j - y, Errors.Math.nat_error);  // -1 just in case there were some rounding errors
    dy := dy * Constants.precision / rate_j_f;
    require(dy < t_j.reserves, Errors.Dex.low_reserves);
  } with dy

(* Adds liquidity to pool *)
function add_liq(
  const params          : add_liq_param_t;
  var   s               : storage_t)
                        : record [ s: storage_t; op: list(operation); ] is
  block {
    require(params.min_mint_amount > 0n, Errors.Dex.zero_min_out);
    var pool := params.pool;
    const amp_f = get_A(
      pool.initial_A_time,
      pool.initial_A_f,
      pool.future_A_time,
      pool.future_A_f
    );
    // Initial invariant
    const init_tokens_info = pool.tokens_info;
    const d0 = get_D_mem(init_tokens_info, amp_f);
    const token_supply = pool.total_supply;
    const referral = unwrap_or(params.referral, s.default_referral);
    function add_inputs(
      const key         : token_pool_idx_t;
      var token_info    : token_info_t)
                        : token_info_t is
      block {
        const input = unwrap_or(params.inputs[key], 0n);
        require(token_supply =/= 0n or input > 0n, Errors.Dex.zero_in);
        token_info.reserves := token_info.reserves + input;
      } with token_info;

    var new_tokens_info := Map.map(add_inputs, init_tokens_info);
    const d1 = get_D_mem(new_tokens_info, amp_f);

    require(d1 > d0, Errors.Dex.zero_in);

    var mint_amount := 0n;

    if token_supply > 0n
    then {
      const balanced = balance_inputs(
        init_tokens_info,
        d0,
        new_tokens_info,
        d1,
        unwrap(s.tokens[params.pool_id], Errors.Dex.pool_not_listed),
        pool.fee,
        get_dev_fee(s),
        referral,
        record [
          dev_rewards = s.dev_rewards;
          referral_rewards = s.referral_rewards;
          staker_accumulator = pool.staker_accumulator;
          tokens_info = new_tokens_info;
          tokens_info_without_lp = new_tokens_info;
        ]
      );

      s.dev_rewards := balanced.dev_rewards;
      s.referral_rewards := balanced.referral_rewards;
      pool.staker_accumulator := balanced.staker_accumulator;
      pool.tokens_info := balanced.tokens_info;

      const d2 = get_D_mem(balanced.tokens_info_without_lp, amp_f);

      mint_amount := token_supply * nat_or_error(d2 - d0, Errors.Math.nat_error) / d0;
    }
    else {
      pool.tokens_info := new_tokens_info;
      mint_amount := d1;
    };

    require(mint_amount >= params.min_mint_amount, Errors.Dex.wrong_shares_out);

    const tokens = s.tokens;

    function transfer_to_pool(
      const operations  : list(operation);
      const input       : nat * nat)
                        : list(operation) is
      if input.1 > 0n
      then typed_transfer(
        Tezos.get_sender(),
        Tezos.get_self_address(),
        input.1,
        get_token_by_id(input.0, tokens[params.pool_id])
      ) # operations
      else operations;

    pool.total_supply := pool.total_supply + mint_amount;
    const (rebalance_ops, strategy_store) = operate_with_strategy(
      pool.tokens_info,
      tokens[params.pool_id],
      pool.strategy,
      False
    );
    pool.strategy := strategy_store;
    s.pools[params.pool_id] := pool;

    const receiver = unwrap_or(params.receiver, Tezos.get_sender());
    const user_key = (receiver, params.pool_id);
    const share = unwrap_or(s.ledger[user_key], 0n);
    const new_shares = share + mint_amount;
    s.ledger[user_key] := new_shares;
    const event_params: invest_event_t = record[
      pool_id = params.pool_id;
      inputs = params.inputs;
      shares_minted = mint_amount;
      receiver = receiver;
      referral = referral;
    ];
  } with record[ op = emit_event(InvestEvent(event_params)) # Map.fold(transfer_to_pool, params.inputs, rebalance_ops); s = s ]
