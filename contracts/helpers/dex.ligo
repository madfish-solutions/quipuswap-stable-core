(* Contract admin check *)
function is_admin(const admin: address): unit is
  assert_with_error(
    Tezos.sender = admin,
    Errors.not_contract_admin
  );

(* Contract admin or dev check *)
function is_admin_or_dev(const admin: address; const dev: address): unit is
  assert_with_error(
    Tezos.sender = admin or Tezos.sender = dev,
    Errors.not_contract_admin
  );

function check_time_expiration(const exp: timestamp): unit is
  assert_with_error(
    exp >= Tezos.now,
    Errors.time_expired
  );

function set_func_or_fail(
  const params      : set_lambda_func_t;
  const max_idx     : nat;
  var lambda_storage: big_map(nat, bytes))
                    : big_map(nat, bytes) is
  block {
    assert_with_error(params.index < max_idx, Errors.wrong_index);
    assert_with_error(not Big_map.mem(params.index, lambda_storage), Errors.func_set);
    lambda_storage[params.index] := params.func;
  } with lambda_storage

function sum_all_fee(
  const fee   : fees_storage_t
)             : nat is
  fee.lp_fee
  + fee.stakers_fee
  + fee.ref_fee
  + fee.dev_fee;

function sum_wo_lp_fee(
  const fee   : fees_storage_t
)             : nat is
  fee.stakers_fee
  + fee.ref_fee
  + fee.dev_fee;

function perform_fee_slice(
    const dy            : nat;
    const fee           : fees_storage_t;
    const total_staked  : nat
  )                     : record[
    dy : nat;
    ref: nat;
    dev: nat;
    stkr: nat;
    lp: nat;
  ] is
  block {
    var new_dy := dy;

    const to_ref = dy * fee.ref_fee / Constants.fee_denominator;
    const to_dev = dy * fee.dev_fee / Constants.fee_denominator;
    var to_prov := dy * fee.lp_fee / Constants.fee_denominator;

    var to_stakers := 0n;
    if (total_staked =/= 0n)
      then to_stakers := dy * fee.stakers_fee / Constants.fee_denominator;
    else to_prov := to_prov + dy * fee.stakers_fee / Constants.fee_denominator;
    const return = record[
      dy = nat_or_error(new_dy - to_prov - to_ref - to_dev - to_stakers, Errors.fee_overflow);
      ref = to_ref;
      dev = to_dev;
      stkr = to_stakers;
      lp = to_prov
    ]
  } with return

function xp_mem(const tokens_info : map(tkn_pool_idx_t, tkn_inf_t)): map(tkn_pool_idx_t, nat) is
  block {
    function count_result(const _key: nat; var token_info: tkn_inf_t): nat is
      (token_info.rate * token_info.virtual_reserves) / Constants.precision;
  } with Map.map(count_result, tokens_info);

function xp(const s: pair_t): map(nat, nat) is xp_mem(s.tokens_info);

(* Handle ramping A up or down *)
function get_A(
  const t0 : timestamp;
  const a0 : nat;
  const t1 : timestamp;
  const a1 : nat)
                      : nat is
  if Tezos.now < t1
    then
      if a1 > a0
        then a0 + abs(a1 - a0) * nat_or_error(Tezos.now - t0, Errors.timestamp_error) / nat_or_error(t1 - t0, Errors.timestamp_error)
      else abs(a0 - abs(a0 - a1) * nat_or_error(Tezos.now - t0, Errors.timestamp_error) / nat_or_error(t1 - t0, Errors.timestamp_error)); (* always a0 > (a0-a1) * (now-t0)/(t1-t0) if t1 > now && a0 > a1 *)
  else a1


(*
  D invariant calculation in non-overflowing integer operations iteratively

  A * sum(x_i) * n**n + D = A * D * n**n + D**(n+1) / (n**n * prod(x_i))

    Converging solution:

    D[j+1] = (A * n**n * sum(x_i) - D[j]**(n+1) / (n**n prod(x_i))) / (A * n**n - 1)
*)
function get_D(const xp: map(nat, nat); const amp: nat): nat is
  block {
    function sum(const acc : nat; const i : nat * nat): nat is acc + i.1;

    var sum_c: nat := Map.fold(sum, xp, 0n);
    const tokens_count = Map.size(xp);
    const a_nn: nat = amp * tokens_count;
    var tmp : tmp_get_d_t := record [
      d = sum_c;
      prev_d = 0n;
    ];

    while abs(tmp.d - tmp.prev_d) > 1n
      block {
        const d_const = tmp.d;
        function count_D_P(const acc : nat; const i : nat * nat): nat is
          acc * d_const / (i.1 * tokens_count);
        const d_P = Map.fold(count_D_P, xp, tmp.d);

        tmp.prev_d := tmp.d;
        tmp.d := (a_nn * sum_c / Constants.a_precision + d_P * tokens_count) * tmp.d / (
          nat_or_error(a_nn - Constants.a_precision, Errors.wrong_precision) * tmp.d / Constants.a_precision + (tokens_count + 1n) * d_P); (* Equality with the precision of 1 *)
      };
  } with tmp.d

function get_D_mem(const tokens_info : map(tkn_pool_idx_t, tkn_inf_t); const amp: nat): nat is
  get_D(xp_mem(tokens_info), amp);

(*
  Calculate x[j] if one makes x[i] = x
  Done by solving quadratic equation iteratively.
  x_1**2 + x_1 * (sum' - (A*n**n - 1) * D / (A * n**n)) = D ** (n + 1) / (n ** (2 * n) * prod' * A)
  x_1**2 + b*x_1 = c
  x_1 = (x_1**2 + c) / (2*x_1 + b)
*)
function calc_y(
  var c       : nat;
  const a_nn  : nat;
  const s_    : nat;
  const d     : nat;
  const s     : pair_t
)             : nat is
  block {
    const tokens_count = Map.size(s.tokens_info);
    var _y_prev: nat := 0n;
    c := c * d * Constants.a_precision / (a_nn * tokens_count);

    const b: nat = s_ + d * Constants.a_precision / a_nn;
    var y: nat := d;

    while abs(y - _y_prev) > 1n
      block {
        _y_prev := y;
        y := (y * y + c) / nat_or_error(2 * y + b - d, Errors.nat_error);
      }
  } with y

function get_y(
  const i : nat;
  const j : nat;
  const x : nat;
  const xp: map(nat, nat);
  const s : pair_t
)         : nat is
  block {
    const tokens_count = Map.size(s.tokens_info);
    (* x in the input is converted to the same price/precision *)

    assert(i =/= j);               (* dev: same coin *)
    assert(j >= 0n and j < tokens_count);               (* dev: j below zero *)

    (* should be unreachable, but good for safety *)

    assert(i >= 0n and i < tokens_count);

    const amp   : nat = get_A(
      s.initial_A_time,
      s.initial_A,
      s.future_A_time,
      s.future_A
    );
    const a_nn  : nat = amp * tokens_count;
    const d     : nat = get_D(xp, amp);

    function prepare_params(
      var acc: record[
        s_  : nat;
        c   : nat;
      ];
      const entry : nat * nat
    ): record[
        s_  : nat;
        c   : nat;
      ] is
    block {
      var   _x  : nat := 0n;
      const iter: nat = entry.0;
      if iter =/= j
          then {
          if iter = i
            then _x := x
          else _x := entry.1;
          acc.s_ := acc.s_ + _x;
          acc.c := acc.c * d / (_x * tokens_count);
        }
        else skip;
    } with acc;

    const res = Map.fold(prepare_params, xp, record[
        s_  = 0n;
        c   = d;
      ])
  } with calc_y(res.c, a_nn, res.s_, d, s)

function get_y_D(
  const amp : nat;
  const i   : nat;
  const xp : map(nat, nat);
  const d   : nat;
  const s   : pair_t)
            : nat is
  block {
    (*
    Calculate x[i] if one reduces D from being calculated for xp to D
    Done by solving quadratic equation iteratively.
    x_1**2 + x_1 * (sum' - (A*n**n - 1) * D / (A * n**n)) = D ** (n + 1) / (n ** (2 * n) * prod' * A)
    x_1**2 + b*x_1 = c
    x_1 = (x_1**2 + c) / (2*x_1 + b)
    # x in the input is converted to the same price/precision
    *)

    const tokens_count = Map.size(s.tokens_info);

    assert(i >= 0n); // dev: i below zero
    assert(i < tokens_count);  // dev: i above N_COINS

    const a_nn  : nat = amp * tokens_count;
    function prepare_params(
      var acc: record[
        s_  : nat;
        c   : nat;
      ];
      const entry : nat * nat
    ): record[
        s_  : nat;
        c   : nat;
      ] is
    block{
      var   _x  : nat := 0n;
      const iter: nat = entry.0;
      if iter =/= i
          then {
          _x := entry.1;
          acc.s_ := acc.s_ + _x;
          acc.c := acc.c * d / (_x * tokens_count);
        }
        else skip;
    } with acc;

    const res = Map.fold(prepare_params, xp, record[
        s_  = 0n;
        c   = d;
      ]);
  } with calc_y(res.c, a_nn, res.s_, d, s)

[@inline]
function divide_fee_for_balance(const fee: nat; const tokens_count: nat): nat
  is fee * tokens_count / (4n * nat_or_error(tokens_count - 1n, Errors.wrong_tokens_count));

function calc_withdraw_one_coin(
    const amp : nat;
    const token_amount: nat;
    const i: nat;
    const pair: pair_t
  ): withdraw_one_return is
  block {
    (*  First, need to calculate
     *  Get current D
     *  Solve Eqn against y_i for D - token_amount
     *)
    const tokens_count = Map.size(pair.tokens_info);
    const xp            : map(nat, nat) = xp(pair);
    const d0            : nat           = get_D(xp, amp);
    var   total_supply  : nat           := pair.total_supply;
    const d1            : nat           = nat_or_error(d0 - (token_amount * d0 / total_supply), Errors.nat_error);
    const new_y         : nat           = get_y_D(amp, i, xp, d1, pair);
    const base_fee      : nat           = sum_all_fee(pair.fee);
    function reduce_xp(const key: nat; const value: nat): nat is
      block {
        var dx_expected: nat := 0n;
        if key = i
          then dx_expected := nat_or_error((value * d1 / d0) - new_y, Errors.nat_error);
        else   dx_expected := nat_or_error(value - (value * d1 / d0), Errors.nat_error);
        const reduced = nat_or_error(value - dx_expected * divide_fee_for_balance(base_fee, tokens_count) / Constants.fee_denominator, Errors.nat_error);
    } with reduced;

    var xp_reduced : map(nat, nat) := Map.map(reduce_xp, xp);
    const xp_red_i = unwrap(xp_reduced[i], Errors.wrong_index);
    var dy: nat := nat_or_error(xp_red_i - get_y_D(amp, i, xp_reduced, d1, pair), Errors.nat_error);
    const t_i = unwrap(pair.tokens_info[i], Errors.wrong_index);
    const precisions_i =  t_i.precision_multiplier;
    const xp_i = unwrap(xp[i], Errors.wrong_index);
    dy := nat_or_error(dy - 1, Errors.nat_error) / precisions_i;  //# Withdraw less to account for rounding errors
    const dy_0: nat = nat_or_error(xp_i - new_y, Errors.nat_error) / precisions_i;  //# w/o s.fee
    total_supply := nat_or_error(pair.total_supply - token_amount, Errors.low_total_supply);
    const fee = nat_or_error(dy_0 - dy, Errors.nat_error);
  } with record[
      dy=dy;
      dy_fee=fee;
      ts=total_supply
    ]


function balance_inputs(
  const init_tokens_info  : map(tkn_pool_idx_t, tkn_inf_t);
  const d0                : nat;
  const new_tokens_info   : map(tkn_pool_idx_t, tkn_inf_t);
  const d1                : nat;
  const tokens            : tkns_map_t;
  const fees              : fees_storage_t;
  const referral          : address;
  var accumulator         : balancing_acc_t
  )                       : balancing_acc_t is
  block {
    const tokens_count = Map.size(tokens);
    function balance_it(
      var acc: balancing_acc_t;
      const entry: tkn_pool_idx_t * tkn_inf_t
      ): balancing_acc_t is
      block {
        const i: tkn_pool_idx_t = entry.0;
        var token_info: tkn_inf_t := entry.1;
        const old_info: tkn_inf_t = unwrap(init_tokens_info[i], Errors.wrong_index);
        const ideal_balance = d1 * old_info.virtual_reserves / d0;
        const diff = abs(ideal_balance - token_info.virtual_reserves);
        const to_dev = diff * divide_fee_for_balance(fees.dev_fee, tokens_count) / Constants.fee_denominator;
        const to_ref = diff * divide_fee_for_balance(fees.ref_fee, tokens_count) / Constants.fee_denominator;
        var to_lp := diff * divide_fee_for_balance(fees.lp_fee, tokens_count) / Constants.fee_denominator;
        var to_stakers := 0n;
        if acc.staker_accumulator.total_staked =/= 0n
          then {
            to_stakers := diff * divide_fee_for_balance(fees.stakers_fee, tokens_count) / Constants.fee_denominator;
            acc.staker_accumulator.accumulator[i] := unwrap_or(acc.staker_accumulator.accumulator[i], 0n) + to_stakers * Constants.stkr_acc_precision / acc.staker_accumulator.total_staked;
          }
        else to_lp := to_lp + diff * divide_fee_for_balance(fees.stakers_fee, tokens_count) / Constants.fee_denominator;
        const token = get_token_by_id(i, Some(tokens));
        acc.dev_rewards[token] := unwrap_or(acc.dev_rewards[token], 0n) + to_dev;
        acc.referral_rewards[(referral, token)] := unwrap_or(acc.referral_rewards[(referral, token)], 0n) + to_ref;

        token_info.reserves := nat_or_error(token_info.reserves - to_dev - to_ref - to_stakers, Errors.low_virtual_reserves);
        token_info.virtual_reserves := nat_or_error(token_info.virtual_reserves - to_dev - to_ref - to_stakers, Errors.low_virtual_reserves);
        acc.tokens_info[i] := token_info;
        token_info.reserves := nat_or_error(token_info.reserves - to_lp, Errors.low_virtual_reserves);
        token_info.virtual_reserves := nat_or_error(token_info.virtual_reserves - to_lp, Errors.low_virtual_reserves);
        acc.tokens_info_without_lp[i] := token_info;
    } with acc;
} with Map.fold(balance_it, new_tokens_info, accumulator);

function preform_swap(
  const i: tkn_pool_idx_t;
  const j: tkn_pool_idx_t;
  const dx: nat;
  const pair: pair_t): nat is
  block {
    const xp = xp(pair);
    const xp_i = unwrap(xp[i], Errors.wrong_index);
    const xp_j = unwrap(xp[j], Errors.wrong_index);
    const t_i = unwrap(pair.tokens_info[i], Errors.wrong_index);
    const t_j = unwrap(pair.tokens_info[j], Errors.wrong_index);
    const rate_i = t_i.rate;
    const rate_j = t_j.rate;
    const x = xp_i + ((dx * rate_i) / Constants.precision);
    const y = get_y(i, j, x, xp, pair);
    const dy = nat_or_error(xp_j - y - 1, Errors.nat_error);  // -1 just in case there were some rounding errors
  } with dy * Constants.precision / rate_j

  function add_liq(
    const params  : add_liq_prm_t;
    var   s       : storage_t)
                  : return_t is
  block {
    var pair : pair_t := params.pair;
    const amp = get_A(
      pair.initial_A_time,
      pair.initial_A,
      pair.future_A_time,
      pair.future_A
    );
    // Initial invariant
    const init_tokens_info = pair.tokens_info;
    const d0 = get_D_mem(init_tokens_info, amp);
    const token_supply = pair.total_supply;
    function add_inputs(
      const key       : tkn_pool_idx_t;
      var token_info  : tkn_inf_t)
                      : tkn_inf_t is
      block {
        const input = unwrap_or(params.inputs[key], 0n);
        assert_with_error(token_supply =/= 0n or input > 0n, Errors.zero_in);
        token_info.virtual_reserves := token_info.virtual_reserves + input;
        token_info.reserves := token_info.reserves + input;
      } with token_info;

    var new_tokens_info := Map.map(add_inputs, init_tokens_info);
    const d1 = get_D_mem(new_tokens_info, amp);

    assert_with_error(d1 > d0, Errors.zero_in);

    var mint_amount := 0n;

    if token_supply > 0n
    then {
      const balanced = balance_inputs(
        init_tokens_info,
        d0,
        new_tokens_info,
        d1,
        unwrap(s.tokens[params.pair_id], Errors.pair_not_listed),
        pair.fee,
        unwrap_or(params.referral, s.default_referral),
        record [
          dev_rewards = s.dev_rewards;
          referral_rewards = s.referral_rewards;
          staker_accumulator = pair.staker_accumulator;
          tokens_info = new_tokens_info;
          tokens_info_without_lp = new_tokens_info;
      ]);
      s.dev_rewards := balanced.dev_rewards;
      s.referral_rewards := balanced.referral_rewards;
      pair.staker_accumulator := balanced.staker_accumulator;
      pair.tokens_info := balanced.tokens_info;
      const d2 = get_D_mem(balanced.tokens_info_without_lp, amp);
      mint_amount := token_supply * nat_or_error(d2 - d0, Errors.nat_error) / d0;
    }
    else {
      pair.tokens_info := new_tokens_info;
      mint_amount := d1;
    };
    assert_with_error(mint_amount >= params.min_mint_amount, Errors.wrong_shares_out);

    const tokens = s.tokens;
    function transfer_to_pool(const operations : list(operation); const input : nat * nat) : list(operation) is
      if input.1 > 0n
        then typed_transfer(
          Tezos.sender,
          Tezos.self_address,
          input.1,
          get_token_by_id(input.0, tokens[params.pair_id])
        ) # operations
      else operations;
    pair.total_supply := pair.total_supply + mint_amount;
    const user_key = (Tezos.sender, params.pair_id);
    s.ledger[user_key] := unwrap_or(s.ledger[user_key], 0n) + mint_amount;
    s.pools[params.pair_id] := pair;
  } with (Map.fold(transfer_to_pool, params.inputs, Constants.no_operations), s)

function harvest_staker_rewards(
  var info          : stkr_info_t;
  var operations    : list(operation);
  const accumulator : stkr_acc_t;
  const tokens      : option(tkns_map_t)
  )                 : stkr_info_t * list(operation) is
  block {
    const staker_balance = info.balance;
    function fold_rewards(
      var acc: record [
        op: list(operation);
        earnings: map(tkn_pool_idx_t, account_rwrd_t);
      ];
      const entry: tkn_pool_idx_t * nat
      ): record [
        op: list(operation);
        earnings: map(tkn_pool_idx_t, account_rwrd_t);
      ] is
      block {
        const i = entry.0;
        const pool_acc = entry.1;
        const reward = unwrap_or(acc.earnings[i], record[
          former = 0n;
          reward = 0n;
        ]);
        const new_former = staker_balance * pool_acc;
        const reward_amt = (reward.reward + abs(new_former - reward.former)) / Constants.stkr_acc_precision;
        acc.op := typed_transfer(
          Tezos.self_address,
          Tezos.sender,
          reward_amt,
          get_token_by_id(i, tokens)
        ) # acc.op;
        acc.earnings[i] := record[
          former = new_former;
          reward = 0n;
        ];
    } with acc;
    const harvest = Map.fold(fold_rewards, accumulator.accumulator, record[op=operations; earnings=info.earnings]);
    operations := harvest.op;
    patch info with record [ earnings=harvest.earnings; ];
  } with (info, operations)

function update_former_and_transfer(
  const flag: a_r_flag_t;
  const shares: nat;
  const staker_acc: stkr_info_t;
  const pool_s_accumulator: stkr_acc_t;
  const quipu_token : fa2_token_t;
  const operations: list(operation)
  ): record [
    account: stkr_info_t;
    staker_accumulator: stkr_acc_t;
    ops: list(operation);
  ] is
  block {
    const (
      new_balance,
      forwarder,
      receiver,
      total_staked
    ) = case flag of
          Add -> (
            staker_acc.balance + shares,
            Tezos.sender,
            Tezos.self_address,
            pool_s_accumulator.total_staked + shares
            )
        | Remove -> (
            nat_or_error(staker_acc.balance - shares, Errors.wrong_shares_out),
            Tezos.self_address,
            Tezos.sender,
            nat_or_error(pool_s_accumulator.total_staked - shares, Errors.wrong_shares_out)
            )
        end;
      function upd_former(const i: tkn_pool_idx_t; const rew: account_rwrd_t) : account_rwrd_t is
        rew with record [former = new_balance * unwrap_or(pool_s_accumulator.accumulator[i], 0n)];
} with record[
  account = record[
      balance = new_balance;
      earnings = Map.map(upd_former, staker_acc.earnings);
    ];
  staker_accumulator = pool_s_accumulator with record[
      total_staked = total_staked
    ];
  ops = typed_transfer(
      forwarder,
      receiver,
      shares,
      Fa2(quipu_token)
    ) # operations;
]

