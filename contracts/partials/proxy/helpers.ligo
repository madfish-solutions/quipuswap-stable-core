function cas_tmp_extra(const new_flag: nat; const sender: address; const s: storage_t; extra: optional(receiver_t); value: optional(nat)): storage_t is
 block {
   const tmp = unwrap_or(
      s.tmp,
      record [
        action_flag = new_flag;
        sender = sender;
        extra = extra;
        value = value;
      ]
    )
   assert_with_error(tmp = 0n, Errors.flag_set)
 } with s with record[ tmp = tmp ]

function cas_tmp(const new_flag: nat; const sender: address; const s: storage_t): storage_t is cas_tmp_extra(new_flag, sender, s)

function reset_tmp(const s: storage_t): storage_t is s with record[ tmp = None ]

function get_bal_fa2_cb(const _: unit): contract(nat) is Tezos.self("%unwrap_fa2_bal")

function get_bal_fa12_cb(const _: unit): contract(nat) is Tezos.self("%balance_cb")

(* Helper function to get fa2 token contract *)
function fa2_token_bal_of_ep(const token_address: address): contract(list (balance_of_fa2_res_t)) is
  unwrap_or(
    (Tezos.get_entrypoint_opt("%balance_of", token_address): option(contract(list (balance_of_fa2_res_t)))),
    unwrap(
      (Tezos.get_entrypoint_opt("%balanceOf",  token_address): option(contract(balance_of_fa2_res_t))),
      Errors.wrong_token_entrypoint
    )
  );

(* Helper function to get fa1.2 token contract *)
function fa12_token_bal_of_ep(const token_address: address): contract(nat) is
  unwrap_or(
    (Tezos.get_entrypoint_opt("%getBalance", token_address): option(contract(nat))),
    unwrap_or(
      (Tezos.get_entrypoint_opt("%get_balance", token_address): option(contract(nat))),
      unwrap_or(
        (Tezos.get_entrypoint_opt("%balanceOf",  token_address): option(contract(nat))),
        unwrap(
          (Tezos.get_entrypoint_opt("%balance_of",  token_address): option(contract(nat))),
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
function fa2_token_approve_ep(const token_address: address): contract(operator_prm_t) is
  unwrap(
    (Tezos.get_entrypoint_opt("%update_operators", token_address): option(contract(operator_prm_t))),
    Errors.wrong_token_entrypoint
  );


(* Helper function to transfer the asset based on its standard *)
function typed_balance_of(
  const contract          : address;
  const token             : token_t)
                          : operation is
    case token of
      Fa12(token_address) -> Tezos.transaction(
        BalanceOfTypeFA12(contract, get_bal_fa12_cb(Unit)),
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
          callback = get_bal_fa2_cb(Unit)
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
        ApproveFA12(spender, value),
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
