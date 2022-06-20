(* Update reserves with pre-calculated `fees` *)
[@inline] function nip_fees_off_reserves(
  const stakers_fee     : nat;
  const ref_fee         : nat;
  const dev_fee         : nat;
  const token_info      : token_info_t)
                        : token_info_t is
  token_info with record [
    reserves = nat_or_error(
      token_info.reserves - stakers_fee - ref_fee - dev_fee,
      Errors.Dex.low_reserves
    );
  ]

(* Helper for separating fee when request is imbalanced *)
[@inline] function divide_fee_for_balance(
  const fee             : nat;
  const tokens_count    : nat)
                        : nat is
  fee * tokens_count / (4n * nat_or_error(tokens_count - 1n, Errors.Dex.wrong_tokens_count))

(* Slice fees from calculated `dy` and returns new dy and sliced fees *)
function slice_fee(
    const dy            : nat;
    const fee           : fees_storage_t;
    const dev_fee_f     : nat;
    const total_staked  : nat)
                        : record [ dy: nat; ref: nat; dev: nat; stakers: nat; lp: nat; ] is
  block {
    const to_ref = dy * fee.ref_f / Constants.fee_denominator;
    const to_dev = dy * dev_fee_f / Constants.fee_denominator;
    var to_providers := dy * fee.lp_f / Constants.fee_denominator;

    var to_stakers := 0n;
    if (total_staked =/= 0n)
    then to_stakers := dy * fee.stakers_f / Constants.fee_denominator
    else to_providers := to_providers + dy * fee.stakers_f / Constants.fee_denominator;

    const return = record [
      dy  = nat_or_error(dy - to_providers - to_ref - to_dev - to_stakers, Errors.Dex.fee_overflow);
      ref = to_ref;
      dev = to_dev;
      stakers = to_stakers;
      lp  = to_providers
    ]
  } with return

(* Helper function to calculate and harvest staker reward *)
function harvest_staker_rewards(
  var info              : staker_info_t;
  var operations        : list(operation);
  const accumulator     : staker_accum_t;
  const tokens          : option(tokens_map_t))
                        : record [ account: staker_info_t; operations: list(operation) ] is
  block {
    const staker_balance = info.balance;
    function fold_rewards(
      var accum         : record [ op: list(operation); earnings: map(token_pool_idx_t, account_reward_t); ];
      const entry       : token_pool_idx_t * nat)
                        : record [ op: list(operation); earnings: map(token_pool_idx_t, account_reward_t); ] is
      block {
        const i = entry.0;
        const pool_accum_f = entry.1;
        const reward = unwrap_or(
          accum.earnings[i],
          record [
            former_f = 0n;
            reward_f = 0n;
          ]
        );
        const new_former_f = staker_balance * pool_accum_f;
        const (reward_amt, reward_change) = unwrap_ediv(reward.reward_f + abs(new_former_f - reward.former_f),
          Constants.accum_precision);
        if reward_amt > 0n
        then accum.op := typed_transfer(
            Tezos.self_address,
            Tezos.sender,
            reward_amt,
            get_token_by_id(i, tokens)
          ) # accum.op
        else skip;
        accum.earnings[i] := record[
          former_f = new_former_f;
          reward_f = reward_change;
        ];
    } with accum;
    const harvest = Map.fold(
      fold_rewards,
      accumulator.accumulator_f,
      record[ op = operations; earnings = info.earnings ]
    );
    operations := harvest.op;
    info.earnings := harvest.earnings;
  } with record [ operations = operations; account = info ]

(* Helper function to transfer staker tokens and update former *)
function update_former_and_transfer(
  const param           : stake_action_t;
  const staker_accum    : staker_info_t;
  const pool_stake_accum: staker_accum_t;
  const quipu_token     : fa2_token_t)
                        : record [ account: staker_info_t; staker_accumulator: staker_accum_t; op: operation; ] is
  block {
    const (
      new_balance,
      forwarder,
      receiver,
      total_staked,
      shares
    ) = case param of [
        | Add(p) -> (
            staker_accum.balance + p.amount,
            Tezos.sender,
            Tezos.self_address,
            pool_stake_accum.total_staked + p.amount,
            p.amount
            )
        | Remove(p) -> (
            nat_or_error(staker_accum.balance - p.amount, Errors.Dex.wrong_shares_out),
            Tezos.self_address,
            Tezos.sender,
            nat_or_error(pool_stake_accum.total_staked - p.amount, Errors.Dex.wrong_shares_out),
            p.amount
            )
        ];

    function upd_former(
      const i           : token_pool_idx_t;
      const rew         : account_reward_t)
                        : account_reward_t is
      block{
        const new_former_f = new_balance * unwrap_or(pool_stake_accum.accumulator_f[i], 0n);
      } with rew with record [
          former_f = new_former_f;
        ];
  } with record [
    account = record [
      balance = new_balance;
      earnings = Map.map(upd_former, staker_accum.earnings);
    ];
    staker_accumulator = pool_stake_accum with record [
      total_staked = total_staked
    ];
    op = typed_transfer(
      forwarder,
      receiver,
      shares,
      Fa2(quipu_token)
    );
  ]

const default_staker_info: staker_info_t = record [
  balance   = 0n;
  earnings  = (map[] : map(token_pool_idx_t, account_reward_t))
];

(* Harvest staked rewards and stakes/unstakes QUIPU tokens if amount > 0n *)
function update_stake(
  const params          : stake_action_t;
  var   s               : storage_t)
                        : return_t is
  block {
    const (pool_id, shares) = case params of [
        Add(p) -> (p.pool_id, p.amount)
      | Remove(p) -> (p.pool_id, p.amount)
      ];
    var operations: list(operation) := Constants.no_operations;
    const staker_key = (Tezos.sender, pool_id);
    var staker_accum := unwrap_or(
      s.stakers_balance[staker_key],
      default_staker_info
    );
    var pool := unwrap(s.pools[pool_id], Errors.Dex.pool_not_listed);
    const harvested = harvest_staker_rewards(
      staker_accum,
      operations,
      pool.staker_accumulator,
      s.tokens[pool_id]
    );
    staker_accum := harvested.account;
    operations := harvested.operations;
    if shares > 0n
    then {
      const after_updates = update_former_and_transfer(
        params,
        staker_accum,
        pool.staker_accumulator,
        s.quipu_token
      );
      staker_accum := after_updates.account;
      pool.staker_accumulator := after_updates.staker_accumulator;
      operations := after_updates.op # operations;
    }
    else skip;
    s.pools[pool_id] := pool;
    s.stakers_balance[staker_key] := staker_accum;
  } with (operations, s)

(* Helper function to get token pool *)
function get_pool_info(
  const token_bytes     : bytes;
  const pools_count     : nat;
  const pool_to_id      : big_map(bytes, nat);
  const pools           : big_map(pool_id_t, pool_t))
                        : (pool_t * nat) is
  block {
    const token_id : nat = unwrap_or(pool_to_id[token_bytes], pools_count);
    const pool : pool_t = unwrap_or(pools[token_id], record [
      initial_A_f         = 0n;
      future_A_f          = 0n;
      initial_A_time      = Tezos.now;
      future_A_time       = Tezos.now;
      tokens_info         = (map []: map(token_pool_idx_t, token_info_t));
      fee                 = record [
        lp_f            = 0n;
        ref_f           = 0n;
        stakers_f       = 0n;
      ];
      staker_accumulator  = record [
        accumulator_f       = (map []: map(token_pool_idx_t, nat));
        total_fees          = (map []: map(token_pool_idx_t, nat));
        total_staked        = 0n;
      ];
      total_supply        = 0n;
    ]);
  } with (pool, token_id)

(* Helper function to get pool info *)
[@inline] function get_token_info(
  const key             : token_pool_idx_t;
  const tokens_info     : map(token_pool_idx_t, token_info_t))
                        : token_info_t is
  unwrap(tokens_info[key], Errors.Dex.no_token_info)

function check_shares_and_reserves(
  const pool            : pool_t)
                        : unit is
  block {
    function sum(
          const acc     : nat;
          const value   : token_pool_idx_t * token_info_t)
                        : nat is acc + value.1.reserves;
    const reserves_sum = Map.fold(sum, pool.tokens_info, 0n);
  } with if pool.total_supply = 0n and reserves_sum > 0n
      then failwith(Errors.Dex.supply_drained)
    else if pool.total_supply > 0n and reserves_sum = 0n
      then failwith(Errors.Dex.reserves_drained)
    else Unit;