[@inline]
function verify_sender(const approved: address): unit is
  assert_with_error(Tezos.sender = approved, Errors.prx_not_authenticated);

function set_admin(const new_admin: address; const store: storage_t): return_t is
  block {
    verify_sender(store.admin);
  } with (Constants.no_operations, store with record[ admin = new_admin ]);

(* Get tokens from dex. Transfer tokens dex -> proxy. Must be approved/permitted before call. *)
function stake(const params: stake_prm_t; var store: storage_t): return_t is
  block {
    verify_sender(store.dex);
    var return: return_t := add_tokens(params.value, Constants.no_operations, store);
    return.0 := typed_approve(
      store.stake_info.location,
      params.value,
      store.stake_token
    ) # return.0;
  } with return

function balance_cb(const bal: nat; const store: storage_t): return_t is
  block {
    const tmp = unwrap(store.tmp, Errors.no_action);
    verify_sender(get_token_address(tmp.sender));
  } with if tmp.action_flag = 1n
      then stake_cb(bal, store)
    else if tmp.action_flag = 2n
      then claim_cb(bal, store)
    else if tmp.action_flag = 3n
      then redeem_cb(bal, store)
    else (failwith(Errors.no_action): return_t);

(* Stake tokens to farm. Transfer tokens proxy -> farm. Must be approved/permitted before call. *)
function unwrap_fa2_bal(const response: list (balance_of_fa2_res_t); const store: storage_t): return_t is
  block {
    var bal : nat := 0n;
    const tmp = unwrap(store.tmp, Errors.no_action);
    const token_id: token_id_t = case tmp.sender of
      Fa2(inf) -> inf.token_id
    | _ -> (failwith(Errors.no_token_info): token_id_t)
    end;
    function get_fa2_balance(
      var bal           : nat;
      const v           : balance_of_fa2_res_t)
                        : nat is
      block {
        const request : balance_of_fa2_req_t = record [
          token_id = token_id;
          owner    = Tezos.self_address;
        ];

        if v.request = request
        then bal := v.balance
        else skip;
      } with bal;

    bal := List.fold(get_fa2_balance, response, bal);
  } with balance_cb(bal, store);

(* Stake tokens to farm. Transfer tokens dex -> farm. Must be approved/permitted before call. *)
function unstake(const params: unstake_prm_t; const store: storage_t): return_t is
  block {
    verify_sender(store.dex);
    var return := redeem_tokens(params, Constants.no_operations, store);
    return.0 := typed_balance_of(
      Tezos.self_address,
      store.stake_token
    ) # return.0;

  } with return

(* Stake tokens to farm. Transfer tokens dex -> farm. Must be approved/permitted before call. *)
function claim(const _params: claim_prm_t; const store: storage_t): return_t is
  block {
    verify_sender(store.dex);
  } with claim_rewards(Constants.no_operations, store)