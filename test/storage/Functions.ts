import { LambdaFunctionType } from "../helpers/types";

export const dexLambdas: LambdaFunctionType[] = [
  {
    index: 0,
    name: "initialize_exchange",
  },
  // {
  //   index: 1,
  //   name: "swap",
  // },
  {
    index: 2,
    name: "invest_liquidity",
  },
  // {
  //   index: 3,
  //   name: "divest_liquidity",
  // },
  // {
  //   index: 4,
  //   name: "invest_liquidity_imbalanced",
  // },
  // {
  //   index: 5,
  //   name: "divest_liquidity_imbalanced",
  // },
  // {
  //   index: 6,
  //   name: "claim_rewards",
  // },
  {
    index: 7,
    name: "ramp_A",
  },
  {
    index: 8,
    name: "stop_ramp_A",
  },
  {
    index: 9,
    name: "set_proxy",
  },
  {
    index: 10,
    name: "update_proxy_limits",
  },
  {
    index: 11,
    name: "get_reserves",
  },
  {
    index: 12,
    name: "get_total_supply",
  },
  // {
  //   index: 13,
  //   name: "get_min_received",
  // },
  // {
  //   index: 14,
  //   name: "token_per_share",
  // },
  // {
  //   index: 15,
  //   name: "calc_withdraw_one_coin",
  // },
  // {
  //   index: 16,
  //   name: "get_dy",
  // },
  {
    index: 17,
    name: "get_A",
  },
];

export const tokenLambdas: LambdaFunctionType[] = [
  {
    index: 0,
    name: "transfer_ep",
  },
  // {
  //   index: 1,
  //   name: "get_balance_of",
  // },
  {
    index: 2,
    name: "update_operators",
  },
  {
    index: 3,
    name: "update_token_metadata",
  },
];
module.exports.tokenFunctions = {
  FA12: tokenLambdas,
  MIXED: tokenLambdas,
  FA2: tokenLambdas,
};
