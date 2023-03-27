import BigNumber from "bignumber.js";
import { TezosToolkit } from "@taquito/taquito";
import Dex from "../../API";
import { PairInfo } from "../../API/types";

export async function setStrategyAddrSuccessCase(
  dex: Dex,
  pool_id: BigNumber,
  strategy: string
) {
  await dex.updateStorage({ pools: [pool_id.toString()] });
  let pool: PairInfo = dex.storage.storage.pools[pool_id.toString()];
  expect(pool).toBeDefined();
  const initStrat = pool.strategy;
  expect(strategy).not.toStrictEqual(initStrat);

  await dex.connectStrategy(pool_id, strategy);

  await dex.updateStorage({ pools: [pool_id.toString()] });
  pool = dex.storage.storage.pools[pool_id.toString()];
  const updatedStrat = pool.strategy;
  expect(strategy).toStrictEqual(updatedStrat);
}

export async function removeStrategyAddrSuccessCase(
  dex: Dex,
  pool_id: BigNumber
) {
  await dex.updateStorage({ pools: [pool_id.toString()] });
  let pool: PairInfo = dex.storage.storage.pools[pool_id.toString()];
  expect(pool).toBeDefined();
  const initStrat = pool.strategy;
  expect(initStrat).not.toBeNull();

  await dex.connectStrategy(pool_id, null);

  await dex.updateStorage({ pools: [pool_id.toString()] });
  pool = dex.storage.storage.pools[pool_id.toString()];
  const updatedStrat = pool.strategy;
  expect(updatedStrat).toBeNull();

  // TODO: Remove liquidity from old Strategy checks
}
