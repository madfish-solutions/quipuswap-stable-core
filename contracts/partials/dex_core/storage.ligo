type account_reward_t   is [@layout:comb] record [
  reward_f                : nat; (* amount of rewards to be minted for user *)
  former_f                : nat; (* previous amount of rewards minted for user *)
]

type staker_info_t      is [@layout:comb] record [
  balance                 : nat;
  earnings                : map(token_pool_idx_t, account_reward_t);
]

type staker_accum_t     is [@layout:comb] record [
  accumulator_f           : map(token_pool_idx_t, nat);
  total_fees              : map(token_pool_idx_t, nat);
  total_staked            : nat;
]

type allowances_data_t     is set(address);

type fees_storage_t     is [@layout:comb] record [
  lp_f                    : nat;
  stakers_f               : nat;
  ref_f                   : nat;
]


type token_info_t       is  [@layout:comb] record [
  rate_f                  : nat;
  (*  value = 10eN
      where N is the number of decimal places to normalize to 10e18.
      Example:  1_000_000_000_000_000_000n;                 // Token has 18 decimal places.
                1_000_000_000_000_000_000_000_000n;         // Token has 12 decimal places.
                1_000_000_000_000_000_000_000_000_000_000n; // Token has 6 decimal places.
  *)
  precision_multiplier_f  : nat;
  (* each value = 10eN
      where N is the number of decimal places to normalize to 10e18 from `rate`.
      Example:  1n;                 // Token has 18 decimal places and rate are 10e18.
                1_000_000n;         // Token has 12 decimal places and rate are 10e24.
                1_000_000_000_000n; // Token has 6 decimal places and rate are 10e30.
    *)
  reserves                : nat;
]

type pool_t             is [@layout:comb] record [
  initial_A_f             : nat; (* Constant that describes A constant *)
  initial_A_time          : timestamp;
  future_A_f              : nat;
  future_A_time           : timestamp;
  tokens_info             : map(token_pool_idx_t, token_info_t);
  fee                     : fees_storage_t;

  strategy                : strategy_full_storage_t;

  staker_accumulator      : staker_accum_t;

  (* LP data *)

  total_supply            : nat; (* total shares count *)
]

type storage_t          is [@layout:comb] record [
  (* Management *)
  admin                   : address;
  default_referral        : address;
  managers                : set(address);

  (* Pools data *)
  pools_count             : nat; (* total pools count *)
  tokens                  : big_map(pool_id_t, tokens_map_t); (* all the tokens list *)
  pool_to_id              : big_map(bytes, nat); (* all the tokens list *)
  pools                   : big_map(pool_id_t, pool_t); (* pool info per token id *)

  (* FA2 data *)
  ledger                  : big_map((address * pool_id_t), nat); (* account info per address *)
  allowances              : big_map((address * pool_id_t), allowances_data_t); (* account info per each lp provider *)
  token_metadata          : big_map(token_id_t, token_meta_info_t);

  (* Rewards and accumulators *)
  dev_rewards             : big_map(token_t, nat);
  referral_rewards        : big_map((address * token_t), nat);
  stakers_balance         : big_map((address * pool_id_t), staker_info_t);
  quipu_token             : fa2_token_t;
  (* dev storage params *)
#if FACTORY
  factory_address         : address;
  started                 : bool;
#else
  strategy_factory        : set(address);
  dev_store               : dev_storage_t;
#endif
]


type full_storage_t     is [@layout:comb] record [
  storage                 : storage_t; (* real dex storage_t *)
  (* Token Metadata *)
  metadata                : big_map(string, bytes); (* metadata storage_t according to TZIP-016 *)
  (* Contract lambdas storage *)
  admin_lambdas           : big_map(nat, bytes); (* map with admin-related functions code *)
  dex_lambdas             : big_map(nat, bytes); (* map with exchange-related functions code *)
  token_lambdas           : big_map(nat, bytes); (* map with token-related functions code *)
  strat_lambdas           : big_map(nat, bytes); (* map with strategy-related functions code *)
]

type return_t           is list(operation) * storage_t

type strat_func_t       is (strategy_action_t * storage_t) -> return_t

type full_return_t      is list(operation) * full_storage_t
