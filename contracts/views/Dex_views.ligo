
(* reserves per pool *)
[@inline]
function get_reserves(
  const params          : reserves_type;
  const s               : full_storage_type)
                        : full_return_type is
  block {
    const pair : pair_type = get_pair(params.pair_id, s.storage)
  } with (list [Tezos.transaction(pair.reserves, 0tez, params.receiver)], s)

(* reserves per pool *)
[@inline]
function get_virt_reserves(
  const params          : reserves_type;
  const s               : full_storage_type)
                        : full_return_type is
  block {
    const pair : pair_type = get_pair(params.pair_id, s.storage)
  } with (list [Tezos.transaction(pair.virtual_reserves, 0tez, params.receiver)], s)

(* LP total supply per pool *)
function get_total_supply(
  const params          : total_supply_type;
  const s               : full_storage_type)
                        : full_return_type is
  block {
    const pair : pair_type = get_pair(params.pair_id, s.storage)
  } with (list [Tezos.transaction(pair.total_supply, 0tez, params.receiver)], s)

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
    var dy := abs(xp_j - y - 1);
    const dy_fee = sum_all_fee(pair) * dy / _C_fee_denominator;

    const rate_j = case pair.token_rates[params.j] of
      | Some(value) -> value
      | None -> (failwith("no such index") : nat)
      end;
    dy := abs(dy - dy_fee) * _C_precision / rate_j;
  } with (list [Tezos.transaction(dy, 0tez, params.receiver)], s)


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
  const params          : get_dy_params;
  const s               : full_storage_type)
                        : full_return_type is
  block {
    const pair : pair_type = get_pair(params.pair_id, s.storage);
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
    assert(abs(xp_j-1)>=y);
    const dy: nat = abs(xp_j - y - 1);
    const fee: nat = sum_all_fee(pair) * dy / _C_fee_denominator;
  } with (list [Tezos.transaction((abs(dy-fee) * _C_precision / rate_j), 0tez, params.receiver)], s)

(* Get A constant *)
[@inline]
function get_A(
  const params          : get_A_params;
  const s               : full_storage_type)
                        : full_return_type is
  block {
    const pair : pair_type = get_pair(params.pair_id, s.storage);
  } with (list[Tezos.transaction(_A(pair) / _C_a_precision, 0tez, params.receiver)], s)

(* Fees *)
[@inline]
function get_fees(
  const params    : get_fee_type;
  const s         : full_storage_type)
                  : full_return_type is
  block {
    const pair : pair_type = get_pair(params.pool_id, s.storage);
  } with (list[Tezos.transaction(pair.fee, 0tez, params.receiver)], s)