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

(* Gets token count by size of reserves map *)
function get_token_by_id(
    const token_id  : tkn_pool_idx_t;
    const map_entry : option(tkns_map_t)
  )                 : token_t is
  block {
    const tokens = unwrap(map_entry, Errors.pair_not_listed);
    const token = unwrap(tokens[token_id], Errors.wrong_index);
  } with token;

(* Helper function to get fa2 token contract *)
function get_fa2_token_contract(
  const token_address   : address)
                        : contract(entry_fa2_t) is
  unwrap((Tezos.get_entrypoint_opt("%transfer", token_address)
      : option(contract(entry_fa2_t))), Errors.wrong_token_entrypoint);

(* Helper function to get fa1.2 token contract *)
function get_fa12_token_contract(
  const token_address   : address)
                        : contract(entry_fa12_t) is
  unwrap((Tezos.get_entrypoint_opt("%transfer", token_address)
      : option(contract(entry_fa12_t))), Errors.wrong_token_entrypoint);

(* Helper function to get token pair *)
function get_pair_info(
  const token_bytes     : bytes;
  const pools_count     : nat;
  const pool_to_id      : big_map(bytes, nat);
  const pools           : big_map(pool_id_t, pair_t))
                        : (pair_t * nat) is
  block {
    const token_id : nat = unwrap_or(pool_to_id[token_bytes], pools_count);
    const pair : pair_t = unwrap_or(pools[token_id], record [
      initial_A             = 0n;
      future_A              = 0n;
      initial_A_time        = Tezos.now;
      future_A_time         = Tezos.now;
      tokens_info           = (map []: map(tkn_pool_idx_t, tkn_inf_t));
      fee                   = record [
        dev_fee               = 0n;
        lp_fee                = 0n;
        ref_fee               = 0n;
        stakers_fee           = 0n;
      ];
      staker_accumulator    = record [
        accumulator           = (map []: map(tkn_pool_idx_t, nat));
        total_staked          = 0n;
      ];
      proxy_contract        = (None: option (address));
      proxy_reward_acc      = (map []: map(token_t, nat));
      total_supply          = 0n;
    ]);
  } with (pair, token_id)

(* Helper function to get pair info *)
function get_token_info(
  const key         : tkn_pool_idx_t;
  const tokens_info : map(tkn_pool_idx_t, tkn_inf_t))
                    : tkn_inf_t is
  unwrap(tokens_info[key], Errors.no_token_info);

