[@inline]
function verify_sender(const approved: address): unit is
  assert_with_error(Tezos.sender = approved, Errors.prx_not_authenticated);

function set_admin(const new_admin: address, const store: storage_t): return_t is
  block {
    verify_sender(s.admin);
  } with (Constants.no_operations, store with [ admin = new_admin ]);

(* Get tokens from dex. Transfer tokens dex -> proxy. Must be approved/permitted before call. *)
function stake(const params: stake_prm_t, var store: storage_t): return_t is
  block {
    verify_sender(s.dex);
    var return: return_t := add_tokens(params.value, s);
    return.0 := typed_approve(
      s.farm,
      params.value,
      s.stake_token
    ) # return.0;
  } with return

function balance_cb(const bal: nat; const store: storage_t): return_t is
  block {
    const tmp = unwrap(s.tmp, Errors.no_action);
    verify_sender(tmp.sender);
  } with case tmp.action_flag of
    1n -> stake_cb(bal, store)
    2n -> claim_rewards(bal, store)
    3n -> send_after_unstake(bal, tmp.extra, store)
    end;

(* Stake tokens to farm. Transfer tokens proxy -> farm. Must be approved/permitted before call. *)
function unwrap_fa2_bal(const params: list (balance_of_fa2_res_t), const store: storage_t): return_t is
  block {
    var bal : nat := 0n;
    function get_fa2_balance(
      var bal           : nat;
      const v           : balance_response_t)
                        : nat is
      block {
        const request : balance_request_t = record [
          token_id = token_id;
          owner    = owner;
        ];

        if v.request = request
        then bal := v.balance
        else skip;
      } with bal;

    bal := List.fold(get_fa2_balance, response, bal);
  } with balance_cb(bal, store);

(* Stake tokens to farm. Transfer tokens dex -> farm. Must be approved/permitted before call. *)
function unstake(const params: unstake_prm_t, const store: storage_t): return_t is
  block {
    verify_sender(s.dex);
    var operations := redeem_tokens(params, operations);
    operations := typed_balance_of(
      Tezos.self_address,
      s.stake_token
    ) # operations;

  } with (operations, store)