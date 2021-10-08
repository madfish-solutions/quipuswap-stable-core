(* Contract admin check *)
[@inline]
function is_admin(const s: storage_type): unit is
  if Tezos.sender =/= s.admin
    then failwith(err_not_contract_admin)
  else Unit;

// (* Dex admin check *)
// [@inline]
// function is_dex_admin(const s: pair_type): unit is
//   if Tezos.sender =/= s.exchange_admin
//     then failwith(err_not_admin)
//   else Unit;


function calc_fee(
  var value   : nat;
  const s     : storage_type
)             : nat * fees_storage_type is
  block {
    const fees: fees_storage_type = record [
      lp_fee      = value * s.fee.lp_fee      / _C_fee_denominator;
      stakers_fee = value * s.fee.stakers_fee / _C_fee_denominator;
      ref_fee     = value * s.fee.ref_fee     / _C_fee_denominator;
      dev_fee     = value * s.fee.dev_fee     / _C_fee_denominator;
    ];
    const sum_fee : nat =   fees.lp_fee
                          + fees.stakers_fee
                          + fees.ref_fee
                          + fees.dev_fee;
  } with (sum_fee, fees)

function _xp_mem(const _balances: map(nat, nat); const s: pair_type): map(nat, nat) is
  block {
    function count_result(const key: nat; const value: nat): nat is
      block {
        const bal: nat = case _balances[key] of
          | Some(bal) -> bal
          | None -> failwith("balance not provided")
          end;
      } with value * bal / _C_precision;
  } with Map.map(count_result, s.token_rates);

function _xp(const s: pair_type): map(nat, nat) is _xp_mem(s.pools, s);

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

(*
  D invariant calculation in non-overflowing integer operations iteratively

  A * sum(x_i) * n**n + D = A * D * n**n + D**(n+1) / (n**n * prod(x_i))

    Converging solution:

    D[j+1] = (A * n**n * sum(x_i) - D[j]**(n+1) / (n**n prod(x_i))) / (A * n**n - 1)
*)
function get_D(const _xp: map(nat, nat); const _amp: nat; const s: pair_type): nat is
  block {
    function sum(const acc : nat; const i : nat * nat): nat is acc + i.1;

    var sum_c: nat := Map.fold(sum, _xp, 0n);
    var _d_prev: nat := 0n;

    if sum_c = 0n
      then failwith(err_zero_in)
    else skip;

    var d: nat := sum_c;
    const a_nn: nat = _amp * s.tokens_count;

    while abs(d - _d_prev) > 1n
      block {
        _d_prev := d;
        // function count_D_P(const acc : nat; const i : nat * nat): nat is
        //   block {
        //     const ret = acc * d / (i.1 * s.tokens_count);
        //     } with ret;
        // var d_P: nat := Map.fold(count_D_P, _xp, d);
        var d_P: nat := d;
        for _key -> value in map _xp
          block {
            d_P := d_P * d / (value * s.tokens_count)
          };
        d := (a_nn * sum_c / _C_a_precision + d_P * s.tokens_count) * d / (
              abs(a_nn - _C_a_precision) * d / _C_a_precision + (s.tokens_count + 1n) * d_P
              ); (* Equality with the precision of 1 *)
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
    var _y_prev: nat := 0n;
    c := c * d * _C_a_precision / (a_nn * s.tokens_count);

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

    (* x in the input is converted to the same price/precision *)

    assert(i =/= j);               (* dev: same coin *)
    assert(j >= 0n);               (* dev: j below zero *)
    assert(j < s.tokens_count);   (* dev: j above N_COINS *)

    (* should be unreachable, but good for safety *)

    assert(i >= 0n);
    assert(i < s.tokens_count);

    const amp   : nat = _A(s);
    const a_nn  : nat = amp * s.tokens_count;
    const d     : nat = get_D(xp, amp, s);
    var   s_    : nat := 0n;
    var   _x    : nat := 0n;
    var   c     : nat := d;

    for _i := 0 to int(s.tokens_count)
      block {
        const iter: nat = abs(_i);
        if iter =/= j
          then {
          if iter = i
            then _x := x
          else _x := case xp[iter] of
                  | Some(val) -> val
                  | None -> (failwith("no such index"): nat)
                  end;
          s_ := s_ + _x;
          c := c * d / (_x * s.tokens_count);
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

    assert(i >= 0n); // dev: i below zero
    assert(i < s.tokens_count);  // dev: i above N_COINS

    const a_nn  : nat = amp * s.tokens_count;
    var   s_    : nat := 0n;
    var   _x    : nat := 0n;
    var   c     : nat := d;

    for _i := 0 to int(s.tokens_count)
      block {
        const iter: nat = abs(_i);
        if iter =/= i
          then {
            _x := case _xp[iter] of
                  | Some(val) -> val
                  | None -> (failwith("no such index"): nat)
                  end;
            s_ := s_ + _x;
            c := c * d / (_x * s.tokens_count);
        }
        else skip;
      }
  } with calc_y(c, a_nn, s_, d, s)


function _calc_withdraw_one_coin(
    const _token_amount: nat;
    const i: nat;
    const pair_id: nat;
    const s: storage_type
  ): (nat * map(nat, fees_storage_type) * nat) is
  block {
    (*  First, need to calculate
     *  Get current D
     *  Solve Eqn against y_i for D - _token_amount
     *)
    const pair          : pair_type = get_pair(pair_id, s);
    const amp           : nat = _A(pair);
    const xp            : map(nat, nat) = _xp(pair);
    const d0            : nat = get_D(xp, amp, pair);
    const total_supply  : nat = pair.total_supply;
    const d1            : nat = abs(d0 - _token_amount * d0) / total_supply;
    const new_y         : nat = _get_y_D(amp, i, xp, d1, pair);
    var   fee           : map(nat, fees_storage_type) := map[]; (* TODO:changethis to correct fee calc *)
    var xp_reduced      : map(nat, nat) := map[];
    for key -> value in map xp
      block {
        var dx_expected: nat := 0n;
        if key = i
          then dx_expected := value * d1 / abs(d0 - new_y);
        else   dx_expected := abs(value - value * d1) / d0;
        const tok_fees = calc_fee(dx_expected, s);
        const total_tok_fee = tok_fees.0 * pair.tokens_count / (4n * abs(pair.tokens_count - 1));
        fee[key] := record [
          lp_fee      = tok_fees.1.lp_fee      * pair.tokens_count / (4n * abs(pair.tokens_count - 1));
          stakers_fee = tok_fees.1.stakers_fee * pair.tokens_count / (4n * abs(pair.tokens_count - 1));
          ref_fee     = tok_fees.1.ref_fee     * pair.tokens_count / (4n * abs(pair.tokens_count - 1));
          dev_fee     = tok_fees.1.dev_fee     * pair.tokens_count / (4n * abs(pair.tokens_count - 1));
        ];
        xp_reduced[key] := abs(value - total_tok_fee);
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
    // const xp_i = case xp[i] of
    //   | Some(value) -> value
    //   | None -> (failwith("no such index"): nat)
    //   end;
    dy := abs(dy - 1) / precisions_i;  //# Withdraw less to account for rounding errors
    // const dy_0: nat = abs(xp_i - new_y) / precisions_i;  //# w/o fees
  } with (dy, fee, total_supply)