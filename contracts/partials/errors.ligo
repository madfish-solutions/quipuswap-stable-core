module Dex is {
  const func_set                  : string = "function-set";
  const unknown_func              : string = "function-not-set";
  const wrong_use_function        : string = "cant-unpack-use-lambda";
  const wrong_token_entrypoint    : string = "not-token";
  const pool_listed               : string = "pool-exist";
  const pool_not_listed           : string = "not-launched";
  const no_liquidity              : string = "no-liquidity";
  const zero_in                   : string = "zero-amount-in";
  const zero_burn_amount          : string = "zero-burn-amount";
  const insufficient_lp           : string = "insufficient-shares";
  const dust_out                  : string = "dust-output";
  const high_min_out              : string = "high-min-out";
  const low_max_shares_in         : string = "low-max-shares-in";
  const not_manager               : string = "not-manger";
  const not_contract_admin        : string = "not-contract-admin";
  const wrong_tokens_count        : string = "wrong-tokens-count";
  const wrong_shares_out          : string = "wrong-shares-out";
  const wrong_precision           : string = "wrong-precision";
  const wrong_index               : string = "wrong-index";
  const a_limit                   : string = "a-too-high";
  const no_token_info             : string = "no-token-info";
  const no_token                  : string = "token-not-found";
  const low_reserves              : string = "low-reserves";
  const low_total_supply          : string = "low-total-supply";
  const fee_overflow              : string = "fee-overflow";
  const balance_overflow          : string = "balance-overflow";
  const time_expired              : string = "time-expired";
  const timestamp_error           : string = "timestamp-error";
  const not_developer             : string = "not-developer";
  const not_started               : string = "not-started";
}

module FA2 is {
  const not_operator              : string = "FA2_NOT_OPERATOR";
  const not_owner                 : string = "FA2_NOT_OWNER";
  const insufficient_balance      : string = "FA2_INSUFFICIENT_BALANCE";
  const undefined                : string = "FA2_TOKEN_UNDEFINED";
}

module Math is {
  const nat_error                 : string = "value-not-natural";
  const ediv_error                : string = "ediv-error";
}

module Factory is {
  const no_fee                    : string = "no-fee-view";
  const no_address                : string = "no-address";
  const pool_not_listed           : string = "not-listed-pool";
  const not_deployer              : string = "not-deployer-of-pool";
  const not_dex                   : string = "not-dex";
}