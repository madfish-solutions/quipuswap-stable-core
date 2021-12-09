[@inline]
function nat_or_error(
  const value: int;
  const err: string
  ): nat is
  case is_nat(value) of
  | Some(natural) -> natural
  | None -> (failwith(err): nat)
  end;

(* Helper function to transfer the asset based on its standard *)
function typed_transfer(
  const owner           : address;
  const receiver        : address;
  const amount_         : nat;
  const token           : token_t)
                        : operation is
    case token of
      Fa12(token_address) -> Tezos.transaction(
        TransferTypeFA12(owner, (receiver, amount_)),
        0mutez,
        get_fa12_token_contract(token_address)
      )
    | Fa2(token_info) -> Tezos.transaction(
        TransferTypeFA2(list[
          record[
            from_ = owner;
            txs = list [ record [
                to_           = receiver;
                token_id      = token_info.token_id;
                amount        = amount_;
              ] ]
          ]
        ]),
        0mutez,
        get_fa2_token_contract(token_info.token_address)
      )
    end;

[@inline]
function div_ceil(
  const numerator       : nat;
  const denominator     : nat)
                        : nat is
  case ediv(numerator, denominator) of
    Some(result) -> if result.1 > 0n
      then result.0 + 1n
      else result.0
  | None -> (failwith(Errors.no_liquidity): nat)
  end;

const default_tmp_tokens : tmp_tkns_map_t = record [
    tokens = (map[] : tkns_map_t);
    index  = 0n;
  ];
