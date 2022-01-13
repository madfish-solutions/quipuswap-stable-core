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
function check_admin_or_dev(
  const admin           : address;
  const dev             : address)
                        : unit is
  assert_with_error(Tezos.sender = admin or Tezos.sender = dev, Errors.Dex.not_contract_admin);

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
  const fst             : list(operation);
  const snd             : list(operation))
                        : list(operation) is
  List.fold_right(
    function(
      const operation   : operation;
      const operations  : list(operation))
                        : list(operation) is
      operation # operations,
    fst,
    snd
  )

