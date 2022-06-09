(* tokens per pool info *)
[@view] function get_reserves(
  const pool_id         : pool_id_t;
  var s                 : full_storage_t)
                        : map(token_pool_idx_t, nat) is
  block {
    const pool = unwrap(s.storage.pools[pool_id], Errors.Dex.pool_not_listed);
  } with Map.map(
    function(
      const _           : token_pool_idx_t;
      var value         : token_info_t)
                        : nat
      is value.reserves,
    pool.tokens_info
  )

[@view] function get_token_map(
  const pool_id         : pool_id_t;
  var s                 : full_storage_t)
                        : map(token_pool_idx_t, token_t) is
  unwrap(s.storage.tokens[pool_id], Errors.Dex.pool_not_listed)

(* tokens per 1 pool's share *)
[@view] function get_tok_per_share(
  const pool_id         : pool_id_t;
  const s               : full_storage_t)
                        : map(token_pool_idx_t, nat) is
  block {
    const pool = unwrap(s.storage.pools[pool_id], Errors.Dex.pool_not_listed);
    [@inline] function map_prices(
      const _           : token_pool_idx_t;
      var value         : token_info_t)
                        : nat is
      value.reserves * Constants.precision / pool.total_supply;
  } with Map.map(map_prices, pool.tokens_info)

(* Calculate the amount received when withdrawing a single coin *)
[@view] function calc_divest_one_coin(
  const params          : calc_withdraw_one_param_t;
  const s               : full_storage_t)
                        : nat is
  block {
    const pool = unwrap(s.storage.pools[params.pool_id], Errors.Dex.pool_not_listed);
    const amp_f = get_A(
      pool.initial_A_time,
      pool.initial_A_f,
      pool.future_A_time,
      pool.future_A_f
    );
    const result = calc_withdraw_one_coin(
      amp_f,
      params.token_amount,
      params.i,
      get_dev_fee(s.storage),
      pool
    );
  } with result.dy

(* Calculate the current output dy given input dx *)
[@view] function get_dy(
  const params          : get_dy_v_param_t;
  var s                 : full_storage_t)
                        : nat is
  block {
    const pool      = unwrap(s.storage.pools[params.pool_id], Errors.Dex.pool_not_listed);
    const dy: nat   = perform_swap(params.i, params.j,params.dx, pool);
    const fee: nat  = sum_all_fee(pool.fee, get_dev_fee(s.storage)) * dy / Constants.fee_denominator;
  } with nat_or_error(dy - fee, Errors.Dex.fee_overflow)

(* Get A constant *)
[@view] function view_A(
  const pool_id         : pool_id_t;
  var s                 : full_storage_t)
                        : nat is
  block {
    const pool = unwrap(s.storage.pools[pool_id], Errors.Dex.pool_not_listed);
  } with get_A(
        pool.initial_A_time,
        pool.initial_A_f,
        pool.future_A_time,
        pool.future_A_f
      ) / Constants.a_precision

(* Fees *)
[@view] function get_fees(
  const pool_id         : pool_id_t;
  var s                 : full_storage_t)
                        : fees_storage_t is
  block {
    const pool = unwrap(s.storage.pools[pool_id], Errors.Dex.pool_not_listed);
  } with pool.fee

[@view] function get_staker_info(
  const requests        : list(staker_info_req_t);
  const s               : full_storage_t)
                        : list(staker_info_res_t) is
  block {
    function look_up_info(
      const params      : staker_info_req_t)
                        : staker_info_res_t is
      block {
        const pool = unwrap(s.storage.pools[params.pool_id], Errors.Dex.pool_not_listed);
        const pool_accumulator_f = pool.staker_accumulator.accumulator_f;
        const key = (params.user, params.pool_id);
        const info = unwrap_or(s.storage.stakers_balance[key], default_staker_info);
        function get_rewards(
          const key     : token_pool_idx_t;
          const value   : account_reward_t)
                        : nat is
          block {
            const pool_accum_f = unwrap_or(pool_accumulator_f[key], 0n);
            const new_former_f = info.balance * pool_accum_f;
            const reward_amt = (value.reward_f + abs(new_former_f - value.former_f)) / Constants.accum_precision;
          } with reward_amt;
        const rew_info: staker_res = record [
            balance = info.balance;
            rewards = Map.map(get_rewards, info.earnings);
          ];
      } with record [
          request = params;
          info    = rew_info;
        ];
  } with List.map(look_up_info, requests)

[@view] function get_referral_rewards(
  const requests        : list(ref_rew_req_t);
  const s               : full_storage_t)
                        : list(ref_rew_res_t) is
  block {
    function iterate_req(
      const params      : ref_rew_req_t;
      const l           : list(ref_rew_res_t))
                        : list(ref_rew_res_t) is
      record [
          request = params;
          reward  = unwrap_or(s.storage.referral_rewards[(params.user, params.token)], 0n);
        ] # l;
    const response : list(ref_rew_res_t) = List.fold_right(
      iterate_req,
      requests,
      (nil : list(ref_rew_res_t))
    );
  } with response

[@view] function calc_token_amount(
  const params          : token_amt_v_param_t;
  const s               : full_storage_t)
                        : nat is
  block {
    const pool = unwrap(s.storage.pools[params.pool_id], Errors.Dex.pool_not_listed);
    const amp_f = get_A(
        pool.initial_A_time,
        pool.initial_A_f,
        pool.future_A_time,
        pool.future_A_f
      );
    const d0 = get_D_mem(pool.tokens_info, amp_f);
    function map_amounts(
      const key         : token_pool_idx_t;
      const value       : token_info_t)
                        : token_info_t is
      block {
        const amnt = unwrap_or(params.amounts[key], 0n);
        const new_reserves = if params.is_deposit
          then value.reserves + amnt
          else nat_or_error(value.reserves - amnt, Errors.Math.nat_error);
      } with value with record[ reserves = new_reserves ];

    const mod_info = Map.map(map_amounts, pool.tokens_info);
    const d1 = get_D_mem(mod_info, amp_f);
    const diff = if params.is_deposit
      then nat_or_error(d1 - d0,  Errors.Math.nat_error)
      else nat_or_error(d0 - d1,  Errors.Math.nat_error);
  } with diff * pool.total_supply / d0