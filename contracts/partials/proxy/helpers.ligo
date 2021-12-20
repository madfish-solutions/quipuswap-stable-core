[@inline]
function verify_sender(const approved: address): unit is
  assert_with_error(Tezos.sender = approved, Errors.prx_not_authenticated);

function cas_tmp_extra(
    const new_flag: nat;
    const sndr: token_t;
    const s: storage_t;
    const extra: option(receiver_t);
    const value: option(nat);
    const op_token: token_t
  ): storage_t is
  case s.tmp of
    Some(_) -> failwith(Errors.flag_set)
  | None -> s with record[
      tmp = Some(record[
        action_flag = new_flag;
        sender = sndr;
        extra = extra;
        value = value;
        token = op_token;
      ])
    ]
  end;

function cas_tmp(
    const new_flag: nat;
    const sndr: token_t;
    const s: storage_t;
    const op_token: token_t
  ): storage_t is
  cas_tmp_extra(
    new_flag,
    sndr,
    s,
    (None: option(receiver_t)),
    (None: option(nat)),
    op_token
  )

function reset_tmp(const s: storage_t): storage_t is s with record[ tmp = (None: option(tmp_t)) ]

function get_upd_prx_rew_ep(const dex: address): contract(upd_prx_rew_t) is
  unwrap(
    (Tezos.get_entrypoint_opt("%update_proxy_reward", dex): option(contract(upd_prx_rew_t))),
    Errors.dex_ep_404
  );

function get_upd_res_ep(const dex: address): contract(upd_res_t) is
  unwrap(
    (Tezos.get_entrypoint_opt("%update_reserves", dex): option(contract(upd_res_t))),
    Errors.dex_ep_404
  );


[@inline]
function get_bal_fa2_cb(const self: address): contract(list(balance_of_fa2_res_t)) is unwrap(
    (Tezos.get_entrypoint_opt("%unwrap_FA2_balance", self): option(contract(list(balance_of_fa2_res_t)))),
    Errors.wrong_entrypoint
  );

[@inline]
function get_bal_fa12_cb(const self: address): contract(nat) is unwrap(
    (Tezos.get_entrypoint_opt("%balance_cb", self): option(contract(nat))),
    Errors.wrong_entrypoint
  );

(* Helper function to get fa2 token contract *)
function fa2_token_bal_of_ep(const token_address: address): contract(balance_fa2_t) is
  unwrap_or(
    (Tezos.get_entrypoint_opt("%balance_of", token_address): option(contract(balance_fa2_t))),
    unwrap(
      (Tezos.get_entrypoint_opt("%balanceOf",  token_address): option(contract(balance_fa2_t))),
      Errors.wrong_token_entrypoint
    )
  );

(* Helper function to get fa1.2 token contract *)
function fa12_token_bal_of_ep(const token_address: address): contract(balance_fa12_t) is
  unwrap_or(
    (Tezos.get_entrypoint_opt("%getBalance", token_address): option(contract(balance_fa12_t))),
    unwrap_or(
      (Tezos.get_entrypoint_opt("%get_balance", token_address): option(contract(balance_fa12_t))),
      unwrap_or(
        (Tezos.get_entrypoint_opt("%balanceOf",  token_address): option(contract(balance_fa12_t))),
        unwrap(
          (Tezos.get_entrypoint_opt("%balance_of",  token_address): option(contract(balance_fa12_t))),
          Errors.wrong_token_entrypoint
        )
      )
    )
  );

(* Helper function to get fa1.2 token contract *)
function fa12_token_approve_ep(const token_address: address): contract(approve_fa12_t) is
  unwrap(
    (Tezos.get_entrypoint_opt("%approve", token_address): option(contract(approve_fa12_t))),
    Errors.wrong_token_entrypoint
  );

(* Helper function to get fa1.2 token contract *)
function fa2_token_approve_ep(const token_address: address): contract(approve_fa2_t) is
  unwrap(
    (Tezos.get_entrypoint_opt("%update_operators", token_address): option(contract(approve_fa2_t))),
    Errors.wrong_token_entrypoint
  );


(* Helper function to transfer the asset based on its standard *)
function typed_balance_of(
  const contract          : address;
  const token             : token_t)
                          : operation is
    case token of
      Fa12(token_address) -> Tezos.transaction(
        BalanceOfTypeFA12(contract, get_bal_fa12_cb(Tezos.self_address)),
        0mutez,
        fa12_token_bal_of_ep(token_address)
      )
    | Fa2(token_info) -> Tezos.transaction(
        BalanceOfTypeFA2(record[
          requests = list[
            record[
              owner     = contract;
              token_id  = token_info.token_id;
            ]
          ];
          callback = get_bal_fa2_cb(Tezos.self_address)
        ]
        ),
        0mutez,
        fa2_token_bal_of_ep(token_info.token_address)
      )
    end;

(* Helper function to transfer the asset based on its standard *)
function typed_approve(
  const spender           : address;
  const value             : nat;
  const token             : token_t)
                          : operation is
    case token of
      Fa12(token_address) -> Tezos.transaction(
        ApproveFA12(record[spender=spender; value=value]),
        0mutez,
        fa12_token_approve_ep(token_address)
      )
    | Fa2(token_info) -> Tezos.transaction(
        ApproveFA2(
          if value = 0n
            then list[
              Remove_operator(record [
                owner = Tezos.self_address;
                operator = spender;
                token_id = token_info.token_id;
              ])
            ]
          else list[
              Add_operator(record [
                owner = Tezos.self_address;
                operator = spender;
                token_id = token_info.token_id;
              ])
            ]
        ),
        0mutez,
        fa2_token_approve_ep(token_info.token_address)
      )
    end;
