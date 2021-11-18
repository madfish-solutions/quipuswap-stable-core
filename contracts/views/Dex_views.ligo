
(* 15n tokens per pool info *)
[@inline]
function get_tokens_info(
  const p               : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    var operations: list(operation) := CONSTANTS.no_operations;
    case p of
      GetTokensInfo(params) -> {
      const pair : pair_type = unwrap(s.pools[params.pair_id], ERRORS.pair_not_listed);
      operations := Tezos.transaction(pair.tokens_info, 0tez, params.receiver) # operations;
      }
    | _ -> skip
    end;
  } with (operations, s)

// (* tokens per 1 pair's share *)
// function get_tok_per_share(
//   const _params          : nat;
//   const s               : full_storage_type)
//                         : full_return_type is
//   (CONSTANTS.no_operations, s)

// (* min received in the swap *)
// function get_min_received(
//   const params          : min_received_type;
//   const s               : full_storage_type)
//                         : full_return_type is
//   block {
//     const pair : pair_type = get_pair(params.pair_id, s.storage.pools);
//     const xp: map(nat, nat) = _xp(pair);
//     const y = get_y(params.i, params.j, params.x, xp, pair);
//     const xp_j = case xp[params.j] of
//       | Some(value) -> value
//       | None -> (failwith("no such index") : nat)
//       end;
//     var dy := nat_or_error(xp_j - y - 1, "y>xp_j");
//     const dy_fee = sum_all_fee(pair) * dy / CONSTANTS.fee_denominator;

//     const rate_j = case pair.token_rates[params.j] of
//       | Some(value) -> value
//       | None -> (failwith("no such index") : nat)
//       end;
//     dy := nat_or_error(dy - dy_fee, "dy_fee>dy") * CONSTANTS.precision / rate_j;
//   } with (list [Tezos.transaction(dy, 0tez, params.receiver)], s)


// (* max defi rate *)
// [@inline]
// function get_max_defi_rate(
//   const params          : max_rate_params;
//   const s               : full_storage_type)
//                         : full_return_type is
//   block {
//     const pair : pair_type = get_pair(params.pair_id, s.storage.pools);
//     function count_limits(const key:nat; const value:nat): nat is
//       block {
//         const bal : nat = case pair.virtual_reserves[key] of
//           | Some(balc) -> balc
//           | None -> (failwith("no such balance") : nat)
//           end;
//         const ret = bal * value / CONSTANTS.rate_precision;
//       } with ret
//   } with (list [Tezos.transaction(Map.map(count_limits, pair.proxy_limits), 0tez, params.receiver)], s)


(* Calculate the amount received when withdrawing a single coin *)
[@inline]
function calc_withdraw_one_coin(
  const params          : calc_w_one_c_params;
  const s               : full_storage_type)
                        : full_return_type is
  block {
    const pair : pair_type = unwrap(s.storage.pools[params.pair_id], ERRORS.pair_not_listed);
    const amp : nat =  _A(
      pair.initial_A_time,
      pair.initial_A,
      pair.future_A_time,
      pair.future_A
    );
    const result = _calc_withdraw_one_coin(
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
  const p               : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    var operations: list(operation) := CONSTANTS.no_operations;
    case p of
      GetDy(params) -> {
        const pair : pair_type = unwrap(s.pools[params.pair_id], ERRORS.pair_not_listed);
        const xp: map(nat, nat) = _xp(pair);
        const xp_i = unwrap(xp[params.i], ERRORS.wrong_index);
        const xp_j = unwrap(xp[params.j], ERRORS.wrong_index);
        const token_info_i = unwrap(pair.tokens_info[params.i], ERRORS.wrong_index);
        const token_info_j = unwrap(pair.tokens_info[params.j], ERRORS.wrong_index);
        const x: nat = xp_i + (params.dx * token_info_i.rate / CONSTANTS.precision);
        const y: nat = get_y(params.i, params.j, x, xp, pair);
        const dy: nat = nat_or_error(xp_j - y - 1, "y>xp_j") * CONSTANTS.precision / token_info_j.rate;
        const fee: nat = sum_all_fee(pair.fee) * dy / CONSTANTS.fee_denominator;
        operations := Tezos.transaction((nat_or_error(dy - fee, "fee>dy")), 0tez, params.receiver) # operations;
      }
    | _ -> skip
    end;
  } with (operations, s)

(* 20n Get A constant *)
[@inline]
function get_A(
  const p               : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    var operations: list(operation) := CONSTANTS.no_operations;
    case p of
      GetA(params) -> {
      const pair : pair_type = unwrap(s.pools[params.pair_id], ERRORS.pair_not_listed);
      operations := Tezos.transaction(_A(
        pair.initial_A_time,
        pair.initial_A,
        pair.future_A_time,
        pair.future_A
      ) / CONSTANTS.a_precision, 0tez, params.receiver) # operations;
    }
    | _ -> skip
    end;
  } with (operations, s)

(* 17n Fees *)
[@inline]
function get_fees(
  const p               : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    var operations: list(operation) := CONSTANTS.no_operations;
    case p of
      GetFees(params) -> {
      const pair : pair_type = unwrap(s.pools[params.pool_id], ERRORS.pair_not_listed);
      operations := Tezos.transaction(pair.fee, 0tez, params.receiver) # operations;
     }
    | _ -> skip
    end;
  } with (operations, s)