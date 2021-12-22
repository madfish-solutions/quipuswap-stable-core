type account_rwrd_t    is [@layout:comb] record [
  reward              : nat; (* amount of rewards to be minted for user *)
  former              : nat; (* previous amount of rewards minted for user *)
 ]

type tkns_map_t        is map(nat, token_t); (* NOTE: maximum 4 tokens from 0 to 3 *)

type tmp_tkns_map_t     is record [
    tokens  : tkns_map_t;
    index   : nat;
  ];

type stkr_info_t   is [@layout:comb] record [
  balance                 : nat;
  earnings                : map(tkn_pool_idx_t, account_rwrd_t);
]

type stkr_acc_t    is [@layout:comb] record [
  accumulator             : map(tkn_pool_idx_t, nat);
  total_staked            : nat;
]

type account_data_t  is [@layout:comb] record [
  allowances              : set(address);
]

type fees_storage_t  is [@layout:comb] record [
  lp_fee                  : nat;
  stakers_fee             : nat;
  ref_fee                 : nat;
  dev_fee                 : nat;
]


type tkn_inf_t    is  [@layout:comb] record [
  rate                    : nat;
  (*  value = 10eN
      where N is the number of decimal places to normalize to 10e18.
      Example:  1_000_000_000_000_000_000n;                 // Token has 18 decimal places.
                1_000_000_000_000_000_000_000_000n;         // Token has 12 decimal places.
                1_000_000_000_000_000_000_000_000_000_000n; // Token has 6 decimal places.
  *)
  (* percent * 100_000 -
      percent of liquidity could be staked by the proxy to earn additional interest
  *)
  precision_multiplier    : nat;
  (* each value = 10eN
      where N is the number of decimal places to normalize to 10e18 from `rate`.
      Example:  1n;                 // Token has 18 decimal places and rate are 10e18.
                1_000_000n;         // Token has 12 decimal places and rate are 10e24.
                1_000_000_000_000n; // Token has 6 decimal places and rate are 10e30.
    *)
  reserves                : nat;
]

type pair_t             is [@layout:comb] record [
  initial_A               : nat; (* Constant that describes A constant *)
  initial_A_time          : timestamp;
  future_A                : nat;
  future_A_time           : timestamp;
  tokens_info             : map(tkn_pool_idx_t, tkn_inf_t);
  fee                     : fees_storage_t;

  staker_accumulator      : stkr_acc_t;

  proxy_contract          : option(address);
  // proxy_limits            : map(tkn_pool_idx_t, nat);
  proxy_reward_acc        : map(token_t, nat);

  (* LP data *)

  total_supply            : nat; (* total shares count *)
]

type storage_t       is [@layout:comb] record [
  (* Management *)
  admin                   : address;
  default_referral        : address;
  dev_address             : address;
  managers                : set(address);

  // reward_rate             : nat; (* DEFI reward rate *)
  // entered                 : bool; (* reentrancy protection *)

  (* Pools data *)
  pools_count             : nat; (* total pools count *)
  tokens                  : big_map(pool_id_t, tkns_map_t); (* all the tokens list *)
  pool_to_id              : big_map(bytes, nat); (* all the tokens list *)
  pools                   : big_map(pool_id_t, pair_t); (* pair info per token id *)

  (* FA2 data *)
  ledger                  : big_map((address * pool_id_t), nat); (* account info per address *)
  account_data            : big_map((address * pool_id_t), account_data_t); (* account info per each lp provider *)

  (* Rewards and accumulators *)
  dev_rewards             : big_map(token_t, nat);
  referral_rewards        : big_map((address * token_t), nat);
  quipu_token             : fa2_token_t;
  stakers_balance         : big_map((address * pool_id_t), stkr_info_t); (**)
]


type full_storage_t  is [@layout:comb] record [
  storage                 : storage_t; (* real dex storage_t *)
  (* Token Metadata *)
  metadata                : big_map(string, bytes); (* metadata storage_t according to TZIP-016 *)
  token_metadata          : big_map(token_id_t, tkn_meta_info_t);
  (* Contract lambdas storage *)
  admin_lambdas           : big_map(nat, bytes); (* map with admin-related functions code *)
  dex_lambdas             : big_map(nat, bytes); (* map with exchange-related functions code *)
  token_lambdas           : big_map(nat, bytes); (* map with token-related functions code *)
  permit_lambdas          : big_map(nat, bytes); (* map with permit-related functions code *)

  (* Permits *)
  permits             : permits_t;
  permits_counter     : nat;
  default_expiry      : nat;
]

type return_t           is list (operation) * storage_t
type full_return_t      is list (operation) * full_storage_t
