(* Helper function to get pair info *)
function get_address(
  const referral        : option(address);
  const default_addr    : address)
                        : address is
  case referral of
  | Some(instance) -> instance
  | None -> default_addr
  end;

(* Helper function to get account *)
function get_account_balance(
  const key             : (address * pool_id_type);
  const ledger          : big_map((address * pool_id_type), nat))
                        : nat is
  case ledger[key] of
  | Some(instance) -> instance
  | None -> 0n
  end;

(* Gets token count by size of reserves map *)
function get_token_by_id(
    const token_id  : token_pool_index;
    const map_entry : option(tokens_type)
  )                 : token_type is
  block {
    const tokens = case map_entry of
    | Some(tokens) -> tokens
    | None -> (failwith(ERRORS.pair_not_listed): tokens_type)
    end;
    const token = case tokens[token_id] of
    | Some(token) -> token
    | None -> (failwith("wrong_id"): token_type)
    end;
   } with token;

function get_default_refer(const s: storage_type): address is s.default_referral;

(* Helper function to get fa2 token contract *)
function get_fa2_token_contract(
  const token_address   : address)
                        : contract(entry_fa2_type) is
  case (Tezos.get_entrypoint_opt("%transfer", token_address)
      : option(contract(entry_fa2_type))) of
    Some(contr) -> contr
  | None -> (failwith(ERRORS.wrong_token_entrypoint) : contract(entry_fa2_type))
  end;

(* Helper function to get fa1.2 token contract *)
function get_fa12_token_contract(
  const token_address   : address)
                        : contract(entry_fa12_type) is
  case (Tezos.get_entrypoint_opt("%transfer", token_address)
     : option(contract(entry_fa12_type))) of
    Some(contr) -> contr
  | None -> (failwith(ERRORS.wrong_token_entrypoint) : contract(entry_fa12_type))
  end;

(* Helper function to get token pair *)
function get_pair_info(
  const token_bytes     : bytes;
  const pools_count     : nat;
  const pool_to_id      : big_map(bytes, nat);
  const pools           : big_map(pool_id_type, pair_type))
                        : (pair_type * nat) is
  block {
    const token_id : nat =
      case pool_to_id[token_bytes] of
      | Some(instance) -> instance
      | None -> pools_count
      end;
    const pair : pair_type =
      case pools[token_id] of
      | Some(instance) -> instance
      | None -> (record [
          initial_A             = 0n;
          future_A              = 0n;
          initial_A_time        = Tezos.now;
          future_A_time         = Tezos.now;
          tokens_info           = (map []: map(token_pool_index, token_info_type));
          fee                   = record [
            dev_fee               = 0n;
            lp_fee                = 0n;
            ref_fee               = 0n;
            stakers_fee           = 0n;
          ];
          staker_accumulator    = record [
            accumulator           = (map []: map(token_pool_index, nat));
            total_staked          = 0n;
          ];
          proxy_contract        = (None: option (address));
          proxy_reward_acc      = (map []: map(token_type, nat));
          total_supply          = 0n;
        ]: pair_type)
      end;
  } with (pair, token_id)

(* Helper function to get pair info *)
function get_pair(
  const pair_id         : nat;
  const pools_bm        : big_map(pool_id_type, pair_type))
                        : pair_type is
  case pools_bm[pair_id] of
  | Some(instance) -> instance
  | None -> (failwith(ERRORS.pair_not_listed): pair_type)
  end;

(* Helper function to get pair info *)
function get_tokens(
  const pair_id         : nat;
  const tokens          : big_map(pool_id_type, tokens_type))
                        : tokens_type is
  case tokens[pair_id] of
  | Some(instance) -> instance
  | None -> (failwith(ERRORS.pair_not_listed): tokens_type)
  end;

(* Helper function to get pair info *)
function get_token(
  const token_id        : nat;
  const tokens          : tokens_type)
                        : token_type is
  case tokens[token_id] of
  | Some(instance) -> instance
  | None -> (failwith(ERRORS.no_token): token_type)
  end;

(* Helper function to get pair info *)
function get_input(
  const key         : token_pool_index;
  const inputs      : map(nat, nat))
                    : nat is
  case inputs[key] of
  | Some(instance) -> instance
  | None -> 0n
  end;

(* Helper function to get pair info *)
function get_token_info(
  const key         : token_pool_index;
  const tokens_info : map(token_pool_index, token_info_type))
                    : token_info_type is
  case tokens_info[key] of
  | Some(instance) -> instance
  | None ->  (failwith(ERRORS.no_token_info) : token_info_type)
  end;

(* Helper function to get pair info *)
function get_dev_rewards(
  const key         : token_type;
  const dev_rewards : big_map(token_type, nat))
                    : nat is
  case dev_rewards[key] of
  | Some(instance) -> instance
  | None ->  0n
  end;

function get_ref_rewards(
  const key         : (address * token_type);
  const ref_rewards : big_map((address * token_type), nat))
                    : nat is
  case ref_rewards[key] of
  | Some(instance) -> instance
  | None ->  0n
  end;

function get_staker_acc(
  const stkr_key: (address * pool_id_type);
  const stkr_bm : big_map((address * pool_id_type), staker_info_type)
  )             : staker_info_type is
  case (stkr_bm[stkr_key]: option(staker_info_type)) of
  | Some(acc) -> acc
  | None -> (
      record [
        balance   = 0n;
        earnings  = (map []: map(token_pool_index, acc_reward_type));
      ]
      : staker_info_type
    )
  end;
