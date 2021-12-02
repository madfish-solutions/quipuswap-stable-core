type pool_id_t       is nat
type token_id_t      is nat
type tkn_pool_idx_t  is nat
type a_r_flag_t      is Add | Remove

type trsfr_fa2_dst_t is [@layout:comb] record [
    to_       : address;
    token_id  : token_id_t;
    amount    : nat;
  ]
type trsfr_fa2_prm_t is [@layout:comb] record [
    from_   : address;
    txs     : list (trsfr_fa2_dst_t);
  ]
type bal_fa12_prm_t      is address * contract(nat)
type balance_of_fa2_req_t is [@layout:comb] record [
    owner       : address;
    token_id    : token_id_t;
  ]
type balance_of_fa2_res_t is [@layout:comb] record [
    request     : balance_of_fa2_req_t;
    balance     : nat;
  ]
type bal_fa2_prm_t       is [@layout:comb] record [
    requests              : list (balance_of_fa2_req_t);
    callback              : contract (list (balance_of_fa2_res_t));
]
type operator_fa2_prm_t is [@layout:comb] record [
    owner                 : address;
    operator              : address;
    token_id              : token_id_t;
  ]


type trsfr_fa12_t is michelson_pair(address, "from", michelson_pair(address, "to", nat, "value"), "")
type trsfr_fa2_t  is list (trsfr_fa2_prm_t)
type entry_fa12_t    is TransferTypeFA12 of trsfr_fa12_t
type entry_fa2_t     is TransferTypeFA2 of trsfr_fa2_t
type balance_fa12_t  is BalanceOfTypeFA12 of bal_fa12_prm_t
type balance_fa2_t   is BalanceOfTypeFA2 of bal_fa2_prm_t
type upd_operator_prm_t is
| Add_operator            of operator_fa2_prm_t
| Remove_operator         of operator_fa2_prm_t

type fa2_token_t     is [@layout:comb] record [
  token_address           : address; (* token A address *)
  token_id                : nat; (* token A identifier *)
]

type account_rwrd_t    is [@layout:comb] record [
  reward              : nat; (* amount of rewards to be minted for user *)
  former              : nat; (* previous amount of rewards minted for user *)
 ]

type tkn_meta_info_t is [@layout:comb] record [
  token_id      : nat;
  token_info    : map(string, bytes);
]

type token_t         is
| Fa12                    of address
| Fa2                     of fa2_token_t

// type token_pool_data    is [@layout:comb] record [
//   token_id      : nat;
//   token_info    : token_t;
// ]

type tkns_map_t        is map(nat, token_t); (* NOTE: maximum 4 tokens from 0 to 3 *)

type tmp_tkns_map_t     is record [
    tokens  : tkns_map_t;
    index   : nat;
  ];

type fees_storage_t  is [@layout:comb] record [
  lp_fee                  : nat;
  stakers_fee             : nat;
  ref_fee                 : nat;
  dev_fee                 : nat;
]

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
  earned_interest         : map(token_t, account_rwrd_t)
]

type withdraw_one_return is [@layout:comb] record [
  dy                      : nat;
  dy_fee                  : nat;
  ts                      : nat;
]

type tkn_inf_t    is  [@layout:comb] record [
  rate                    : nat;
  (*  value = 10eN
      where N is the number of decimal places to normalize to 10e18.
      Example:  1_000_000_000_000_000_000n;                 // Token has 18 decimal places.
                1_000_000_000_000_000_000_000_000n;         // Token has 12 decimal places.
                1_000_000_000_000_000_000_000_000_000_000n; // Token has 6 decimal places.
  *)
  proxy_limit             : nat;
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
  virtual_reserves        : nat;
]

type pair_t             is [@layout:comb] record [
  initial_A               : nat; (* Constant that describes A constant *)
  initial_A_time          : timestamp;
  future_A                : nat;
  future_A_time           : timestamp;
  // tokens_count            : nat; (* from 2 to 4 tokens at one exchange pool *)
  // tokens                  : tkns_map_t; (* list of exchange tokens *)
  // token_rates             : map(tkn_pool_idx_t, nat);
  tokens_info             : map(tkn_pool_idx_t, tkn_inf_t);
  // reserves                : map(tkn_pool_idx_t, nat); (* list of token reserves in the pool *)
  // virtual_reserves        : map(tkn_pool_idx_t, nat);

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

  reward_rate             : nat; (* DEFI reward rate *)
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

type swap_prm_t          is [@layout:comb] record [
  pair_id                 : nat; (* pair identifier *)
  idx_from                : tkn_pool_idx_t;
  idx_to                  : tkn_pool_idx_t;
  amount                  : nat;
  min_amount_out          : nat;
  time_expiration         : timestamp;
  receiver                : option(address);
  referral                : option(address);
]

type tmp_get_d_t     is [@layout:comb] record [
  d                       : nat;
  prev_d                  : nat;
]

type info_ops_acc_t     is record [
  tokens_info             : map(tkn_pool_idx_t, tkn_inf_t);
  operations              : list(operation);
];

type init_prm_t  is [@layout:comb] record [
  a_constant              : nat;
  input_tokens            : set(token_t);
  tokens_info             : map(tkn_pool_idx_t, tkn_inf_t);
]

type set_man_prm_t is [@layout:comb] record [
  add                     : bool;
  candidate               : address;
]

type invest_prm_t        is [@layout:comb] record [
  pair_id                 : nat; (* pair identifier *)
  shares                  : nat; (* the amount of shares to receive *)
  in_amounts              : map(nat, nat); (* amount of tokens, where `index of value` == `index of token` to be invested *)
  referral                : option(address);
]

type divest_prm_t        is [@layout:comb] record [
  pair_id                 : nat; (* pair identifier *)
  min_amounts_out         : map(tkn_pool_idx_t, nat); (* min amount of tokens, where `index of value` == `index of token` to be received to accept the divestment *)
  shares                  : nat; (* amount of shares to be burnt *)
]

type divest_imb_prm_t is [@layout:comb] record [
  pair_id                 : nat; (* pair identifier *)
  amounts_out             : map(tkn_pool_idx_t, nat); (* amounts of tokens, where `index of value` == `index of token` to be received to accept the divestment *)
  max_shares              : nat; (* amount of shares to be burnt *)
  referral                : option(address);
]

type divest_one_c_prm_t is [@layout:comb] record [
  pair_id                 : nat; (* pair identifier *)
  shares                  : nat; (* amount of shares to be burnt *)
  token_index             : tkn_pool_idx_t;
  min_amount_out          : nat;
  referral                : option(address);
]

type reserves_v_prm_t      is [@layout:comb] record [
  pair_id                 : nat; (* pair identifier *)
  receiver                : contract(map(nat, tkn_inf_t)); (* response receiver *)
]

type total_supply_v_prm_t  is [@layout:comb] record [
  pool_id                 : pool_id_t; (* pair identifier *)
  receiver                : contract(nat); (* response receiver *)
]

type min_received_v_prm_t  is [@layout:comb] record [
  pair_id                 : nat; (* pair identifier *)
  i                       : nat;
  j                       : nat;
  x                       : nat;
  receiver                : contract(nat); (* response receiver *)
]

type max_rate_v_prm_t    is [@layout:comb] record [
  pair_id                 : nat; (* pair identifier *)
  receiver                : contract(map(nat, nat)); (* response receiver *)
]

type calc_w_one_c_v_prm_t is [@layout:comb] record [
  pair_id                 : nat; (* pair identifier *)
  token_amount            : nat; (* LP to burn *)
  i                       : nat; (* token index in pair *)
  receiver                : contract(nat); (* response receiver *)
]

type get_dy_v_prm_t      is [@layout:comb] record [
  pair_id                 : nat; (* pair identifier *)
  i                       : nat; (* token index *)
  j                       : nat;
  dx                      : nat;
  receiver                : contract(nat); (* response receiver *)
]

type ramp_a_prm_t      is [@layout:comb] record [
  pair_id                 : nat; (* pair identifier *)
  future_A                : nat;
  future_time             : timestamp; (* response receiver *)
]

type set_proxy_prm_t   is [@layout:comb] record [
  pair_id                 : nat; (* pair identifier *)
  proxy                   : option(address);
]

type get_a_v_prm_t         is [@layout:comb] record [
  pair_id                 : nat; (* pair identifier *)
  receiver                : contract(nat);
]

type upd_proxy_lim_prm_t is [@layout:comb] record [
  pair_id                 : nat; (* pair identifier *)
  token_index             : nat; (* pair identifier *)
  limit                   : nat;
]

type set_fee_prm_t       is [@layout:comb] record [
  pool_id                 : pool_id_t;
  fee                     : fees_storage_t;
]

type set_defi_rate_prm_t is nat

type get_fee_v_prm_t       is [@layout:comb] record [
  pool_id                 : pool_id_t;
  receiver                : contract(fees_storage_t);
]

type claim_by_tkn_prm_t is [@layout:comb] record [
  token: token_t;
  amount: nat;
]

type un_stake_prm_t is [@layout:comb] record [
  pool_id: pool_id_t;
  amount: nat;
]

type claim_by_pool_tkn_prm_t is [@layout:comb] record [
  pool_id: pool_id_t;
  token: token_t;
  amount: nat;
]

type action_t        is
(* Base actions *)
| AddPair                 of init_prm_t  (* sets initial liquidity *)
| Swap                    of swap_prm_t          (* exchanges token to another token and sends them to receiver *)
| Invest                  of invest_prm_t        (* mints min shares after investing tokens *)
| Divest                  of divest_prm_t        (* burns shares and sends tokens to the owner *)
(* Custom actions *)
| DivestImbalanced        of divest_imb_prm_t
| DivestOneCoin           of divest_one_c_prm_t
(* Admin actions *)
| ClaimDeveloper          of claim_by_tkn_prm_t
| ClaimReferral           of claim_by_tkn_prm_t
| ClaimLProvider          of claim_by_pool_tkn_prm_t
| RampA                   of ramp_a_prm_t
| StopRampA               of nat
| SetProxy                of set_proxy_prm_t
| UpdateProxyLimits       of upd_proxy_lim_prm_t
| SetFees                 of set_fee_prm_t
| SetDefaultReferral      of address
| SetAdminRate            of set_defi_rate_prm_t
| Stake                   of un_stake_prm_t
| Unstake                 of un_stake_prm_t
(* VIEWS *)
| GetTokensInfo           of reserves_v_prm_t      (* returns the token info *)
| GetFees                 of get_fee_v_prm_t
// | Min_received            of min_received_v_prm_t  (* returns minReceived tokens after swapping *)
// | Tokens_per_shares       of tps_type           (* returns map of tokens amounts to recieve 1 LP *)
// | Price_cummulative       of price_cumm_type    (* returns price cumulative and timestamp per block *)
// | Calc_divest_one_coin    of calc_divest_one_coin
| GetDy                  of get_dy_v_prm_t        (* returns the current output dy given input dx *)
| GetA                   of get_a_v_prm_t

type transfer_prm_t      is list (trsfr_fa2_prm_t)
type operator_prm_t      is list (upd_operator_prm_t)
type upd_meta_prm_t    is tkn_meta_info_t

type token_action_type  is
| ITransfer               of transfer_prm_t (* transfer asset from one account to another *)
| IBalanceOf              of bal_fa2_prm_t (* returns the balance of the account *)
| IUpdateOperators        of operator_prm_t (* updates the token operators *)
| IUpdateMetadata         of upd_meta_prm_t
| ITotalSupply            of total_supply_v_prm_t

type set_tkn_func_t is [@layout:comb] record [
  func                    : bytes; (* code of the function *)
  index                   : nat; (* the key in functions map *)
]

type set_dex_func_t  is [@layout:comb] record [
  func                    : bytes; (* code of the function *)
  index                   : nat; (* the key in functions map *)
]

type full_action_t   is
| Use_dex                 of action_t
// | Use_token               of token_action_type
| Transfer                of transfer_prm_t (* transfer asset from one account to another *)
| Balance_of              of bal_fa2_prm_t (* returns the balance of the account *)
| Update_operators        of operator_prm_t (* updates the token operators *)
| Update_metadata         of upd_meta_prm_t
| Total_supply            of total_supply_v_prm_t
| SetDexFunction          of set_dex_func_t (* sets the dex specific function. Is used before the whole system is launched *)
| SetTokenFunction        of set_tkn_func_t (* sets the FA function, is used before the whole system is launched *)
| AddRemManagers          of set_man_prm_t (* adds a manager to manage LP token metadata *)
| SetDevAddress           of address
| SetRewardRate           of nat
| SetAdmin                of address
| Permit                  of permit_t
| Set_expiry              of set_expiry_t

type full_storage_t  is [@layout:comb] record [
  storage                 : storage_t; (* real dex storage_t *)
  (* Token Metadata *)
  metadata                : big_map(string, bytes); (* metadata storage_t according to TZIP-016 *)
  token_metadata          : big_map(token_id_t, tkn_meta_info_t);
  (* Contract lambdas storage *)
  dex_lambdas             : big_map(nat, bytes); (* map with exchange-related functions code *)
  token_lambdas           : big_map(nat, bytes); (* map with token-related functions code *)

  (* Permits *)
  permits             : permits_t;
  permits_counter     : nat;
  default_expiry      : nat;
]

type return_t           is list (operation) * storage_t
type full_return_t      is list (operation) * full_storage_t

type dex_func_t         is (action_t * storage_t) -> return_t
type tkn_func_t         is (token_action_type * full_storage_t) -> full_return_t

type add_liq_prm_t is record [
    referral: option(address);
    pair_id :nat;
    pair    : pair_t;
    inputs  : map(tkn_pool_idx_t, nat);
    min_mint_amount: nat;
  ]
// const fee_rate            : nat = 333n;
// const fee_denom           : nat = 1000n;
// const fee_num             : nat = 997n;
type balancing_acc_t   is record [
  dev_rewards             : big_map(token_t, nat);
  referral_rewards        : big_map((address * token_t), nat);
  staker_accumulator      : stkr_acc_t;
  tokens_info             : map(tkn_pool_idx_t, tkn_inf_t);
  tokens_info_without_lp  : map(tkn_pool_idx_t, tkn_inf_t);
]