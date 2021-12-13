
(* 15n tokens per pool info *)
[@inline]
function get_tokens_info(
  const p               : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var operations: list(operation) := Constants.no_operations;
    case p of
      Get_tokens_info(params) -> {
      const pair : pair_t = unwrap(s.pools[params.pair_id], Errors.pair_not_listed);
      operations := Tezos.transaction(pair.tokens_info, 0tez, params.receiver) # operations;
      }
    | _ -> skip
    end;
  } with (operations, s)

// (* tokens per 1 pair's share *)
// function get_tok_per_share(
//   const _params          : nat;
//   const s               : full_storage_t)
//                         : full_return_t is
//   (Constants.no_operations, s)

// (* min received in the swap *)
// function get_min_received(
//   const params          : min_received_v_prm_t;
//   const s               : full_storage_t)
//                         : full_return_t is
//   block {
//     const pair : pair_t = get_pair(params.pair_id, s.storage.pools);
//     const xp: map(nat, nat) = _xp(pair);
//     const y = get_y(params.i, params.j, params.x, xp, pair);
//     const xp_j = case xp[params.j] of
//       | Some(value) -> value
//       | None -> (failwith("no such index") : nat)
//       end;
//     var dy := nat_or_error(xp_j - y - 1, "y>xp_j");
//     const dy_fee = sum_all_fee(pair) * dy / Constants.fee_denominator;

//     const rate_j = case pair.token_rates[params.j] of
//       | Some(value) -> value
//       | None -> (failwith("no such index") : nat)
//       end;
//     dy := nat_or_error(dy - dy_fee, "dy_fee>dy") * Constants.precision / rate_j;
//   } with (list [Tezos.transaction(dy, 0tez, params.receiver)], s)


// (* max defi rate *)
// [@inline]
// function get_max_defi_rate(
//   const params          : max_rate_v_prm_t;
//   const s               : full_storage_t)
//                         : full_return_t is
//   block {
//     const pair : pair_t = get_pair(params.pair_id, s.storage.pools);
//     function count_limits(const key:nat; const value:nat): nat is
//       block {
//         const bal : nat = case pair.virtual_reserves[key] of
//           | Some(balc) -> balc
//           | None -> (failwith("no such balance") : nat)
//           end;
//         const ret = bal * value / Constants.rate_precision;
//       } with ret
//   } with (list [Tezos.transaction(Map.map(count_limits, pair.proxy_limits), 0tez, params.receiver)], s)


(* Calculate the amount received when withdrawing a single coin *)
[@inline]
function calc_withdraw_one_coin_view(
  const params          : calc_w_one_c_v_prm_t;
  const s               : full_storage_t)
                        : full_return_t is
  block {
    const pair : pair_t = unwrap(s.storage.pools[params.pair_id], Errors.pair_not_listed);
    const amp : nat =  get_A(
      pair.initial_A_time,
      pair.initial_A,
      pair.future_A_time,
      pair.future_A
    );
    const result = calc_withdraw_one_coin(
      amp,
      params.token_amount,
      params.i,
      pair
    );
  } with (list [
    Tezos.transaction(
      result.dy,
      0tez,
      params.receiver
    )
  ], s)

(* 19n Calculate the current output dy given input dx *)
[@inline]
function get_dy(
  const p               : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var operations: list(operation) := Constants.no_operations;
    case p of
      Get_dy(params) -> {
        const pair : pair_t = unwrap(s.pools[params.pair_id], Errors.pair_not_listed);
        const xp: map(nat, nat) = xp(pair);
        const xp_i = unwrap(xp[params.i], Errors.wrong_index);
        const xp_j = unwrap(xp[params.j], Errors.wrong_index);
        const token_info_i = unwrap(pair.tokens_info[params.i], Errors.wrong_index);
        const token_info_j = unwrap(pair.tokens_info[params.j], Errors.wrong_index);
        const x: nat = xp_i + (params.dx * token_info_i.rate / Constants.precision);
        const y: nat = get_y(params.i, params.j, x, xp, pair);
        const dy: nat = nat_or_error(xp_j - y - 1, "y>xp_j") * Constants.precision / token_info_j.rate;
        const fee: nat = sum_all_fee(pair.fee) * dy / Constants.fee_denominator;
        operations := Tezos.transaction((nat_or_error(dy - fee, "fee>dy")), 0tez, params.receiver) # operations;
      }
    | _ -> skip
    end;
  } with (operations, s)

(* 20n Get A constant *)
[@inline]
function get_A_view(
  const p               : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var operations: list(operation) := Constants.no_operations;
    case p of
      Get_A(params) -> {
      const pair : pair_t = unwrap(s.pools[params.pair_id], Errors.pair_not_listed);
      operations := Tezos.transaction(get_A(
        pair.initial_A_time,
        pair.initial_A,
        pair.future_A_time,
        pair.future_A
      ) / Constants.a_precision, 0tez, params.receiver) # operations;
    }
    | _ -> skip
    end;
  } with (operations, s)

(* 17n Fees *)
[@inline]
function get_fees(
  const p               : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var operations: list(operation) := Constants.no_operations;
    case p of
      Get_fees(params) -> {
      const pair : pair_t = unwrap(s.pools[params.pool_id], Errors.pair_not_listed);
      operations := Tezos.transaction(pair.fee, 0tez, params.receiver) # operations;
     }
    | _ -> skip
    end;
  } with (operations, s)