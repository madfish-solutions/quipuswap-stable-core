(* Contract admin check *)
function is_admin(const admin: address): unit is
  assert_with_error(
    Tezos.sender = admin,
    ERRORS.not_contract_admin);

(* Contract admin or dev check *)
function is_admin_or_dev(const admin: address; const dev: address): unit is
  assert_with_error(
    Tezos.sender = admin or Tezos.sender = dev,
    ERRORS.not_contract_admin);

function get_staker_acc(
  const stkr_key: (address * pool_id_type);
  const stkr_bm : big_map((address * pool_id_type), staker_info_type)
  )             : staker_info_type is
  case (stkr_bm[stkr_key]: option(staker_info_type)) of
  | Some(acc) -> acc
  | None -> (
      record [
        balance   = 0n;
        earnings  = (map []: map(token_pool_index, acc_reward_type));
      ]
      : staker_info_type
    )
  end;

function sum_all_fee(
  const fee   : fees_storage_type
)             : nat is
  fee.lp_fee
  + fee.stakers_fee
  + fee.ref_fee
  + fee.dev_fee;

function sum_wo_lp_fee(
  const fee   : fees_storage_type
)             : nat is
  fee.stakers_fee
  + fee.ref_fee
  + fee.dev_fee;

function perform_fee_slice(
    const dy            : nat;
    const fee           : fees_storage_type;
    const total_staked  : nat
  )                     : nat * nat * nat * nat is
  block {
    var new_dy := dy;

    const to_ref = dy * fee.ref_fee / CONSTANTS.fee_denominator;
    const to_dev = dy * fee.dev_fee / CONSTANTS.fee_denominator;
    var to_prov := dy * fee.lp_fee / CONSTANTS.fee_denominator;

    var to_stakers := 0n;
    if (total_staked =/= 0n)
      then to_stakers := dy * fee.stakers_fee / CONSTANTS.fee_denominator;
    else to_prov := to_prov + dy * fee.stakers_fee / CONSTANTS.fee_denominator;

    new_dy := nat_or_error(new_dy - to_prov - to_ref - to_dev - to_stakers, "Fee is too large");
  } with (new_dy, to_ref, to_dev, to_stakers)

function _xp_mem(const tokens_info : map(token_pool_index, token_info_type)): map(token_pool_index, nat) is
  block {
    function count_result(const _key: nat; var token_info: token_info_type): nat is
      (token_info.rate * token_info.virtual_reserves) / CONSTANTS.precision;
  } with Map.map(count_result, tokens_info);

function _xp(const s: pair_type): map(nat, nat) is _xp_mem(s.tokens_info);

(* Handle ramping A up or down *)
function _A(
  const t0 : timestamp;
  const a0 : nat;
  const t1 : timestamp;
  const a1 : nat)
                      : nat is
  block {
    var result: nat := 0n;
    if Tezos.now < t1
      then {
        result := (
          abs(a0 + (a1 - a0)) *
          nat_or_error(Tezos.now - t0, "Time error")
          ) / nat_or_error(t1 - t0, "Time error");
      }
    else result := a1;
  } with result

(* Gets token count by size of reserves map *)
[@inline]
function get_token_by_id(
    const token_id  : token_pool_index;
    const map_entry : option(tokens_type)
  )                 : token_type is
  block {
    const tokens = case map_entry of
    | Some(tokens) -> tokens
    | None -> (failwith(ERRORS.pair_not_listed): tokens_type)
    end;
    const token = case tokens[token_id] of
    | Some(token) -> token
    | None -> (failwith("wrong_id"): token_type)
    end;
   } with token;

(*
  D invariant calculation in non-overflowing integer operations iteratively

  A * sum(x_i) * n**n + D = A * D * n**n + D**(n+1) / (n**n * prod(x_i))

    Converging solution:

    D[j+1] = (A * n**n * sum(x_i) - D[j]**(n+1) / (n**n prod(x_i))) / (A * n**n - 1)
*)
function get_D(const _xp: map(nat, nat); const _amp: nat; const total_supply: nat): nat is
  block {
    function sum(const acc : nat; const i : nat * nat): nat is acc + i.1;

    var sum_c: nat := Map.fold(sum, _xp, 0n);
    var _d_prev: nat := 0n;

    assert_with_error(
      sum_c =/= 0n or total_supply = 0n,
      ERRORS.zero_in);

    var d: nat := sum_c;
    const tokens_count = Map.size(_xp);
    const a_nn: nat = _amp * tokens_count;

    while abs(d - _d_prev) > 1n
      block {
        var _d_P := d;
        _d_prev := d;
        function count_D_P(const acc : nat * nat; const i : nat * nat): (nat * nat) is
          (acc.0 * acc.1 / (i.1 * tokens_count), acc.1);
        const (d_P_n, d_n) = Map.fold(count_D_P, _xp, (_d_P, d));
        _d_P := d_P_n;
        d := d_n; // ????
        d := (a_nn * sum_c / CONSTANTS.a_precision + _d_P * tokens_count) * d / (
          nat_or_error(a_nn - CONSTANTS.a_precision, "Precision_err") * d / CONSTANTS.a_precision + (tokens_count + 1n) * _d_P ); (* Equality with the precision of 1 *)
      };
  } with d

function _get_D_mem(const tokens_info : map(token_pool_index, token_info_type); const _amp: nat; const total_supply: nat): nat is
  get_D(_xp_mem(tokens_info), _amp, total_supply);

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
    const tokens_count = Map.size(s.tokens_info);
    var _y_prev: nat := 0n;
    c := c * d * CONSTANTS.a_precision / (a_nn * tokens_count);

    const b: nat = s_ + d * CONSTANTS.a_precision / a_nn;
    var y: nat := d;

    while abs(y - _y_prev) > 1n
      block {
        _y_prev := y;
        y := (y * y + c) / nat_or_error(2 * y + b - d, "y_denom_non_nat");
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
    const tokens_count = Map.size(s.tokens_info);
    (* x in the input is converted to the same price/precision *)

    assert(i =/= j);               (* dev: same coin *)
    assert(j >= 0n and j < tokens_count);               (* dev: j below zero *)

    (* should be unreachable, but good for safety *)

    assert(i >= 0n and i < tokens_count);

    const amp   : nat = _A(
      s.initial_A_time,
      s.initial_A,
      s.future_A_time,
      s.future_A
    );
    const a_nn  : nat = amp * tokens_count;
    const d     : nat = get_D(xp, amp, s.total_supply);

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
          if _x = 0n
            then failwith("_x = 0n")
          else skip;
          acc.s_ := acc.s_ + _x;
          acc.c := acc.c * d / (_x * tokens_count);
        }
        else skip;
    } with acc;

    const res = Map.fold(prepare_params, xp, record[
        s_  = 0n;
        c   = d;
      ])

    // for _i := 0 to (tokens_count - 1)
    //   block {
    //     const iter: nat = nat_or_error(_i, "index_not_nat");
    //     if iter =/= j
    //       then {
    //       if iter = i
    //         then _x := x
    //       else _x := case xp[iter] of
    //                 Some(val) -> val
    //               | None -> (failwith("no such xp[iter] index"): nat)
    //               end;
    //       s_ := s_ + _x;
    //       c := c * d / (_x * tokens_count);
    //     }
    //     else skip;
    //   };
  } with calc_y(res.c, a_nn, res.s_, d, s)

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

    const res = Map.fold(prepare_params, _xp, record[
        s_  = 0n;
        c   = d;
      ]);
  } with calc_y(res.c, a_nn, res.s_, d, s)


// function _calc_withdraw_one_coin(
//     const _token_amount: nat;
//     const i: nat;
//     const pair_id: nat;
//     const s: storage_type
//   ): (nat * nat * nat) is
//   block {
//     (*  First, need to calculate
//      *  Get current D
//      *  Solve Eqn against y_i for D - _token_amount
//      *)
//     const pair          : pair_type = get_pair(pair_id, s.pools);
//     const tokens_count = Map.size(pair.tokens_info);
//     const amp           : nat = _A(
//       pair.initial_A_time,
//       pair.initial_A,
//       pair.future_A_time,
//       pair.future_A
//     );
//     const xp            : map(nat, nat) = _xp(pair);
//     const d0            : nat = get_D(xp, amp, pair.total_supply);
//     const total_supply  : nat = pair.total_supply;
//     const d1            : nat = nat_or_error(d0 - (_token_amount * d0 / total_supply), "d1_less_0n");
//     const new_y         : nat = _get_y_D(amp, i, xp, d1, pair);
//     var   base_fee      : nat := sum_all_fee(pair) * tokens_count / (
//         4n * nat_or_error(tokens_count - 1n, "tokens_less_1n")
//       ); (* TODO:changethis to correct fee calc *)
//     var xp_reduced      : map(nat, nat) := map[];
//     for key -> value in map xp
//       block {
//         var dx_expected: nat := 0n;
//         if key = i
//           then dx_expected := nat_or_error((value * d1 / d0) - new_y, "dx_exp_lower_0n");
//         else   dx_expected := nat_or_error(value - (value * d1 / d0), "dx_exp_lower_0n");
//         const tok_fee = base_fee * dx_expected / CONSTANTS.fee_denominator;
//         xp_reduced[key] := nat_or_error(value - tok_fee, "fee_more_value");
//       };
//     // function reduce_Xp(const key: nat; const value: nat): nat is
//     //   block {
//     //     var dx_expected: nat := 0n;
//     //     if j = i
//     //       then dx_expected := value * d1 / abs(d0 - new_y);
//     //     else   dx_expected := abs(value - value * d1) / d0;
//     //     const tok_fees = calc_fee(dx_expected);
//     //     const total_tok_fee = tok_fees.0 * s.tokens_count / (4n * abs(s.tokens_count - 1));
//     //     fee[key] := record [
//     //       lp_fee      = tok_fees.1.lp_fee      * s.tokens_count / (4n * abs(s.tokens_count - 1));
//     //       stakers_fee = tok_fees.1.stakers_fee * s.tokens_count / (4n * abs(s.tokens_count - 1));
//     //       ref_fee     = tok_fees.1.ref_fee     * s.tokens_count / (4n * abs(s.tokens_count - 1));
//     //       dev_fee     = tok_fees.1.dev_fee     * s.tokens_count / (4n * abs(s.tokens_count - 1));
//     //     ];
//     //     const ret_value = abs(value - total_tok_fee);
//     //   } with ret_value;
//     // var xp_reduced      : map(nat, nat) := Map.map(reduce_Xp, xp);
//     const xp_red_i = case xp_reduced[i] of
//       | Some(value) -> value
//       | None -> (failwith("no such xp_reduced[i] index"): nat)
//       end;
//     var dy: nat := nat_or_error(xp_red_i - _get_y_D(amp, i, xp_reduced, d1, pair), "dy_less_0n");
//     var precisions: map(nat, nat) := pair.precision_multipliers;
//     const precisions_i = case precisions[i] of
//       | Some(value) -> value
//       | None -> (failwith("no such precisions[i] index"): nat)
//       end;
//     const xp_i = case xp[i] of
//       | Some(value) -> value
//       | None -> (failwith("no such xp[i] index"): nat)
//       end;
//     dy := nat_or_error(dy - 1, "dy_less_0n") / precisions_i;  //# Withdraw less to account for rounding errors
//     const dy_0: nat = nat_or_error(xp_i - new_y, "new_y_gt_xp_i") / precisions_i;  //# w/o s.fee
//   } with (dy, nat_or_error(dy_0 - dy, "fee_less_0n"), total_supply)

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
  //     const new_reserves = abs(new_balance - fee_wo_lp / CONSTANTS.fee_denominator);
  //     new_balance := abs(new_balance - fee_all  / CONSTANTS.fee_denominator);
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
      | None -> (failwith("no such xp[i] index"): nat)
      end;
    const xp_j = case xp[j] of
      | Some(value) -> value
      | None -> (failwith("no such xp[j] index"): nat)
      end;
    const rate_i = case pair.tokens_info[i] of
      | Some(value) -> value.rate
      | None -> (failwith("no such rate[i] index"): nat)
      end;
    const rate_j = case pair.tokens_info[j] of
      | Some(value) -> value.rate
      | None -> (failwith("no such rate[j] index"): nat)
      end;
    const x = xp_i + ((dx * rate_i) / CONSTANTS.precision);
    const y = get_y(i, j, x, xp, pair);
    const dy = nat_or_error(xp_j - y - 1, "dy_less_0n");  // -1 just in case there were some rounding errors
  } with dy * CONSTANTS.precision / rate_j

  function add_liq(
    const params  : record [
                      referral: option(address);
                      pair_id :nat;
                      pair    : pair_type;
                      inputs  : map(nat, nat);
                      min_mint_amount: nat;
                    ];
    var   s       : storage_type)
                  : return_type is
  block {
    var pair : pair_type := params.pair;
    const amp = _A(
      pair.initial_A_time,
      pair.initial_A,
      pair.future_A_time,
      pair.future_A
    );

    // Initial invariant
    const d0 = _get_D_mem(pair.tokens_info, amp, pair.total_supply);
    var token_supply := pair.total_supply;
    function add_inputs(
      const key       : token_pool_index;
      var token_info  : token_info_type)
                      : token_info_type is
      block {
        const input = get_input(key, params.inputs);
        token_info.virtual_reserves := token_info.virtual_reserves + input;
        token_info.reserves := token_info.reserves + input;
      } with token_info;
    pair.tokens_info := Map.map(add_inputs, pair.tokens_info);

    const d1 = _get_D_mem(pair.tokens_info, amp, pair.total_supply);

    if(d1 <= d0)
    then failwith(ERRORS.zero_in);
    else skip;
    var mint_amount := 0n;

    if token_supply > 0n
    then {
        // Only account for fees if we are not the first to deposit
        // const fee = sum_all_fee(pair.fee) * tokens_count / (4 * (tokens_count - 1));
        // const wo_lp_fee = sum_wo_lp_fee(pair.fee) * tokens_count / (4 * (tokens_count - 1));
        // const referral: address = case (params.referral: option(address)) of
        //     Some(ref) -> ref
        //   | None -> get_default_refer(s)
        //   end;
        // s := upd.storage;
        // const d2 = _get_D_mem(new_reserves, amp, pair);
        // pair := set_reserves_from_diff(init_reserves, new_reserves, pair);
        mint_amount := token_supply * nat_or_error(d1 - d0, "d1<d0") / d0;
    }
    else {
        mint_amount := d1;  // Take the dust if there was any
    };
    assert_with_error(mint_amount >= params.min_mint_amount, ERRORS.wrong_shares_out);

    const tokens = s.tokens;
    function transfer_to_pool(const operations : list(operation); const input : nat * nat) : list(operation) is
        typed_transfer(
          Tezos.sender,
          Tezos.self_address,
          input.1,
          get_token_by_id(input.0, tokens[params.pair_id])
        ) # operations;
    pair.total_supply := pair.total_supply + mint_amount;
    const user_key = (Tezos.sender, params.pair_id);
    s.ledger[user_key] := get_account_balance(user_key, s.ledger) + mint_amount;
    s.pools[params.pair_id] := pair;
  } with (Map.fold(transfer_to_pool, params.inputs, CONSTANTS.no_operations), s)

