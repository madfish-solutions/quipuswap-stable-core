import fs from "fs";
export * from "./token";
export { TokenFA2 } from "./tokenFA2";
export { TokenFA12 } from "./tokenFA12";

const uUSD_contract = fs
  .readFileSync("./test/Token/contracts/uUSD.tz")
  .toString();
const USDtz_contract = fs
  .readFileSync("./test/Token/contracts/USDtz.tz")
  .toString();

const kUSD_contract = fs
  .readFileSync("./test/Token/contracts/kUSD.tz")
  .toString();

const QUIPU_contract = fs
  .readFileSync("./test/Token/contracts/QUIPU.tz")
  .toString();
export const TokenContracts = {
  kUSD_contract,
  uUSD_contract,
  USDtz_contract,
  QUIPU_contract,
};

import kUSDstorage from "./storage/kUSD_storage";
import uUSDstorage from "./storage/uUSD_storage";
import USDtzstorage from "./storage/USDtz_storage";
import QUIPUstorage from "./storage/QUIPU_storage";

export const TokenStorages = {
  kUSDstorage,
  uUSDstorage,
  USDtzstorage,
  QUIPUstorage,
};

export const TokenInitValues = {
  kUSD: {
    code: kUSD_contract,
    storage: kUSDstorage,
  },
  uUSD: {
    code: uUSD_contract,
    storage: uUSDstorage,
  },
  USDtz: {
    code: USDtz_contract,
    storage: USDtzstorage,
  },
  QUIPU: {
    code: QUIPU_contract,
    storage: QUIPUstorage,
  }
};