(*
 * Dummy implementation of main interaction with farm contract
 * Change this implementation to use the farm entrypoints and logic
 *)


(* [DONE-BEFORE] `Stake` tokens are sent to the proxy from dex, called balance_of proxy.
 * Sends received balance to farm
 *)
function dummy_stake(
  const bal : nat;
  var ops   : list(operation);
  var store : storage_t)
            : return_t is
  block {
    ops := typed_transfer(
      Tezos.self_address,
      store.farm,
      bal,
      store.stake_token
    ) # ops;
    store.staked := store.staked + bal;
    store := reset_tmp(store);
  } with (ops, store)

(* [DONE-BEFORE] `Reward` tokens are sent to the proxy from farm, called balance_of proxy.
 * Sends received balance to dex and 3% to initiator of claim
 *)
function dummy_claim(
  const bal : nat;
  var ops   : list(operation);
  var store : storage_t)
            : return_t is
  block {
    const snd_rwd = div_ceil(bal * 3n, 100n);
    // TODO: should call Dex entrypoint to update rewards
    ops := typed_transfer(
      Tezos.self_address,
      store.dex,
      bal - snd_rwd,
      store.reward_token
    ) # ops;
    (* Sends caller reward as 3% of the received reward *)
    ops := typed_transfer(
      Tezos.self_address,
      Tezos.source,
      snd_rwd,
      store.reward_token
    ) # ops;
    store := reset_tmp(store);
  } with (ops, store)

(* [DONE-BEFORE] `Staked` tokens are sent to the proxy from farm, called balance_of proxy.
 * Sends received balance to extra receiver if provided
 * and rest of the balance to farm
 *)
function dummy_unstake(
  const bal   : nat;
  var ops     : list(operation);
  var store   : storage_t)
              : return_t is
  block {
    var to_dex : nat := bal;
    const tmp = unwrap(s.tmp, Errors.no_action);
    case tmp.extra of
      Some(recvr) -> {
        ops := typed_transfer(
          Tezos.self_address,
          recvr.receiver,
          recvr.value,
          store.reward_token
        ) # ops;
        to_dex := nat_or_error(
          to_dex - recvr.value,
          "reciever value > balance"
        );
      }
    | None -> skip
    end;
    // TODO: should call Dex entrypoint to update reserves
    ops := typed_transfer(
      Tezos.self_address,
      store.dex,
      to_dex,
      store.reward_token
    ) # ops;
  } with (ops, store)