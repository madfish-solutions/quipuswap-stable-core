
(* reserves per pool *)
[@inline]
function get_reserves(
  const p               : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    var operations: list(operation) := no_operations;
    case p of
      Get_reserves(params) -> {
      const pair : pair_type = get_pair(params.pair_id, s);
      operations := Tezos.transaction(pair.reserves, 0tez, params.receiver) # operations;
      }
    | _ -> skip
    end;
  } with (operations, s)

(* reserves per pool *)
[@inline]
function get_virt_reserves(
  const p               : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    var operations: list(operation) := no_operations;
    case p of
      Get_virt_reserves(params) -> {
        const pair : pair_type = get_pair(params.pair_id, s);
        operations := Tezos.transaction(pair.virtual_reserves, 0tez, params.receiver) # operations;
      }
    | _ -> skip
    end;
  } with (operations, s)


(* tokens per 1 pair's share *)
function get_tok_per_share(
  const _params          : nat;
  const s               : full_storage_type)
                        : full_return_type is
  (no_operations, s)

(* price cumulative and timestamp per block *)
function get_price_cumm(
  const _params          : nat;
  const s               : full_storage_type)
                        : full_return_type is
  (no_operations, s)

(* min received in the swap *)
function get_min_received(
  const params          : min_received_type;
  const s               : full_storage_type)
                        : full_return_type is
  block {
    const pair : pair_type = get_pair(params.pair_id, s.storage);
    const xp: map(nat, nat) = _xp(pair);
    const y = get_y(params.i, params.j, params.x, xp, pair);
    const xp_j = case xp[params.j] of
      | Some(value) -> value
      | None -> (failwith("no such index") : nat)
      end;
    var dy := nat_or_error(xp_j - y - 1, "y>xp_j");
    const dy_fee = sum_all_fee(pair) * dy / _C_fee_denominator;

    const rate_j = case pair.token_rates[params.j] of
      | Some(value) -> value
      | None -> (failwith("no such index") : nat)
      end;
    dy := nat_or_error(dy - dy_fee, "dy_fee>dy") * _C_precision / rate_j;
  } with (list [Tezos.transaction(dy, 0tez, params.receiver)], s)


(* max defi rate *)
[@inline]
function get_max_defi_rate(
  const params          : max_rate_params;
  const s               : full_storage_type)
                        : full_return_type is
  block {
    const pair : pair_type = get_pair(params.pair_id, s.storage);
    function count_limits(const key:nat; const value:nat): nat is
      block {
        const bal : nat = case pair.virtual_reserves[key] of
          | Some(balc) -> balc
          | None -> (failwith("no such balance") : nat)
          end;
        const ret = bal * value / _C_rate_precision;
      } with ret
  } with (list [Tezos.transaction(Map.map(count_limits, pair.proxy_limits), 0tez, params.receiver)], s)


(* Calculate the amount received when withdrawing a single coin *)
[@inline]
function calc_withdraw_one_coin(
  const params          : calc_w_one_c_params;
  const s               : full_storage_type)
                        : full_return_type is
  block {
    const result : (nat * nat * nat) = _calc_withdraw_one_coin(
      params.token_amount,
      params.i,
      params.pair_id,
      s.storage
    );
  } with (list [
    Tezos.transaction(
      result.0,
      0tez,
      params.receiver
    )
  ], s)

(* Calculate the current output dy given input dx *)
[@inline]
function get_dy(
  const p               : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    var operations: list(operation) := no_operations;
    case p of
      Get_dy(params) -> {
        const pair : pair_type = get_pair(params.pair_id, s);
        const xp: map(nat, nat) = _xp(pair);
        const xp_i = case xp[params.i] of
          | Some(value) -> value
          | None -> (failwith("no such index") : nat)
          end;
        const xp_j = case xp[params.j] of
          | Some(value) -> value
          | None -> (failwith("no such index") : nat)
          end;
        const rates: map(nat, nat) = pair.token_rates;
        const rate_i = case rates[params.i] of
          | Some(value) -> value
          | None -> (failwith("no such index") : nat)
          end;
        const rate_j = case rates[params.j] of
          | Some(value) -> value
          | None -> (failwith("no such index") : nat)
          end;
        const x: nat = xp_i + (params.dx * rate_i / _C_precision);
        const y: nat = get_y(params.i, params.j, x, xp, pair);
        const dy: nat = nat_or_error(xp_j - y - 1, "y>xp_j") * _C_precision / rate_j;
        const fee: nat = sum_all_fee(pair) * dy / _C_fee_denominator;
        operations := Tezos.transaction((nat_or_error(dy - fee, "fee>dy")), 0tez, params.receiver) # operations;
      }
    | _ -> skip
    end;
  } with (operations, s)

(* Get A constant *)
[@inline]
function get_A(
  const p               : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    var operations: list(operation) := no_operations;
    case p of
      Get_a(params) -> {
    const pair : pair_type = get_pair(params.pair_id, s);
    operations := Tezos.transaction(_A(pair) / _C_a_precision, 0tez, params.receiver) # operations;
   }
    | _ -> skip
    end;
  } with (operations, s)

(* Fees *)
[@inline]
function get_fees(
  const p               : action_type;
  var s                 : storage_type)
                        : return_type is
  block {
    var operations: list(operation) := no_operations;
    case p of
      Get_fees(params) -> {
    const pair : pair_type = get_pair(params.pool_id, s);
    operations := Tezos.transaction(pair.fee, 0tez, params.receiver) # operations;
     }
    | _ -> skip
    end;
  } with (operations, s)