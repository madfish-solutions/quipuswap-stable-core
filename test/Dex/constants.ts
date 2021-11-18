import BigNumber from "bignumber.js";
import config from "../../config.json";

export const decimals = {
  kUSD: new BigNumber(10).pow(18),
  USDtz: new BigNumber(10).pow(6),
  uUSD: new BigNumber(10).pow(12),
};

export const swap_routes = [
  ["kUSD", "uUSD"],
  ["uUSD", "USDtz"],
  ["USDtz", "kUSD"],

  ["kUSD", "USDtz"],
  ["USDtz", "uUSD"],
  ["uUSD", "kUSD"],
];

export const accounts = config.sandbox.accounts;

export const zero_amount = new BigNumber("0");

export const a_const = new BigNumber("2000");