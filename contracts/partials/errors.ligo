module Dex is {
  const a_limit                   : string = "a-too-high";
  const balance_overflow          : string = "balance-overflow";
  const dust_out                  : string = "dust-output";
  const fee_overflow              : string = "fee-overflow";
  const func_set                  : string = "function-set";
  const high_min_out              : string = "high-min-out";
  const insufficient_lp           : string = "insufficient-shares";
  const low_max_shares_in         : string = "low-max-shares-in";
  const low_reserves              : string = "low-reserves";
  const low_total_supply          : string = "low-total-supply";
  const no_liquidity              : string = "no-liquidity";
  const no_token                  : string = "token-not-found";
  const no_token_info             : string = "no-token-info";
  const not_contract_admin        : string = "not-contract-admin";
  const not_developer             : string = "not-developer";
  const not_manager               : string = "not-manager";
  const not_started               : string = "not-started";
  const pool_listed               : string = "pool-exist";
  const pool_not_listed           : string = "not-launched";
  const reserves_drained            : string = "zero-reserves-when-positive-shares";
  const supply_drained            : string = "positive-reserves-when-zero-shares";
  const time_expired              : string = "time-expired";
  const timestamp_error           : string = "timestamp-error";
  const unknown_func              : string = "function-not-set";
  const unreachable               : string = "unreachable";
  const wrong_index               : string = "wrong-index";
  const wrong_precision           : string = "wrong-precision";
  const wrong_shares_out          : string = "wrong-shares-out";
  const wrong_token_entrypoint    : string = "not-token";
  const wrong_tokens_count        : string = "wrong-tokens-count";
  const wrong_use_function        : string = "cant-unpack-use-lambda";
  const zero_burn_amount          : string = "zero-burn-amount";
  const zero_in                   : string = "zero-amount-in";
  const zero_min_out              : string = "zero-min-out";
}

module FA2 is {
  const not_operator              : string = "FA2_NOT_OPERATOR";
  const not_owner                 : string = "FA2_NOT_OWNER";
  const insufficient_balance      : string = "FA2_INSUFFICIENT_BALANCE";
  const undefined                 : string = "FA2_TOKEN_UNDEFINED";
  const owner_as_operator         : string = "FA2_OPERATOR_CANT_BE_OWNER";
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
  const burn_rate_overflow        : string = "burn-rate-overflow";
}