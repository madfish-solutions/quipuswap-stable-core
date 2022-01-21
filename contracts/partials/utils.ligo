function get_token_address(
  const token           : token_t)
                        : address is
  case token of
  | Fa2(inf) -> inf.token_address
  | Fa12(addr) -> addr
  end

function unwrap_or(
  const param           : option(_a);
  const default         : _a)
                        : _a is
  case param of
  | Some(instance) -> instance
  | None -> default
  end;

function unwrap(
  const param           : option(_a);
  const error           : string)
                        : _a is
  case param of
  | Some(instance) -> instance
  | None -> failwith(error)
  end;

[@inline] function nat_or_error(
  const value           : int;
  const err             : string)
                        : nat is
  unwrap(is_nat(value), err);

(* Helper function to get fa2 token contract *)
function get_fa2_token_transfer_contract(
  const token_address   : address)
                        : contract(entry_fa2_t) is
  unwrap(
    (Tezos.get_entrypoint_opt("%transfer", token_address): option(contract(entry_fa2_t))),
    Errors.Dex.wrong_token_entrypoint
  );

(* Helper function to get fa1.2 token contract *)
function get_fa12_token_transfer_contract(
  const token_address   : address)
                        : contract(entry_fa12_t) is
  unwrap(
    (Tezos.get_entrypoint_opt("%transfer", token_address): option(contract(entry_fa12_t))),
    Errors.Dex.wrong_token_entrypoint
  );

(* Helper function to get fa2 token contract *)
function get_fa2_token_approve_contract(
  const token_address   : address)
                        : contract(approve_fa2_t) is
  unwrap(
    (Tezos.get_entrypoint_opt("%update_operators", token_address): option(contract(approve_fa2_t))),
    Errors.Dex.wrong_token_entrypoint
  );

(* Helper function to get fa1.2 token contract *)
function get_fa12_token_approve_contract(
  const token_address   : address)
                        : contract(approve_fa12_t) is
  unwrap(
    (Tezos.get_entrypoint_opt("%approve", token_address): option(contract(approve_fa12_t))),
    Errors.Dex.wrong_token_entrypoint
  );


(* Helper function to transfer the asset based on its standard *)
function typed_transfer(
  const owner           : address;
  const receiver        : address;
  const amount_         : nat;
  const token           : token_t)
                        : operation is
    case token of
    | Fa12(token_address) -> Tezos.transaction(
        TransferTypeFA12(owner, (receiver, amount_)),
        0mutez,
        get_fa12_token_transfer_contract(token_address)
      )
    | Fa2(token_info) -> Tezos.transaction(
        TransferTypeFA2(list[ record [
            from_ = owner;
            txs = list [ record [
                to_           = receiver;
                token_id      = token_info.token_id;
                amount        = amount_;
          ]]]]
        ),
        0mutez,
        get_fa2_token_transfer_contract(token_info.token_address)
      )
    end;

function typed_approve(
  const owner           : address;
  const spender         : address;
  const amount_         : nat;
  const token           : token_t)
                        : operation is
  case token of
    | Fa12(token_address) -> Tezos.transaction(
        ApproveFA12(record[
          spender = spender;
          value = amount_
        ]),
        0mutez,
        get_fa12_token_approve_contract(token_address)
      )
    | Fa2(token_info) -> Tezos.transaction(
        ApproveFA2(list[ if amount_ > 0n
          then Add_operator(record[
            owner = owner;
            operator = spender;
            token_id = token_info.token_id;
          ])
          else Remove_operator(record[
            owner = owner;
            operator = spender;
            token_id = token_info.token_id;
          ])
        ]),
        0mutez,
        get_fa2_token_approve_contract(token_info.token_address)
      )
    end;

[@inline] function div_ceil(
  const numerator       : nat;
  const denominator     : nat)
                        : nat is
  case ediv(numerator, denominator) of
  | Some(result) -> if result.1 > 0n
    then result.0 + 1n
    else result.0
  | None -> (failwith(Errors.Math.ediv_error): nat)
  end;

(* Contract admin check *)
function check_admin(
  const admin           : address)
                        : unit is
  assert_with_error(Tezos.sender = admin, Errors.Dex.not_contract_admin);

(* Contract admin or dev check *)
function check_dev(
  const dev             : address)
                        : unit is
  assert_with_error(Tezos.sender = dev, Errors.Dex.not_developer);

function check_time_expiration(
  const exp             : timestamp)
                        : unit is
  assert_with_error(exp >= Tezos.now, Errors.Dex.time_expired);

function set_func_or_fail(
  const params          : set_lambda_func_t;
  const max_idx         : nat;
  var lambda_storage    : big_map(nat, bytes))
                        : big_map(nat, bytes) is
  block {
    assert_with_error(params.index < max_idx, Errors.Dex.wrong_index);
    assert_with_error(not Big_map.mem(params.index, lambda_storage), Errors.Dex.func_set);
    lambda_storage[params.index] := params.func;
  } with lambda_storage

(*
 * Helper function that merges two list`s.
 *)
function concat_lists(
  const fst             : list(_a);
  const snd             : list(_a))
                        : list(_a) is
  List.fold_right(
    function(
      const operation   : _a;
      const operations  : list(_a))
                        : list(_a) is
      operation # operations,
    fst,
    snd
  )


(* Get token from map tokens of pool by inner index *)
function get_token_by_id(
  const token_id        : tkn_pool_idx_t;
  const map_entry       : option(tkns_map_t))
                        : token_t is
  block {
    const tokens = unwrap(map_entry, Errors.Dex.pool_not_listed);
    const token = unwrap(tokens[token_id], Errors.Dex.wrong_index);
  } with token;

(* Lambda setter (only for admin usage in init setup) *)
[@inline] function set_function(
  const f_type          : func_entry_t;
  const params          : set_lambda_func_t;
  var   s               : full_storage_t)
                        : full_storage_t is
  block {

#if FACTORY
#if !FOUR
    check_dev(s.storage.dev_store.dev_address);
#endif
#else
    check_admin(s.storage.admin);
#endif
    case f_type of
    | FAdmin  -> s.admin_lambdas := set_func_or_fail(params, Constants.admin_func_count,  s.admin_lambdas)
    | FPermit -> s.permit_lambdas := set_func_or_fail(params, Constants.permit_func_count, s.permit_lambdas)
    | FDex    -> s.dex_lambdas := set_func_or_fail(params, Constants.dex_func_count, s.dex_lambdas)
    | FToken  -> s.token_lambdas := set_func_or_fail(params, Constants.token_func_count,  s.token_lambdas)
#if !FOUR
    | FDev    -> s.storage.dev_store.dev_lambdas := set_func_or_fail(params, Constants.dev_func_count,  s.storage.dev_store.dev_lambdas)
#else
    | _ -> skip
#endif
    end
  } with s

