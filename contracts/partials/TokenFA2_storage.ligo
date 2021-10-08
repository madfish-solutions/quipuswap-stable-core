#include "../interfaces/ITokenFA2.ligo"

type token_metadata_info_with_extras is record [
    token_id              : token_id;
    extras                : map (string, bytes);
  ]

(* contract storage_type *)
type storage_type       is record [
    total_supply          : nat;
    ledger                : big_map (address, account_info);
    token_metadata        : big_map (token_id, token_metadata_info_with_extras);
    metadata              : big_map(string, bytes);
  ]

type return_type        is list (operation) * storage_type

type transfer_type is list (transfer_param)
// type bal_fa2_type is michelson_pair_right_comb(balance_params_r)
type operator_type is list (update_operator_param)

type token_action_type is
| Transfer                of transfer_type
| Balance_of              of bal_fa2_type
| Update_operators        of operator_type
