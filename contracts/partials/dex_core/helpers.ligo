(* Helper for sum fees that separated from reserves  *)
[@inline] function sum_wo_lp_fee(
  const fee             : fees_storage_t;
  const dev_fee         : nat)
                        : nat is
    fee.stakers
  + fee.ref
  + dev_fee;

(* Helper for sum all fee  *)
function sum_all_fee(
  const fee             : fees_storage_t;
  const dev_fee         : nat)
                        : nat is
    fee.lp + sum_wo_lp_fee(fee, dev_fee);

(* Update reserves with pre-calculated `fees` *)
[@inline] function nip_fees_off_reserves(
  const fees            : fees_storage_t;
  const dev_fee         : nat;
  const token_info      : token_info_t)
                        : token_info_t is
  token_info with record [
    reserves = nat_or_error(token_info.reserves - sum_wo_lp_fee(fees, dev_fee), Errors.Dex.low_reserves);
  ]

(* Helper for separating fee when request is imbalanced *)
[@inline] function divide_fee_for_balance(
  const fee             : nat;
  const tokens_count    : nat)
                        : nat is
  fee * tokens_count / (4n * nat_or_error(tokens_count - 1n, Errors.Dex.wrong_tokens_count));

(* Slice fees from calculated `dy` and returns new dy and sliced fees *)
function slice_fee(
    const dy            : nat;
    const fee           : fees_storage_t;
    const dev_fee       : nat;
    const total_staked  : nat)
                        : record [ dy: nat; ref: nat; dev: nat; stakers: nat; lp: nat; ] is
  block {
    const to_ref = dy * fee.ref / Constants.fee_denominator;
    const to_dev = dy * dev_fee / Constants.fee_denominator;
    var to_providers := dy * fee.lp / Constants.fee_denominator;

    var to_stakers := 0n;
    if (total_staked =/= 0n)
    then to_stakers := dy * fee.stakers / Constants.fee_denominator;
    else to_providers := to_providers + dy * fee.stakers / Constants.fee_denominator;

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
        const pool_accum = entry.1;
        const reward = unwrap_or(
          accum.earnings[i],
          record [
            former = 0n;
            reward = 0n;
          ]
        );
        const new_former = staker_balance * pool_accum;
        const reward_amt = (reward.reward + abs(new_former - reward.former)) / Constants.accum_precision;

        accum.op := typed_transfer(
          Tezos.self_address,
          Tezos.sender,
          reward_amt,
          get_token_by_id(i, tokens)
        ) # accum.op;

        accum.earnings[i] := record[
          former = new_former;
          reward = 0n;
        ];
    } with accum;
    const harvest = Map.fold(
      fold_rewards,
      accumulator.accumulator,
      record[ op = operations; earnings = info.earnings ]
    );
    operations := harvest.op;
    info.earnings := harvest.earnings;
  } with record [ operations = operations; account = info ]

(* Helper function to transfer staker tokens and update former *)
function update_former_and_transfer(
  const flag            : should_unstake_fl;
  const shares          : nat;
  const staker_accum    : staker_info_t;
  const pool_stake_accum: staker_accum_t;
  const quipu_token     : fa2_token_t)
                        : record [ account: staker_info_t; staker_accumulator: staker_accum_t; op: operation; ] is
  block {
    const (
      new_balance,
      forwarder,
      receiver,
      total_staked
    ) = case flag of
        | Add -> (
            staker_accum.balance + shares,
            Tezos.sender,
            Tezos.self_address,
            pool_stake_accum.total_staked + shares
            )
        | Remove -> (
            nat_or_error(staker_accum.balance - shares, Errors.Dex.wrong_shares_out),
            Tezos.self_address,
            Tezos.sender,
            nat_or_error(pool_stake_accum.total_staked - shares, Errors.Dex.wrong_shares_out)
            )
        end;

    function upd_former(
      const i           : token_pool_idx_t;
      const rew         : account_reward_t)
                        : account_reward_t is
      block{
        const new_former = new_balance * unwrap_or(pool_stake_accum.accumulator[i], 0n);
        const new_reward = (rew.reward + abs(new_former - rew.former)) / Constants.accum_precision;
      } with rew with record [
        former = new_former;
        reward = new_reward;
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

(* Harvest staked rewards and stakes/unstakes QUIPU tokens if amount > 0n *)
function perform_un_stake(
  const flag            : should_unstake_fl;
  const params          : un_stake_param_t;
  var   s               : storage_t)
                        : return_t is
  block {
    var operations: list(operation) := Constants.no_operations;
    const staker_key = (Tezos.sender, params.pool_id);
    var staker_accum := unwrap_or(
      s.stakers_balance[staker_key],
      record [
        balance = 0n;
        earnings = (map[] : map(nat , account_reward_t))
      ]
    );
    var pool := unwrap(s.pools[params.pool_id], Errors.Dex.pool_not_listed);
    const harvested = harvest_staker_rewards(
      staker_accum,
      operations,
      pool.staker_accumulator,
      s.tokens[params.pool_id]
    );
    staker_accum := harvested.account;
    operations := harvested.operations;
    if params.amount > 0n
    then {
      const after_updates = update_former_and_transfer(
        flag,
        params.amount,
        staker_accum,
        pool.staker_accumulator,
        s.quipu_token
      );
      staker_accum := after_updates.account;
      pool.staker_accumulator := after_updates.staker_accumulator;
      operations := after_updates.op # operations;
    }
    else skip;
    s.pools[params.pool_id] := pool;
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
      initial_A           = 0n;
      future_A            = 0n;
      initial_A_time      = Tezos.now;
      future_A_time       = Tezos.now;
      tokens_info         = (map []: map(token_pool_idx_t, token_info_t));
      fee                 = record [
        lp              = 0n;
        ref             = 0n;
        stakers         = 0n;
      ];
      staker_accumulator  = record [
        accumulator         = (map []: map(token_pool_idx_t, nat));
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