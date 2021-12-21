(*
 * Implementation of main interaction with landing contract
 *)


(* [DONE-BEFORE] `Stake` tokens are sent to the proxy from dex, called approve of tokens.
 * Sends received balance to landing
 * Operation flow:
 * 1. UpdateInterest entrypoint
 * 2. GetPrice LandingProxy entrypoint
 * 3. Mint entrypoint
 * 4. Balance_of cb of liquidity_token minted.
 * code ops is reversed due to ligo execution order
 *)
function add_tokens(
  const params : stake_prm_t;
  var ops   : list(operation);
  var store : storage_t)
            : return_t is
  block {
    if params.value > 0n
      then {
        ops := typed_balance_of(
          Tezos.self_address,
          store.stake_info.liquidity_info.token
        ) # ops;

        store := cas_tmp(
          1n,
          store.stake_info.liquidity_info.token,
          store,
          params.token
        );

        ops := typed_approve(
          store.stake_info.location,
          params.value,
          store.stake_token
        ) # ops;
        ops := Tezos.transaction(
          record[
            tokenId = store.stake_info.market_id;
            amount = params.value;
          ],
          0mutez,
          get_mint_ep(store.stake_info.location)
        ) # ops;
        ops := Tezos.transaction(
          set[store.stake_info.market_id],
          0mutez,
          get_price_ep(store.stake_info.proxy)
        ) # ops;
        ops := Tezos.transaction(
          store.stake_info.market_id,
          0mutez,
          get_upd_intrst_ep(store.stake_info.location)
        ) # ops;
        store.staked := store.staked + params.value;
      }
    else skip;
  } with (ops, store)

function stake_cb(const tok_balance: nat; var store : storage_t): return_t is
  block {
    var operations := Constants.no_operations;
    store.stake_info.liquidity_info.value := tok_balance;
    store := reset_tmp(store);
  } with (operations, store)


(* [DONE-BEFORE] `Unstake` tokens are sent to the proxy from dex.
 * Removes balance from landing
 * Operation flow:
 * 1. UpdateInterest entrypoint
 * 2. GetPrice LandingProxy entrypoint
 * 3. Redeem entrypoint
 * 4. Balance_of cb of staked_token minted.
 * (after cb)
 * 5. Transfer needed tokens (1-2 operations)
 * 6. call update reserves on dex
 * 7. Stake back rest tokens
 * code ops is reversed due to ligo execution order
 *)
function redeem_tokens(
  const params: unstake_prm_t;
  var   ops   : list(operation);
  var   store : storage_t
)             : return_t is
  block {
    ops := typed_balance_of(
      Tezos.self_address,
      store.stake_token
    ) # ops;
    store := cas_tmp_extra(
      3n,
      store.stake_token,
      store,
      params.additional,
      Some(params.value),
      params.token
    );
    ops := Tezos.transaction(
      record[
        tokenId = store.stake_info.market_id;
        amount = 0n;
      ],
      0mutez,
      get_redeem_ep(store.stake_info.location)
    ) # ops;
    ops := Tezos.transaction(
          set[store.stake_info.market_id],
          0mutez,
          get_price_ep(store.stake_info.proxy)
    ) # ops;
    ops := Tezos.transaction(
      store.stake_info.market_id,
      0mutez,
      get_upd_intrst_ep(store.stake_info.location)
    ) # ops;
    store.stake_info.liquidity_info.value := 0n;
  } with (ops, store)

function redeem_cb(const tok_balance: nat; var store : storage_t): return_t is
  block {
    const tmp = unwrap(store.tmp, Errors.no_action);
    var operations := Constants.no_operations;
    var stake_back := tok_balance;
    case tmp.extra of
      Some(prm) -> {
        operations := typed_transfer(
          Tezos.self_address,
          prm.receiver,
          prm.value,
          store.stake_token
        ) # operations;
        stake_back := nat_or_error(stake_back - prm.value, Errors.nat_error);
      }
    | None -> skip
    end;
    const to_dex = unwrap_or(tmp.value, 0n);
    if to_dex > 0n
      then {
        const upd_res_prm: upd_res_t = record[
          value = to_dex;
          pool = store.dex.pool_id;
          idx = store.dex.pooled_index;
        ];
        operations := Tezos.transaction(
          upd_res_prm,
          0mutez,
          get_upd_res_ep(store.dex.location)
        ) # operations;
        operations := typed_transfer(
          Tezos.self_address,
          store.dex.location,
          to_dex,
          store.stake_token
        ) # operations;
        stake_back := nat_or_error(stake_back - to_dex, Errors.nat_error);
      }
    else skip;
    store := reset_tmp(store);
    store.staked := 0n;
    var return := add_tokens(record[token=store.stake_token; value=stake_back], operations, store);
    return.0 := typed_approve(
      store.stake_info.location,
      stake_back,
      store.stake_token
    ) # return.0;
  } with return


(* [DONE-BEFORE] `Claim` tokens are sent to the proxy from dex.
 * Gets stake difference between the staked value and balance after redeem.
 * Operation flow:
 * 1. UpdateInterest entrypoint
 * 2. GetPrice LandingProxy entrypoint
 * 3. Redeem entrypoint
 * 4. Balance_of cb of staked_token minted.
 * (after cb)
 * 5. Calculate reward and transfer to dex and caller (2 ops)
 * 6. call update reward on dex
 * 7. Stake back rest tokens
 * code ops is reversed due to ligo execution order
 *)
function claim_rewards(
  const params : claim_prm_t;
  var   ops   : list(operation);
  var   store : storage_t
  )           : return_t is
  block {
    ops := typed_balance_of(
      Tezos.self_address,
      store.stake_token
    ) # ops;
    store := cas_tmp_extra(
      2n,
      store.stake_token,
      store,
      Some(record[
        receiver = params.sender;
        value = 0n;
      ]),
      (None: option(nat)),
      params.token
    );
    ops := Tezos.transaction(
      record[
        tokenId = store.stake_info.market_id;
        amount = 0n;
      ],
      0mutez,
      get_redeem_ep(store.stake_info.location)
    ) # ops;
    ops := Tezos.transaction(
          set[store.stake_info.market_id],
          0mutez,
          get_price_ep(store.stake_info.proxy)
    ) # ops;
    ops := Tezos.transaction(
      store.stake_info.market_id,
      0mutez,
      get_upd_intrst_ep(store.stake_info.location)
    ) # ops;
    store.stake_info.liquidity_info.value := 0n;
  } with (ops, store)


function claim_cb(const tok_balance: nat; var store : storage_t): return_t is
  block {
    var operations := Constants.no_operations;
    const reward = nat_or_error(tok_balance - store.staked, Errors.nat_error);
    var stake_back := tok_balance;
    const tmp = unwrap(store.tmp, Errors.no_action);
    const extra = unwrap(tmp.extra, Errors.no_action);
    if reward > 0n
    then {
      stake_back := nat_or_error(tok_balance - reward, Errors.nat_error);
      const to_caller = div_ceil(reward * 3n, 100n);
      const to_dex = nat_or_error(reward - to_caller, Errors.nat_error);
      const upd_rew_prm: upd_prx_rew_t = record[
          token = store.stake_token;
          pool = store.dex.pool_id;
          value = to_dex
        ];
      operations := Tezos.transaction(
        upd_rew_prm,
        0mutez,
        get_upd_prx_rew_ep(store.dex.location)
      ) # operations;
      operations := typed_transfer(
          Tezos.self_address,
          store.dex.location,
          to_dex,
          store.stake_token
      ) # operations;
      operations := typed_transfer(
        Tezos.self_address,
        extra.receiver,
        to_caller,
        store.stake_token
      ) # operations;
    }
    else skip;
    store := reset_tmp(store);
    store.staked := 0n;
    operations := typed_approve(
      store.stake_info.location,
      stake_back,
      store.stake_token
    ) # operations;
    const (stake_ops, new_store) = add_tokens(record[token=store.stake_token; value=stake_back], Constants.no_operations, store);
    operations := concat_lists(operations, stake_ops);
  } with (operations, new_store)