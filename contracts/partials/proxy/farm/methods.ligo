(*
 * Implementation of main interaction with farm contract
 *)

function add_tokens(
  const _bal : nat;
  var _ops   : list(operation);
  var _store : storage_t)
            : return_t is (failwith("Not-implemented"): return_t)

function stake_cb(const _tok_balance: nat; var _store : storage_t): return_t is (failwith("Not-implemented"): return_t)

function redeem_tokens(
  const _params: unstake_prm_t;
  var   _ops   : list(operation);
  var   _store : storage_t
)             : return_t is (failwith("Not-implemented"): return_t)

function redeem_cb(const _tok_balance: nat; var _store : storage_t): return_t is (failwith("Not-implemented"): return_t)

function claim_rewards(
  var   _ops   : list(operation);
  var   _store : storage_t
  )           : return_t is (failwith("Not-implemented"): return_t)

function claim_cb(const _tok_balance: nat; var _store : storage_t): return_t is (failwith("Not-implemented"): return_t)