type swap_event_t       is [@layout:comb] record [
  pool_id                 : pool_id_t;
  i                       : token_pool_idx_t;
  j                       : token_pool_idx_t;
  amount_in               : nat;
  amount_out              : nat;
  receiver                : address;
  referral                : address;
]

type invest_event_t     is [@layout:comb] record [
  pool_id                 : pool_id_t;
  inputs                  : map(token_pool_idx_t, nat);
  shares_minted           : nat;
  receiver                : address;
  referral                : address;
]

type divest_event_t     is [@layout:comb] record [
  pool_id                 : pool_id_t;
  shares_burned           : nat;
  outputs                 : map(token_pool_idx_t, nat);
  receiver                : address;
]

type divest_one_event_t is [@layout:comb] record [
  pool_id                 : pool_id_t;
  i                       : token_pool_idx_t;
  shares_burned           : nat;
  amount_out              : nat;
  receiver                : address;
  referral                : address;
]

type divest_imb_event_t is [@layout:comb] record [
  pool_id                 : pool_id_t;
  shares_burned           : nat;
  outputs                 : map(token_pool_idx_t, nat);
  receiver                : address;
  referral                : address;
]

type txs_event_t is [@layout:comb] record [
  token_id                : pool_id_t;
  amount                  : nat;
  receiver                : address;
]

type transfer_event_t   is [@layout:comb] record [
  owner                   : address;
  caller                  : address;
  txs                     : list(txs_event_t)
]

type rebalance_event_t is [@layout:comb] record [
  pool_id                 : pool_id_t;
  rebalanced_tokens       : list(token_pool_idx_t);
  token_infos             : map(token_pool_idx_t, strategy_storage_t)
]

type event_t            is 
| TransferEvent           of transfer_event_t
| InvestEvent             of invest_event_t
| SwapEvent               of swap_event_t
| DivestEvent             of divest_event_t
| DivestOneEvent          of divest_one_event_t
| DivestImbalanceEvent    of divest_imb_event_t
| RebalanceEvent          of rebalance_event_t

[@inline] function emit_event(
  const p               : event_t)
                        : operation is 
  case p of [
      TransferEvent(params) -> Tezos.emit("%transfer", params)
    | InvestEvent(params) -> Tezos.emit("%invest", params)
    | SwapEvent(params) -> Tezos.emit("%swap", params)
    | DivestEvent(params) -> Tezos.emit("%divest", params)
    | DivestOneEvent(params) -> Tezos.emit("%divest_one", params)
    | DivestImbalanceEvent(params) -> Tezos.emit("%divest_imbalance", params)
    | RebalanceEvent(params) -> Tezos.emit("%rebalance", params)
  ];