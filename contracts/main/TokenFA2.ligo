#include "../partials/Constants.ligo"
#include "../interfaces/ITokenFA2.ligo"
#include "../partials/TokenFA2_storage.ligo"
#include "../helpers/FA2_helpers.ligo"


(* Helper function to get account *)
function get_account (const addr : address; const s : storage_type): account_info is
  case s.ledger[addr] of
  | Some(instance) -> instance
  | None -> record [balance = 0n; allowances = (set []: set(address));]
  end;

(* Token id check *)
[@inline]
function check_token_id(const id: token_id): unit is
  if default_token_id =/= id
    then failwith("FA2_TOKEN_UNDEFINED")
  else Unit;

(* Perform transfers from one owner *)
function iterate_transfer (const s : storage_type; const user_trx_params : transfer_param) : storage_type is
  block {
    (* Perform single transfer *)
    function make_transfer(var s : storage_type; const transfer : transfer_destination) : storage_type is
      block {
        check_token_id(transfer.token_id);

        var sender_account : account_info := get_account(user_trx_params.from_, s);    (* Retrieve sender account from storage_type *)

        check_balance(sender_account, transfer.amount);
        check_permissions(user_trx_params.from_, sender_account.allowances);
        sender_account.balance := abs(sender_account.balance - transfer.amount);  (* Update sender balance *)
        s.ledger[user_trx_params.from_] := sender_account;                        (* Update storage_type *)

        var dest_account : account_info := get_account(transfer.to_, s);               (* Get or create destination account *)

        dest_account.balance := dest_account.balance + transfer.amount;           (* Update destination balance *)
        s.ledger[transfer.to_] := dest_account;                                   (* Update storage_type *)
    } with s;
} with (List.fold (make_transfer, user_trx_params.txs, s))

(* Perform single operator update *)
function iterate_update_operator (var s : storage_type; const params : update_operator_param) : storage_type is
  block {
    case params of
    | Add_operator(param) -> {
      check_token_id(param.token_id);
      is_owner(param.owner);

      var sender_account : account_info := get_account(param.owner, s);                      (* Get or create sender account *)

      sender_account.allowances := Set.add(param.operator, sender_account.allowances);  (* Set operator *)
      s.ledger[param.owner] := sender_account;                                          (* Update storage_type *)
    }
    | Remove_operator(param) -> {
      check_token_id(param.token_id);
      is_owner(param.owner);

      var sender_account : account_info := get_account(param.owner, s);                        (* Get or create sender account *)

      sender_account.allowances := Set.remove(param.operator, sender_account.allowances); (* Set operator *)
      s.ledger[param.owner] := sender_account;                                            (* Update storage_type *)
    }
    end
  } with s


(* Perform balance look up *)
function balance_of (const bal_fa2_type : bal_fa2_type; const s : storage_type) : list(operation) is
  block {

    (* Perform single balance lookup *)
    function look_up_balance(
      const l       : list(balance_of_response);
      const request : balance_of_request
    )               : list(balance_of_response) is
      block {
        check_token_id(request.token_id);

        const sender_account : account_info = get_account(request.owner, s);         (* Retrieve the asked account balance from storage_type *)

        const response : balance_of_response = record [                         (* Form the response *)
          request   = request;
          balance   = sender_account.balance;
        ];
      } with response # l;

    const accumulated_response : list (balance_of_response) = List.fold(        (* Collect balances info *)
      look_up_balance,
      bal_fa2_type.requests,
      (nil: list(balance_of_response))
    );
  } with list [transaction(accumulated_response, 0tz, bal_fa2_type.callback)]

(* TokenFA2 - Mock FA2 token for tests *)
function main(const action : token_action_type; var s : storage_type) : return_type is
  case action of
  | Transfer(params)                  -> (no_operations, List.fold(iterate_transfer, params, s))
  | Balance_of(params)                -> (balance_of(params, s), s)
  | Update_operators(params)          -> (no_operations, List.fold(iterate_update_operator, params, s))
  end;
