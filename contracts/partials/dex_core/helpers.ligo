
const default_tmp_tokens : tmp_tkns_map_t = record [
    tokens = (map[] : tkns_map_t);
    index  = 0n;
];

function sum_all_fee(const fee: fees_storage_t): nat is
    fee.lp_fee
  + fee.stakers_fee
  + fee.ref_fee
  + fee.dev_fee;

function sum_wo_lp_fee(const fee: fees_storage_t): nat is
    fee.stakers_fee
  + fee.ref_fee
  + fee.dev_fee;

(* если не хватает чтоб откусить фии падаем с ошибкой *)

function nip_off_fees(
  const fees: fees_storage_t;
  const token_info: tkn_inf_t
  ): tkn_inf_t is
  block {
    const nipped = sum_wo_lp_fee(fees);
  } with token_info with record[
      reserves = nat_or_error(token_info.reserves - nipped, Errors.low_reserves);
    ]


[@inline]
function divide_fee_for_balance(const fee: nat; const tokens_count: nat): nat is
  fee * tokens_count / (4n * nat_or_error(tokens_count - 1n, Errors.wrong_tokens_count));

function get_token_by_id(
    const token_id  : tkn_pool_idx_t;
    const map_entry : option(tkns_map_t)
  )                 : token_t is
  block {
    const tokens = unwrap(map_entry, Errors.pair_not_listed);
    const token = unwrap(tokens[token_id], Errors.wrong_index);
  } with token;

function perform_fee_slice(
    const dy            : nat;
    const fee           : fees_storage_t;
    const total_staked  : nat
  )                     : record[
    dy  : nat;
    ref : nat;
    dev : nat;
    stkr: nat;
    lp  : nat;
  ] is
  block {
    const to_ref = dy * fee.ref_fee / Constants.fee_denominator;
    const to_dev = dy * fee.dev_fee / Constants.fee_denominator;
    var to_prov := dy * fee.lp_fee / Constants.fee_denominator;

    var to_stakers := 0n;
    if (total_staked =/= 0n)
      then to_stakers := dy * fee.stakers_fee / Constants.fee_denominator;
    else to_prov := to_prov + dy * fee.stakers_fee / Constants.fee_denominator;

    const return = record[
      dy  = nat_or_error(dy - to_prov - to_ref - to_dev - to_stakers, Errors.fee_overflow);
      ref = to_ref;
      dev = to_dev;
      stkr= to_stakers;
      lp  = to_prov
    ]
  } with return


function harvest_staker_rewards(
  var info          : stkr_info_t;
  var operations    : list(operation);
  const accumulator : stkr_acc_t;
  const tokens      : option(tkns_map_t)
  )                 : stkr_info_t * list(operation) is
  block {
    const staker_balance = info.balance;
    function fold_rewards(
      var acc: record [
        op: list(operation);
        earnings: map(tkn_pool_idx_t, account_rwrd_t);
      ];
      const entry: tkn_pool_idx_t * nat
      ): record [
        op: list(operation);
        earnings: map(tkn_pool_idx_t, account_rwrd_t);
      ] is
      block {
        const i = entry.0;
        const pool_acc = entry.1;
        const reward = unwrap_or(acc.earnings[i], record[
          former = 0n;
          reward = 0n;
        ]);
        const new_former = staker_balance * pool_acc;
        const reward_amt = (reward.reward + abs(new_former - reward.former)) / Constants.acc_precision;
        acc.op := typed_transfer(
          Tezos.self_address,
          Tezos.sender,
          reward_amt,
          get_token_by_id(i, tokens)
        ) # acc.op;
        acc.earnings[i] := record[
          former = new_former;
          reward = 0n;
        ];
    } with acc;
    const harvest = Map.fold(fold_rewards, accumulator.accumulator, record[op=operations; earnings=info.earnings]);
    operations := harvest.op;
    patch info with record [ earnings=harvest.earnings; ];
  } with (info, operations)

function update_former_and_transfer(
  const flag: a_r_flag_t;
  const shares: nat;
  const staker_acc: stkr_info_t;
  const pool_s_accumulator: stkr_acc_t;
  const quipu_token : fa2_token_t;
  const operations: list(operation)
  ): record [
    account: stkr_info_t;
    staker_accumulator: stkr_acc_t;
    ops: list(operation);
  ] is
  block {
    const (
      new_balance,
      forwarder,
      receiver,
      total_staked
    ) = case flag of
          Add -> (
            staker_acc.balance + shares,
            Tezos.sender,
            Tezos.self_address,
            pool_s_accumulator.total_staked + shares
            )
        | Remove -> (
            nat_or_error(staker_acc.balance - shares, Errors.wrong_shares_out),
            Tezos.self_address,
            Tezos.sender,
            nat_or_error(pool_s_accumulator.total_staked - shares, Errors.wrong_shares_out)
            )
        end;
      function upd_former(const i: tkn_pool_idx_t; const rew: account_rwrd_t) : account_rwrd_t is
        rew with record [former = new_balance * unwrap_or(pool_s_accumulator.accumulator[i], 0n)];
  } with record[
    account = record[
        balance = new_balance;
        earnings = Map.map(upd_former, staker_acc.earnings);
      ];
    staker_accumulator = pool_s_accumulator with record[
        total_staked = total_staked
      ];
    ops = typed_transfer(
        forwarder,
        receiver,
        shares,
        Fa2(quipu_token)
      ) # operations;
  ]

(* Helper function to get token pair *)
function get_pair_info(
  const token_bytes     : bytes;
  const pools_count     : nat;
  const pool_to_id      : big_map(bytes, nat);
  const pools           : big_map(pool_id_t, pair_t))
                        : (pair_t * nat) is
  block {
    const token_id : nat = unwrap_or(pool_to_id[token_bytes], pools_count);
    const pair : pair_t = unwrap_or(pools[token_id], record [
      initial_A             = 0n;
      future_A              = 0n;
      initial_A_time        = Tezos.now;
      future_A_time         = Tezos.now;
      tokens_info           = (map []: map(tkn_pool_idx_t, tkn_inf_t));
      fee                   = record [
        dev_fee               = 0n;
        lp_fee                = 0n;
        ref_fee               = 0n;
        stakers_fee           = 0n;
      ];
      staker_accumulator    = record [
        accumulator           = (map []: map(tkn_pool_idx_t, nat));
        total_staked          = 0n;
      ];
      proxy_contract        = (None: option (address));
      proxy_reward_acc      = (map []: map(token_t, nat));
      total_supply          = 0n;
    ]);
  } with (pair, token_id)

(* Helper function to get pair info *)
function get_token_info(const key: tkn_pool_idx_t; const tokens_info: map(tkn_pool_idx_t, tkn_inf_t)): tkn_inf_t is
  unwrap(tokens_info[key], Errors.no_token_info)