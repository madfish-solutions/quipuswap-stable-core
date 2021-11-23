type pool_id_type       is nat
type token_id_type      is nat
type token_pool_index   is nat

type transfer_fa2_destination is [@layout:comb] record [
    to_       : address;
    token_id  : token_id_type;
    amount    : nat;
  ]
type transfer_fa2_param is [@layout:comb] record [
    from_   : address;
    txs     : list (transfer_fa2_destination);
  ]
type bal_fa12_type      is address * contract(nat)
type balance_of_fa2_request is [@layout:comb] record [
    owner       : address;
    token_id    : token_id_type;
  ]
type balance_of_fa2_response is [@layout:comb] record [
    request     : balance_of_fa2_request;
    balance     : nat;
  ]
type bal_fa2_type       is [@layout:comb] record [
    requests              : list (balance_of_fa2_request);
    callback              : contract (list (balance_of_fa2_response));
]
type operator_fa2_param is [@layout:comb] record [
    owner                 : address;
    operator              : address;
    token_id              : token_id_type;
  ]


type transfer_fa12_type is michelson_pair(address, "from", michelson_pair(address, "to", nat, "value"), "")
type transfer_fa2_type  is list (transfer_fa2_param)
type entry_fa12_type    is TransferTypeFA12 of transfer_fa12_type
type entry_fa2_type     is TransferTypeFA2 of transfer_fa2_type
type balance_fa12_type  is BalanceOfTypeFA12 of bal_fa12_type
type balance_fa2_type   is BalanceOfTypeFA2 of bal_fa2_type
type update_operator_param is
| Add_operator            of operator_fa2_param
| Remove_operator         of operator_fa2_param

type fa2_token_type     is [@layout:comb] record [
  token_address           : address; (* token A address *)
  token_id                : nat; (* token A identifier *)
]

type acc_reward_type    is [@layout:comb] record [
  reward              : nat; (* amount of rewards to be minted for user *)
  former              : nat; (* previous amount of rewards minted for user *)
 ]

type token_metadata_info is [@layout:comb] record [
  token_id      : nat;
  token_info    : map(string, bytes);
]

type token_type         is
| Fa12                    of address
| Fa2                     of fa2_token_type

// type token_pool_data    is [@layout:comb] record [
//   token_id      : nat;
//   token_info    : token_type;
// ]

type tokens_type        is map(nat, token_type); (* NOTE: maximum 4 tokens from 0 to 3 *)

type tmp_tokens_type     is record [
    tokens  : tokens_type;
    index   : nat;
  ];

type fees_storage_type  is [@layout:comb] record [
  lp_fee                  : nat;
  stakers_fee             : nat;
  ref_fee                 : nat;
  dev_fee                 : nat;
]

type staker_info_type   is [@layout:comb] record [
  balance                 : nat;
  earnings                : map(token_pool_index, acc_reward_type);
]

type staker_acc_type    is [@layout:comb] record [
  accumulator             : map(token_pool_index, nat);
  total_staked            : nat;
]

type account_data_type  is [@layout:comb] record [
  allowances              : set(address);
  earned_interest         : map(token_type, acc_reward_type)
]

type withdraw_one_return is [@layout:comb] record [
  dy                      : nat;
  dy_fee                  : nat;
  ts                      : nat;
]

type permit_parameter   is [@layout:comb] record [
  paramHash: bytes;
  signature: signature;
  signerKey: key;
]

type permits_type       is big_map(bytes, permit_parameter)

type token_info_type    is  [@layout:comb] record [
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

type pair_type          is [@layout:comb] record [
  initial_A               : nat; (* Constant that describes A constant *)
  initial_A_time          : timestamp;
  future_A                : nat;
  future_A_time           : timestamp;
  // tokens_count            : nat; (* from 2 to 4 tokens at one exchange pool *)
  // tokens                  : tokens_type; (* list of exchange tokens *)
  // token_rates             : map(token_pool_index, nat);
  tokens_info             : map(token_pool_index, token_info_type);
  // reserves                : map(token_pool_index, nat); (* list of token reserves in the pool *)
  // virtual_reserves        : map(token_pool_index, nat);

  fee                     : fees_storage_type;

  staker_accumulator      : staker_acc_type;

  proxy_contract          : option(address);
  // proxy_limits            : map(token_pool_index, nat);
  proxy_reward_acc        : map(token_type, nat);

  (* LP data *)

  total_supply            : nat; (* total shares count *)
]

type storage_type       is [@layout:comb] record [
  (* Management *)
  admin                   : address;
  default_referral        : address;
  dev_address             : address;
  managers                : set(address);

  reward_rate             : nat; (* DEFI reward rate *)
  // entered                 : bool; (* reentrancy protection *)

  (* Pools data *)
  pools_count             : nat; (* total pools count *)
  tokens                  : big_map(pool_id_type, tokens_type); (* all the tokens list *)
  pool_to_id              : big_map(bytes, nat); (* all the tokens list *)
  pools                   : big_map(pool_id_type, pair_type); (* pair info per token id *)

  (* FA2 data *)
  ledger                  : big_map((address * pool_id_type), nat); (* account info per address *)
  account_data            : big_map((address * pool_id_type), account_data_type); (* account info per each lp provider *)

  (* Rewards and accumulators *)
  dev_rewards             : big_map(token_type, nat);
  referral_rewards        : big_map((address * token_type), nat);
  quipu_token             : fa2_token_type;
  stakers_balance         : big_map((address * pool_id_type), staker_info_type); (**)

  (* Permits *)
  permits                 : permits_type;

]

type swap_type          is [@layout:comb] record [
  pair_id                 : nat; (* pair identifier *)
  idx_from                : token_pool_index;
  idx_to                  : token_pool_index;
  amount                  : nat;
  min_amount_out          : nat;
  receiver                : option(address);
  referral                : option(address);
]

type tmp_get_d_type     is [@layout:comb] record [
  d                       : nat;
  prev_d                  : nat;
]

type tmp_imbalance_type     is record [
  tokens_info             : map(token_pool_index, token_info_type);
  operations              : list(operation);
];

// type swap_slice_type    is record [
//   pair_id                 : nat; (* pair identifier *)
//   operation               : swap_type; (* exchange operation *)
// ]

// type swap_side_type     is record [
//   pool                    : nat; (* pair identifier*)
//   token                   : token_type; (* token standard *)
// ]

// type swap_data_type     is record [
//   to_                     : swap_side_type; (* info about sold asset *)
//   from_                   : swap_side_type; (* info about bought asset *)
// ]

// type tmp_swap_type      is record [
//   s                       : storage_type; (* storage_type state *)
//   amount_in               : nat; (* amount of tokens to be sold *)
//   token_in                : token_type; (* type of sold token *)
//   operation               : option(operation); (* exchange operation type *)
//   receiver                : address; (* address of the receiver *)
// ]

// type input_token        is [@layout:comb] record [
//   asset                   : token_type; (* exchange pair info *)
//   in_amount               : nat; (* amount of tokens, where `index of value` == `index of token` to be invested *)
//   rate                    : nat; (* = 10eN where N is the number of decimal places to normalize to 10e18 *)
//   precision_multiplier    : nat; (* = 10eN where N is the number of decimal places to normalize to 10e18 *)
// ]

type initialize_params  is [@layout:comb] record [
  a_constant              : nat;
  input_tokens            : set(token_type);
  tokens_info             : map(token_pool_index, token_info_type);
]

type add_rem_man_params is [@layout:comb] record [
  add                     : bool;
  candidate               : address;
]

type invest_type        is [@layout:comb] record [
  pair_id                 : nat; (* pair identifier *)
  shares                  : nat; (* the amount of shares to receive *)
  in_amounts              : map(nat, nat); (* amount of tokens, where `index of value` == `index of token` to be invested *)
  referral                : option(address);
]

type divest_type        is [@layout:comb] record [
  pair_id                 : nat; (* pair identifier *)
  min_amounts_out         : map(token_pool_index, nat); (* min amount of tokens, where `index of value` == `index of token` to be received to accept the divestment *)
  shares                  : nat; (* amount of shares to be burnt *)
]

type divest_imbalanced_type is [@layout:comb] record [
  pair_id                 : nat; (* pair identifier *)
  amounts_out             : map(token_pool_index, nat); (* amounts of tokens, where `index of value` == `index of token` to be received to accept the divestment *)
  max_shares              : nat; (* amount of shares to be burnt *)
  referral                : option(address);
]

type divest_one_coin_type is [@layout:comb] record [
  pair_id                 : nat; (* pair identifier *)
  shares                  : nat; (* amount of shares to be burnt *)
  token_index             : token_pool_index;
  min_amount_out          : nat;
  referral                : option(address);
]

type reserves_type      is [@layout:comb] record [
  pair_id                 : nat; (* pair identifier *)
  receiver                : contract(map(nat, token_info_type)); (* response receiver *)
]

type total_supply_type  is [@layout:comb] record [
  pool_id                 : pool_id_type; (* pair identifier *)
  receiver                : contract(nat); (* response receiver *)
]

type min_received_type  is [@layout:comb] record [
  pair_id                 : nat; (* pair identifier *)
  i                       : nat;
  j                       : nat;
  x                       : nat;
  receiver                : contract(nat); (* response receiver *)
]

type max_rate_params    is [@layout:comb] record [
  pair_id                 : nat; (* pair identifier *)
  receiver                : contract(map(nat, nat)); (* response receiver *)
]

type get_A_params       is [@layout:comb] record [
  pair_id                 : nat; (* pair identifier *)
  receiver                : contract(nat); (* response receiver *)
]

type calc_w_one_c_params is [@layout:comb] record [
  pair_id                 : nat; (* pair identifier *)
  token_amount            : nat; (* LP to burn *)
  i                       : nat; (* token index in pair *)
  receiver                : contract(nat); (* response receiver *)
]

type get_dy_params      is [@layout:comb] record [
  pair_id                 : nat; (* pair identifier *)
  i                       : nat; (* token index *)
  j                       : nat;
  dx                      : nat;
  receiver                : contract(nat); (* response receiver *)
]

type ramp_a_params      is [@layout:comb] record [
  pair_id                 : nat; (* pair identifier *)
  future_A                : nat;
  future_time             : timestamp; (* response receiver *)
]

type set_proxy_params   is [@layout:comb] record [
  pair_id                 : nat; (* pair identifier *)
  proxy                   : option(address);
]

type get_a_type         is [@layout:comb] record [
  pair_id                 : nat; (* pair identifier *)
  receiver                : contract(nat);
]

type upd_proxy_lim_params is [@layout:comb] record [
  pair_id                 : nat; (* pair identifier *)
  token_index             : nat; (* pair identifier *)
  limit                   : nat;
]

type set_fee_type       is [@layout:comb] record [
  pool_id                 : pool_id_type;
  fee                     : fees_storage_type;
]

type get_fee_type       is [@layout:comb] record [
  pool_id                 : pool_id_type;
  receiver                : contract(fees_storage_type);
]

type claim_by_token_params is [@layout:comb] record [
  token: token_type;
  amount: nat;
]

type un_stake_params is [@layout:comb] record [
  pool_id: pool_id_type;
  amount: nat;
]

type claim_by_pool_token_params is [@layout:comb] record [
  pool_id: pool_id_type;
  token: token_type;
  amount: nat;
]

type action_type        is
(* Base actions *)
| AddPair                 of initialize_params  (* sets initial liquidity *)
| Swap                    of swap_type          (* exchanges token to another token and sends them to receiver *)
| Invest                  of invest_type        (* mints min shares after investing tokens *)
| Divest                  of divest_type        (* burns shares and sends tokens to the owner *)
(* Custom actions *)
| DivestImbalanced        of divest_imbalanced_type
| DivestOneCoin           of divest_one_coin_type
(* Admin actions *)
| ClaimDeveloper          of claim_by_token_params
| ClaimReferral           of claim_by_token_params
| ClaimLProvider          of claim_by_pool_token_params
| RampA                   of ramp_a_params
| StopRampA               of nat
| SetProxy                of set_proxy_params
| UpdateProxyLimits       of upd_proxy_lim_params
| SetFees                 of set_fee_type
| SetDefaultReferral      of address
| Stake                   of un_stake_params
| Unstake                 of un_stake_params
(* VIEWS *)
| GetTokensInfo           of reserves_type      (* returns the token info *)
| GetFees                 of get_fee_type
// | Min_received            of min_received_type  (* returns minReceived tokens after swapping *)
// | Tokens_per_shares       of tps_type           (* returns map of tokens amounts to recieve 1 LP *)
// | Price_cummulative       of price_cumm_type    (* returns price cumulative and timestamp per block *)
// | Calc_divest_one_coin    of calc_divest_one_coin
| GetDy                  of get_dy_params        (* returns the current output dy given input dx *)
| GetA                   of get_a_type

type transfer_type      is list (transfer_fa2_param)
type operator_type      is list (update_operator_param)
type upd_meta_params    is token_metadata_info

type token_action_type  is
| ITransfer               of transfer_type (* transfer asset from one account to another *)
| IBalanceOf              of bal_fa2_type (* returns the balance of the account *)
| IUpdateOperators        of operator_type (* updates the token operators *)
| IUpdateMetadata         of upd_meta_params
| ITotalSupply            of total_supply_type

type set_token_func_type is [@layout:comb] record [
  func                    : bytes; (* code of the function *)
  index                   : nat; (* the key in functions map *)
]

type set_dex_func_type  is [@layout:comb] record [
  func                    : bytes; (* code of the function *)
  index                   : nat; (* the key in functions map *)
]

type full_action_type   is
| Use_dex                 of action_type
// | Use_token               of token_action_type
| Transfer                of transfer_type (* transfer asset from one account to another *)
| Balance_of              of bal_fa2_type (* returns the balance of the account *)
| Update_operators        of operator_type (* updates the token operators *)
| Update_metadata         of upd_meta_params
| Total_supply            of total_supply_type
| SetDexFunction          of set_dex_func_type (* sets the dex specific function. Is used before the whole system is launched *)
| SetTokenFunction        of set_token_func_type (* sets the FA function, is used before the whole system is launched *)
| AddRemManagers          of add_rem_man_params (* adds a manager to manage LP token metadata *)
| SetDevAddress           of address
| SetRewardRate           of nat
| SetAdmin                of address

type full_storage_type  is [@layout:comb] record [
  storage                 : storage_type; (* real dex storage_type *)
  (* Token Metadata *)
  metadata                : big_map(string, bytes); (* metadata storage_type according to TZIP-016 *)
  token_metadata          : big_map(token_id_type, token_metadata_info);
  (* Contract lambdas storage *)
  dex_lambdas             : big_map(nat, bytes); (* map with exchange-related functions code *)
  token_lambdas           : big_map(nat, bytes); (* map with token-related functions code *)
]

type return_type        is list (operation) * storage_type
type full_return_type   is list (operation) * full_storage_type

type dex_func_type      is (action_type * storage_type) -> return_type
type token_func_type    is (token_action_type * full_storage_type) -> full_return_type

type add_liq_param_type is record [
    referral: option(address);
    pair_id :nat;
    pair    : pair_type;
    inputs  : map(token_pool_index, nat);
    min_mint_amount: nat;
  ]
// const fee_rate            : nat = 333n;
// const fee_denom           : nat = 1000n;
// const fee_num             : nat = 997n;
type bal_inp_acc_type   is record [
  dev_rewards             : big_map(token_type, nat);
  referral_rewards        : big_map((address * token_type), nat);
  staker_accumulator      : staker_acc_type;
  tokens_info             : map(token_pool_index, token_info_type);
  tokens_info_without_lp  : map(token_pool_index, token_info_type);
]

