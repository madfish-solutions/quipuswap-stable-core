(* Contract admin check *)
[@inline]
function is_admin(const s: storage_type): unit is
  if Tezos.sender =/= s.admin
    then failwith(err_not_contract_admin)
  else Unit;


function sum_all_fee(
  const s     : pair_type
)             : nat is
  s.fee.lp_fee
  + s.fee.stakers_fee
  + s.fee.ref_fee
  + s.fee.dev_fee;

function sum_wo_lp_fee(
  const s     : pair_type
)             : nat is
  s.fee.stakers_fee
  + s.fee.ref_fee
  + s.fee.dev_fee;

function _xp_mem(const _balances: map(nat, nat); const s: pair_type): map(nat, nat) is
  block {
    function count_result(const key: nat; const value: nat): nat is
      block {
        const bal: nat = case _balances[key] of
          | Some(bal) -> bal
          | None -> (failwith("balance not provided"): nat)
          end;
      } with value * bal / _C_precision;
  } with Map.map(count_result, s.token_rates);

function _xp(const s: pair_type): map(nat, nat) is _xp_mem(s.virtual_reserves, s);

(* Handle ramping A up or down *)
function _A(const s: pair_type): nat is
  block {
    const t1: timestamp = s.future_A_time;
    const a1: nat = s.future_A;
    const current_time: timestamp = Tezos.now;
    var result: nat := 0n;
    if current_time < t1
      then {
        const a0: nat = s.initial_A;
        const t0: timestamp = s.initial_A_time;

        result := abs(a0 + (a1 - a0)) * abs(current_time - t0) / abs(t1 - t0);
      }
    else result := a1;
  } with result

(* Gets token count by size of reserves map *)
function get_token_count(const s: pair_type): nat is Map.size(s.reserves);

(* Gets token count by size of reserves map *)
function get_token_by_id(
    const token_id  : token_pool_index;
    const pool_id   : pool_id_type;
    const s         : storage_type
  )                 : token_type is
  block {
    const tokens = case s.tokens[pool_id] of
        Some(tokens) -> tokens
      | None -> (failwith(err_pair_not_listed): tokens_type)
      end;
    const token = case tokens[token_id] of
        Some(token) -> token
      | None -> (failwith("wrong_id"): token_type)
      end;
  } with token

(*
  D invariant calculation in non-overflowing integer operations iteratively

  A * sum(x_i) * n**n + D = A * D * n**n + D**(n+1) / (n**n * prod(x_i))

    Converging solution:

    D[j+1] = (A * n**n * sum(x_i) - D[j]**(n+1) / (n**n prod(x_i))) / (A * n**n - 1)
*)
function get_D(const _xp: map(nat, nat); const _amp: nat; const s: pair_type): nat is
  block {
    const tokens_count = get_token_count(s);
    function sum(const acc : nat; const i : nat * nat): nat is acc + i.1;

    var sum_c: nat := Map.fold(sum, _xp, 0n);
    var _d_prev: nat := 0n;

    if sum_c = 0n and s.total_supply =/= 0n
      then failwith(err_zero_in)
    else skip;

    var d: nat := sum_c;
    const a_nn: nat = _amp * tokens_count;

    while abs(d - _d_prev) > 1n
      block {
        var _d_P := d;
        _d_prev := d;
        function count_D_P(const acc : nat * nat; const i : nat * nat): (nat * nat) is
          block {
            const ret = acc.0 * acc.1 / (i.1 * tokens_count);
            } with (ret, acc.1);
        const (d_P_n, d_n) = Map.fold(count_D_P, _xp, (_d_P, d));
        _d_P := d_P_n;
        d := d_n;
        d := (                  a_nn * sum_c / _C_a_precision + _d_P * tokens_count) * d / (
              abs(a_nn - _C_a_precision) * d / _C_a_precision + (tokens_count + 1n) * _d_P ); (* Equality with the precision of 1 *)
      };
  } with d

function _get_D_mem(const _balances: map(nat, nat); const _amp: nat; const s: pair_type): nat is
  get_D(_xp_mem(_balances, s), _amp, s);

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
  const s     : pair_type
)             : nat is
  block {
    const tokens_count = Map.size(s.reserves);
    var _y_prev: nat := 0n;
    c := c * d * _C_a_precision / (a_nn * tokens_count);

    const b: nat = s_ + d * _C_a_precision / a_nn;
    var y: nat := d;

    while abs(y - _y_prev) > 1n
      block {
        _y_prev := y;
        y := (y * y + c) / abs(2 * y + b - d);
      }
  } with y

function get_y(
  const i : nat;
  const j : nat;
  const x : nat;
  const xp: map(nat, nat);
  const s : pair_type
)         : nat is
  block {
    const tokens_count = Map.size(s.reserves);
    (* x in the input is converted to the same price/precision *)

    assert(i =/= j);               (* dev: same coin *)
    assert(j >= 0n);               (* dev: j below zero *)
    assert(j < tokens_count);   (* dev: j above N_COINS *)

    (* should be unreachable, but good for safety *)

    assert(i >= 0n);
    assert(i < tokens_count);

    const amp   : nat = _A(s);
    const a_nn  : nat = amp * tokens_count;
    const d     : nat = get_D(xp, amp, s);
    var   s_    : nat := 0n;
    var   _x    : nat := 0n;
    var   c     : nat := d;

    for _i := 0 to int(tokens_count)
      block {
        const iter: nat = abs(_i);
        if iter =/= j
          then {
          if iter = i
            then _x := x
          else _x := case xp[iter] of
                    Some(val) -> val
                  | None -> (failwith("no such index"): nat)
                  end;
          s_ := s_ + _x;
          c := c * d / (_x * tokens_count);
        }
        else skip;
      };
  } with calc_y(c, a_nn, s_, d, s)

function _get_y_D(
  const amp : nat;
  const i   : nat;
  const _xp : map(nat, nat);
  const d   : nat;
  const s   : pair_type)
            : nat is
  block {
    (*"""
    Calculate x[i] if one reduces D from being calculated for xp to D
    Done by solving quadratic equation iteratively.
    x_1**2 + x_1 * (sum' - (A*n**n - 1) * D / (A * n**n)) = D ** (n + 1) / (n ** (2 * n) * prod' * A)
    x_1**2 + b*x_1 = c
    x_1 = (x_1**2 + c) / (2*x_1 + b)
    """
    # x in the input is converted to the same price/precision
    *)

    const tokens_count = Map.size(s.reserves);

    assert(i >= 0n); // dev: i below zero
    assert(i < tokens_count);  // dev: i above N_COINS

    const a_nn  : nat = amp * tokens_count;
    var   s_    : nat := 0n;
    var   _x    : nat := 0n;
    var   c     : nat := d;

    for _i := 0 to int(tokens_count)
      block {
        const iter: nat = abs(_i);
        if iter =/= i
          then {
            _x := case _xp[iter] of
                  | Some(val) -> val
                  | None -> (failwith("no such index"): nat)
                  end;
            s_ := s_ + _x;
            c := c * d / (_x * tokens_count);
        }
        else skip;
      }
  } with calc_y(c, a_nn, s_, d, s)


function _calc_withdraw_one_coin(
    const _token_amount: nat;
    const i: nat;
    const pair_id: nat;
    const s: storage_type
  ): (nat * nat * nat) is
  block {
    (*  First, need to calculate
     *  Get current D
     *  Solve Eqn against y_i for D - _token_amount
     *)
    const pair          : pair_type = get_pair(pair_id, s);
    const tokens_count = Map.size(pair.reserves);
    const amp           : nat = _A(pair);
    const xp            : map(nat, nat) = _xp(pair);
    const d0            : nat = get_D(xp, amp, pair);
    const total_supply  : nat = pair.total_supply;
    const d1            : nat = abs(d0 - (_token_amount * d0 / total_supply));
    const new_y         : nat = _get_y_D(amp, i, xp, d1, pair);
    var   base_fee      : nat := sum_all_fee(pair) * tokens_count / (4n * abs(tokens_count - 1n)); (* TODO:changethis to correct fee calc *)
    var xp_reduced      : map(nat, nat) := map[];
    for key -> value in map xp
      block {
        var dx_expected: nat := 0n;
        if key = i
          then dx_expected := value * d1 / abs(d0 - new_y);
        else   dx_expected := abs(value - value * d1) / d0;
        const tok_fee = base_fee * dx_expected / _C_fee_denominator;
        xp_reduced[key] := abs(value - tok_fee);
      };
    // function reduce_Xp(const key: nat; const value: nat): nat is
    //   block {
    //     var dx_expected: nat := 0n;
    //     if j = i
    //       then dx_expected := value * d1 / abs(d0 - new_y);
    //     else   dx_expected := abs(value - value * d1) / d0;
    //     const tok_fees = calc_fee(dx_expected);
    //     const total_tok_fee = tok_fees.0 * s.tokens_count / (4n * abs(s.tokens_count - 1));
    //     fee[key] := record [
    //       lp_fee      = tok_fees.1.lp_fee      * s.tokens_count / (4n * abs(s.tokens_count - 1));
    //       stakers_fee = tok_fees.1.stakers_fee * s.tokens_count / (4n * abs(s.tokens_count - 1));
    //       ref_fee     = tok_fees.1.ref_fee     * s.tokens_count / (4n * abs(s.tokens_count - 1));
    //       dev_fee     = tok_fees.1.dev_fee     * s.tokens_count / (4n * abs(s.tokens_count - 1));
    //     ];
    //     const ret_value = abs(value - total_tok_fee);
    //   } with ret_value;
    // var xp_reduced      : map(nat, nat) := Map.map(reduce_Xp, xp);
    const xp_red_i = case xp_reduced[i] of
      | Some(value) -> value
      | None -> (failwith("no such index"): nat)
      end;
    var dy: nat := abs(xp_red_i - _get_y_D(amp, i, xp_reduced, d1, pair));
    var precisions: map(nat, nat) := pair.token_rates;
    const precisions_i = case precisions[i] of
      | Some(value) -> value
      | None -> (failwith("no such index"): nat)
      end;
    const xp_i = case xp[i] of
      | Some(value) -> value
      | None -> (failwith("no such index"): nat)
      end;
    dy := abs(dy - 1) / precisions_i;  //# Withdraw less to account for rounding errors
    const dy_0: nat = abs(xp_i - new_y) / precisions_i;  //# w/o s.fee
  } with (dy, abs(dy_0 - dy), total_supply)

  // function apply_invest_fee(
  //   const referral  : address;
  //   const pair_id   : pool_id_type;
  //   const i         : token_pool_index;
  //   const difference: nat;
  //   var new_balance : nat;
  //   var s           : storage_type
  // )                 : (nat * storage_type) is
  //   block {
  //     var pair : pair_type := get_pair(pair_id, s);
  //     const initial_reserves = case pair.virtual_reserves[i] of
  //         Some(val) -> val
  //       | None -> (failwith("no such index"): nat)
  //       end;
  //     const fee_all = difference * sum_all_fee(pair);
  //     const fee_wo_lp = difference * sum_wo_lp_fee(pair);
  //     const dev_fee = difference * pair.fee.dev_fee;
  //     const stakers_fee = difference * pair.fee.stakers_fee;
  //     const referral_fee = difference * pair.fee.ref_fee;
  //     const token = get_token_by_id(i, pair_id, s);
  //     const new_reserves = abs(new_balance - fee_wo_lp / _C_fee_denominator);
  //     new_balance := abs(new_balance - fee_all  / _C_fee_denominator);
  //     pair.virtual_reserves[i] := new_reserves;
  //     pair.reserves[i] := case pair.reserves[i] of
  //         Some(reserve) -> reserve + abs(new_reserves - initial_reserves)
  //       | None -> abs(new_reserves - initial_reserves)
  //       end;
  //     s.dev_rewards[token] := case s.dev_rewards[token] of
  //         Some(rewards) -> rewards + dev_fee
  //       | None -> (dev_fee: nat)
  //       end;
  //     const ref_key: address * pool_id_type = (referral, pair_id);
  //     var ref_rew : rewards_type := case s.referral_rewards[ref_key] of
  //         Some(reward_map) -> reward_map
  //       | None -> (map []: rewards_type)
  //       end;
  //     ref_rew[i] := case ref_rew[i] of
  //         Some(reward) -> reward + referral_fee
  //       | None -> (referral_fee: nat)
  //       end;
  //     s.referral_rewards[ref_key] := ref_rew;
  //     pair.staker_accumulator[i] := case pair.staker_accumulator[i] of
  //         Some(val) -> val + stakers_fee
  //       | None -> (stakers_fee: nat)
  //       end;
  //     s.pools[pair_id] := pair;
  //   } with (new_balance, s)

function get_default_refer(const s: storage_type): address is s.default_referral

function preform_swap(
  const i: token_pool_index;
  const j: token_pool_index;
  const dx: nat;
  const pair: pair_type): nat is
  block {
    const xp = _xp(pair);
    const xp_i = case xp[i] of
      | Some(value) -> value
      | None -> (failwith("no such index"): nat)
      end;
    const xp_j = case xp[j] of
      | Some(value) -> value
      | None -> (failwith("no such index"): nat)
      end;
    const rate_i = case pair.token_rates[i] of
      | Some(value) -> value
      | None -> (failwith("no such index"): nat)
      end;
    const rate_j = case pair.token_rates[j] of
      | Some(value) -> value
      | None -> (failwith("no such index"): nat)
      end;
    const x = xp_i + dx * rate_i / _C_precision;
    const y = get_y(i, j, x, xp, pair);
    const dy = abs(xp_j - y - 1);  // -1 just in case there were some rounding errors
  } with dy * _C_precision / rate_j