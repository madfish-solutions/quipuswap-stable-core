import BigNumber from "bignumber.js";
import { TezosToolkit } from "@taquito/taquito";
import {
  AccountsLiteral,
  mapTokensToIdx,
  prepareProviderOptions,
} from "../../../scripts/helpers/utils";
import Dex from "../API";
import { accounts } from "../constants";
import { AmountsMap, IndexMap, TokensMap } from "../types";
import { setupTokenAmounts } from "../tokensSetups";

export async function setupMinTokenMapping(
  dex: Dex,
  tokens: TokensMap,
  inputs: AmountsMap
): Promise<{
  pool_id: BigNumber;
  min_amounts: Map<string, BigNumber>;
  idx_map: IndexMap;
}> {
  const stp = await setupTokenAmounts(dex, tokens, {
    kUSD: inputs.kUSD.minus(inputs.kUSD.multipliedBy(3).dividedBy(100)),
    uUSD: inputs.uUSD.minus(inputs.uUSD.multipliedBy(3).dividedBy(100)),
    USDtz: inputs.USDtz.minus(inputs.USDtz.multipliedBy(3).dividedBy(100)),
  });
  const min_amounts = stp.amounts;
  const pool_id = stp.pool_id;
  const tokens_map = dex.storage.storage.tokens[pool_id.toNumber()];
  return { pool_id, min_amounts, idx_map: mapTokensToIdx(tokens_map, tokens) };
}

export async function divestLiquiditySuccessCase(
  dex: Dex,
  sender: AccountsLiteral,
  pool_id: BigNumber,
  shares: BigNumber,
  min_amounts: Map<string, BigNumber>,
  expiration: Date,
  Tezos: TezosToolkit
) {
  const config = await prepareProviderOptions(sender);
  Tezos.setProvider(config);
  await dex.updateStorage({
    pools: [pool_id.toString()],
    ledger: [[accounts[sender].pkh, pool_id.toNumber()]],
  });
  const initLPBalance = new BigNumber(
    dex.storage.storage.pools[pool_id.toNumber()].total_supply
  );
  const res = dex.storage.storage.pools[pool_id.toNumber()].tokens_info;
  const raw_res = {};
  res.forEach(
    (value, key) => (raw_res[key] = value.reserves.toFormat(0).toString())
  );
  const init_ledger = dex.storage.storage.ledger[accounts[sender].pkh];
  await dex.divestLiquidity(pool_id, min_amounts, shares, expiration);
  await dex.updateStorage({
    pools: [pool_id.toString()],
    ledger: [[accounts[sender].pkh, pool_id.toNumber()]],
  });
  const updatedLPBalance = new BigNumber(
    dex.storage.storage.pools[pool_id.toNumber()].total_supply
  );
  const upd_ledger = dex.storage.storage.ledger[accounts[sender].pkh];
  expect(updatedLPBalance.toNumber()).toBeLessThan(initLPBalance.toNumber());
  expect(upd_ledger.plus(shares).toNumber()).toBe(init_ledger.toNumber()); //TODO: change to be calculated from inputs
  expect(updatedLPBalance.toNumber()).toBe(
    initLPBalance.minus(shares).toNumber()
  );
}

export async function divestLiquidityImbalanceSuccessCase(
  dex: Dex,
  sender: AccountsLiteral,
  pool_id: BigNumber,
  amounts: Map<string, BigNumber>,
  max_shares: BigNumber,
  expiration: Date,
  Tezos: TezosToolkit
) {
  const config = await prepareProviderOptions(sender);
  Tezos.setProvider(config);
  await dex.updateStorage({
    pools: [pool_id.toString()],
    ledger: [[accounts[sender].pkh, pool_id.toNumber()]],
  });
  const initLPBalance = new BigNumber(
    dex.storage.storage.pools[pool_id.toNumber()].total_supply
  );
  const res = dex.storage.storage.pools[pool_id.toNumber()].tokens_info;
  const raw_res = {};
  res.forEach(
    (value, key) => (raw_res[key] = value.reserves.toFormat(0).toString())
  );
  const init_ledger = dex.storage.storage.ledger[accounts[sender].pkh];
  await dex.divestImbalanced(pool_id, amounts, max_shares, expiration);
  await dex.updateStorage({
    pools: [pool_id.toString()],
    ledger: [[accounts[sender].pkh, pool_id.toNumber()]],
  });
  const updatedLPBalance = new BigNumber(
    dex.storage.storage.pools[pool_id.toNumber()].total_supply
  );
  const upd_ledger = dex.storage.storage.ledger[accounts[sender].pkh];
  expect(updatedLPBalance.toNumber()).toBeLessThan(initLPBalance.toNumber());
  expect(upd_ledger.toNumber()).toBeGreaterThanOrEqual(
    init_ledger.minus(max_shares).toNumber()
  ); //TODO: change to be calculated from inputs
  expect(updatedLPBalance.toNumber()).toBeGreaterThanOrEqual(
    initLPBalance.minus(max_shares).toNumber()
  );
}

export async function divestLiquidityOneSuccessCase(
  dex: Dex,
  sender: AccountsLiteral,
  pool_id: BigNumber,
  shares: BigNumber,
  token_idx: BigNumber,
  min_amount: BigNumber,
  expiration: Date,
  Tezos: TezosToolkit
) {
  const config = await prepareProviderOptions(sender);
  Tezos.setProvider(config);
  await dex.updateStorage({
    pools: [pool_id.toString()],
    ledger: [[accounts[sender].pkh, pool_id.toNumber()]],
  });
  const initLPBalance = new BigNumber(
    dex.storage.storage.pools[pool_id.toNumber()].total_supply
  );
  const res = dex.storage.storage.pools[pool_id.toNumber()].tokens_info;
  const raw_res = {};
  res.forEach(
    (value, key) => (raw_res[key] = value.reserves.toFormat(0).toString())
  );
  const init_ledger = dex.storage.storage.ledger[accounts[sender].pkh];
  await dex.divestOneCoin(pool_id, shares, token_idx, min_amount, expiration);
  await dex.updateStorage({
    pools: [pool_id.toString()],
    ledger: [[accounts[sender].pkh, pool_id.toNumber()]],
  });
  const updatedLPBalance = new BigNumber(
    dex.storage.storage.pools[pool_id.toNumber()].total_supply
  );
  const upd_ledger = dex.storage.storage.ledger[accounts[sender].pkh];
  expect(updatedLPBalance.toNumber()).toBeLessThan(initLPBalance.toNumber());
  expect(upd_ledger.plus(shares).toNumber()).toBe(init_ledger.toNumber()); //TODO: change to be calculated from inputs
  expect(updatedLPBalance.toNumber()).toBe(
    initLPBalance.minus(shares).toNumber()
  );
}
