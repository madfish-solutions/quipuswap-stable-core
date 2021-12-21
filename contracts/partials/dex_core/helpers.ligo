
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
      virtual_reserves = nat_or_error(token_info.virtual_reserves - nipped, Errors.low_virtual_reserves);
      reserves = nat_or_error(token_info.reserves - nipped, Errors.low_reserves);
    ]


[@inline]
function divide_fee_for_balance(const fee: nat; const tokens_count: nat): nat is
  fee * tokens_count / (4n * nat_or_error(tokens_count - 1n, Errors.wrong_tokens_count));

function get_stake_proxy(
  const proxy   : address)
                        : contract(prx_stake_prm_t) is
  unwrap((Tezos.get_entrypoint_opt("%stake", proxy)
      : option(contract(prx_stake_prm_t))), Errors.proxy_ep_404);


function get_unstake_proxy(
  const proxy   : address)
                        : contract(prx_unstake_prm_t) is
  unwrap((Tezos.get_entrypoint_opt("%unstake", proxy)
      : option(contract(prx_unstake_prm_t))), Errors.proxy_ep_404);

function get_claim_proxy(
  const proxy   : address)
                        : contract(prx_claim_prm_t) is
  unwrap((Tezos.get_entrypoint_opt("%claim", proxy)
      : option(contract(prx_claim_prm_t))), Errors.proxy_ep_404);

function calc_reserves_to_prx(
  const virtual_reserves: nat;
  const rate: nat) : nat is div_ceil(virtual_reserves * rate, Constants.proxy_limit)

function stake_to_proxy(
  const value: nat;
  const token: token_t;
  var ops: list(operation);
  var token_info: tkn_inf_t;
  const proxy: address
  ): list(operation) * tkn_inf_t is
  block {
    ops := typed_transfer(
      Tezos.self_address,
      proxy,
      value,
      token
    ) # ops;
    ops := Tezos.transaction(
      record [ value = value; token = token ],
      0mutez,
      get_stake_proxy(proxy)
    ) # ops;
    token_info.reserves := nat_or_error(token_info.reserves - value, Errors.low_reserves)
  } with (ops, token_info)

function unstake_with_extra_from_proxy(
  const value: nat;
  const token: token_t;
  const extra: option(extra_receiver_t);
  const operations: list(operation);
  const proxy: address
  ): list(operation) is Tezos.transaction(
      record[
        value = value;
        token = token;
        additional = extra;
      ],
      0mutez,
      get_unstake_proxy(proxy)
    ) # operations;

function unstake_from_proxy(
  const value: nat;
  const token: token_t;
  const operations: list(operation);
  const proxy: address
  ): list(operation) is
    unstake_with_extra_from_proxy(value, token, (None:option(extra_receiver_t)), operations, proxy)

function fill_up_reserves(
  const value: nat;
  const receiver: address;
  const token: token_t;
  var token_info: tkn_inf_t;
  var operations: list(operation);
  const proxy : option(address)
  ): (list(operation) * tkn_inf_t * nat) is
  block{
    token_info.virtual_reserves := nat_or_error(token_info.virtual_reserves - value, Errors.low_virtual_reserves);
    var new_res := token_info.reserves;
    var to_receiver := value;
    if value >= token_info.reserves
      then {
        const prx = unwrap(proxy, Errors.low_reserves);
        if token_info.proxy_rate > 0n
          then {
            const unstake_val = nat_or_error(
              token_info.virtual_reserves - calc_reserves_to_prx(token_info.virtual_reserves, token_info.proxy_rate),
              Errors.nat_error);
            const extra = record[
              receiver = receiver;
              value = nat_or_error(to_receiver - token_info.reserves, Errors.nat_error);
            ];
            operations := unstake_with_extra_from_proxy(
              unstake_val,
              token,
              Some(extra),
              operations,
              prx
            );
            to_receiver := token_info.reserves;
            token_info.reserves := 0n;
          }
        else failwith(Errors.low_reserves)
      }
    else skip;
    token_info.reserves := new_res;
  } with (operations, token_info, to_receiver)

function check_up_reserves(
  const diff: diff_t;
  const receiver: address;
  const token: token_t;
  const proxy: option(address);
  var token_info: tkn_inf_t;
  var operations: list(operation)
  ): list(operation) * tkn_inf_t is
  block {
    case diff of
      Plus(value) -> {
        token_info.virtual_reserves := token_info.virtual_reserves + value;
        token_info.reserves := token_info.reserves + value;
        case proxy of
          Some(prx) -> {
            const on_proxy = nat_or_error(token_info.virtual_reserves - token_info.reserves, Errors.nat_error);
            if div_ceil(
              on_proxy,
              token_info.virtual_reserves
              ) < nat_or_error(token_info.proxy_rate - token_info.proxy_soft, Errors.nat_error)
              then {
                const (ops, t_i) = stake_to_proxy(
                  nat_or_error(
                    calc_reserves_to_prx(
                      token_info.virtual_reserves,
                      token_info.proxy_rate
                    ) - on_proxy,
                    Errors.nat_error
                  ),
                  token,
                  operations,
                  token_info,
                  prx
                );
                operations := ops;
                token_info := t_i;
              }
            else skip;
        }
        | None -> skip
        end
    }
    | Minus(value) -> {
        var to_receiver := 0n;
        if value < token_info.reserves
          then {
            token_info.virtual_reserves := nat_or_error(token_info.virtual_reserves - value, Errors.low_virtual_reserves);
            token_info.reserves := nat_or_error(token_info.reserves - value, Errors.low_reserves);
            to_receiver := value;
            case proxy of
              Some(prx) -> {
                const on_proxy = nat_or_error(token_info.virtual_reserves - token_info.reserves, Errors.nat_error);
                if div_ceil(
                  on_proxy,
                  token_info.virtual_reserves
                  ) > token_info.proxy_rate + token_info.proxy_soft
                  then {
                    operations := unstake_from_proxy(
                      nat_or_error(
                        on_proxy -
                        calc_reserves_to_prx(
                          token_info.virtual_reserves,
                          token_info.proxy_rate
                        ),
                        Errors.nat_error
                      ),
                      token,
                      operations,
                      prx
                    );
                  }
                else skip;
              }
            | None -> skip
            end
          }
        else {
          const res = fill_up_reserves(
            value,
            receiver,
            token,
            token_info,
            operations,
            proxy
          );
          operations := res.0;
          token_info := res.1;
          to_receiver := res.2;
        };
        if to_receiver > 0n
          then operations := typed_transfer(
            Tezos.self_address,
            receiver,
            to_receiver,
            token
          ) # operations;
        else skip
    }
    end
  } with (operations, token_info)

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

function update_lp_former_and_reward(
  const account: account_data_t;
  const lp_balance: nat;
  const proxy_reward_acc: map(token_t, nat)
  ): account_data_t is
  block {
    function fold_rewards(var acc: account_data_t; const entry : token_t * nat): account_data_t is
      block {
        var account_rewards := unwrap_or(
        acc.earned_interest[entry.0],
          record[
            reward = 0n;
            former = 0n;
          ]
        );
        const new_former = lp_balance * entry.1;
        account_rewards.reward := (account_rewards.reward + abs(new_former - account_rewards.former)) / Constants.acc_precision;
        account_rewards.former := new_former;
        acc.earned_interest[entry.0] := account_rewards;
      } with acc
  } with Map.fold(
      fold_rewards,
      proxy_reward_acc,
      account
    )

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
function get_token_info(
  const key         : tkn_pool_idx_t;
  const tokens_info : map(tkn_pool_idx_t, tkn_inf_t))
                    : tkn_inf_t is
  unwrap(tokens_info[key], Errors.no_token_info);
