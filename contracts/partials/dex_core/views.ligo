
(* 15n tokens per pool info *)
[@view]
function get_reserves(
  const pool_id         : pool_id_t;
  var s                 : full_storage_t)
                        : map(tkn_pool_idx_t, nat) is
  block {
    const pair : pair_t = unwrap(s.storage.pools[pool_id], Errors.pair_not_listed);
  } with Map.map(
    function(const _: tkn_pool_idx_t; var value: tkn_inf_t): nat is value.reserves,
    pair.tokens_info
  )

[@view]
function get_token_map(
  const pool_id         : pool_id_t;
  var s                 : full_storage_t)
                        : map(tkn_pool_idx_t, token_t) is
  unwrap(s.storage.tokens[pool_id], Errors.pair_not_listed)

(* tokens per 1 pair's share *)
[@view]
function get_tok_per_share(
  const pool_id         : pool_id_t;
  const s               : full_storage_t)
                        : map(tkn_pool_idx_t, nat) is
  block {
    const pool : pair_t = unwrap(s.storage.pools[pool_id], Errors.pair_not_listed);
    function map_prices(const _: tkn_pool_idx_t; var value: tkn_inf_t) is
      value.reserves * Constants.precision / pool.total_supply;
  } with Map.map(map_prices, pool.tokens_info)

(* Calculate the amount received when withdrawing a single coin *)
[@view]
function calc_divest_one_coin(
  const params          : calc_w_one_c_v_prm_t;
  const s               : full_storage_t)
                        : nat is
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
  } with result.dy

(* 19n Calculate the current output dy given input dx *)
[@view]
function get_dy(
  const params          : get_dy_v_prm_t;
  var s                 : full_storage_t)
                        : nat is
  block {
    const pair : pair_t = unwrap(s.storage.pools[params.pair_id], Errors.pair_not_listed);
    const xp: map(nat, nat) = xp(pair);
    const xp_i = unwrap(xp[params.i], Errors.wrong_index);
    const xp_j = unwrap(xp[params.j], Errors.wrong_index);
    const token_info_i = unwrap(pair.tokens_info[params.i], Errors.wrong_index);
    const token_info_j = unwrap(pair.tokens_info[params.j], Errors.wrong_index);
    const x: nat = xp_i + (params.dx * token_info_i.rate / Constants.precision);
    const y: nat = get_y(params.i, params.j, x, xp, pair);
    const dy: nat = nat_or_error(xp_j - y - 1, "y>xp_j") * Constants.precision / token_info_j.rate;
    const fee: nat = sum_all_fee(pair.fee) * dy / Constants.fee_denominator;
  } with nat_or_error(dy - fee, "fee>dy")

(* 20n Get A constant *)
[@view]
function view_A(
  const pool_id         : pool_id_t;
  var s                 : full_storage_t)
                        : nat is
  block {
    const pair : pair_t = unwrap(s.storage.pools[pool_id], Errors.pair_not_listed);
  } with get_A(
        pair.initial_A_time,
        pair.initial_A,
        pair.future_A_time,
        pair.future_A
      ) / Constants.a_precision

(* 17n Fees *)
[@view]
function get_fees(
  const pool_id         : pool_id_t;
  var s                 : full_storage_t)
                        : fees_storage_t is
  block {
    const pair : pair_t = unwrap(s.storage.pools[pool_id], Errors.pair_not_listed);
  } with pair.fee

[@view]
function get_staker_info(
  const requests        : list(stkr_info_req_t);
  const s               : full_storage_t)
                        : list(stkr_info_res_t) is
  block {
    function look_up_info(
      const params    : stkr_info_req_t;
      const l         : list(stkr_info_res_t))
                      : list(stkr_info_res_t) is
      block {
        const pool : pair_t = unwrap(s.storage.pools[params.pool_id], Errors.pair_not_listed);
        const pool_accumulator = pool.staker_accumulator.accumulator;
        const key = (params.user, params.pool_id);
        const info : stkr_info_t = unwrap(s.storage.stakers_balance[key], Errors.pair_not_listed);
        function get_rewards(const key: tkn_pool_idx_t; const value: account_rwrd_t): nat is
          block {
            const pool_acc = unwrap_or(pool_accumulator[key], 0n);
            const new_former = info.balance * pool_acc;
            const reward_amt = (value.reward + abs(new_former - value.former)) / Constants.acc_precision;
          } with reward_amt;
        const rew_info: stkr_res = record[
            balance = info.balance;
            rewards = Map.map(get_rewards, info.earnings);
          ];
        const response : stkr_info_res_t = record [
          request = params;
          info    = rew_info;
        ];
      } with response # l;

    const response : list(stkr_info_res_t) = List.fold_right(
      look_up_info,
      requests,
      (nil : list(stkr_info_res_t))
    );
  } with response

[@view]
function get_referral_rewards(
  const requests        : list(ref_rew_req_t);
  const s               : full_storage_t)
                        : list(ref_rew_res_t) is
  block {
    function iterate_req(
      const params    : ref_rew_req_t;
      const l         : list(ref_rew_res_t))
                      : list(ref_rew_res_t) is
      record [
          request = params;
          reward  = unwrap_or(
            s.storage.referral_rewards[(params.user, params.token)],
            0n
          );
        ] # l;
    const response : list(ref_rew_res_t) = List.fold_right(
      iterate_req,
      requests,
      (nil : list(ref_rew_res_t))
    );
  } with response