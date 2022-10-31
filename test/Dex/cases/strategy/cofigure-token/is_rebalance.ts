import BigNumber from "bignumber.js";
import { TezosToolkit } from "@taquito/taquito";
import Dex from "../../../API";
import { PairInfo } from "../../../API/types";

export async function setIsRebalanceSuccessCase(
  dex: Dex,
  pool_id: BigNumber,
  pool_token_id: BigNumber,
  isRebalance: boolean
) {
  await dex.updateStorage({ pools: [pool_id.toString()] });
  let pool: PairInfo = dex.storage.storage.pools[pool_id.toString()];
  expect(pool).toBeDefined();
  const strategyStore = pool.strategy;
  const initConfiguration = strategyStore.configuration.get(
    pool_token_id.toString()
  );
  expect(initConfiguration).not.toMatchObject({ is_rebalance: isRebalance });

  await dex.setIsRebalanceStrategy(pool_id, pool_token_id, isRebalance);

  await dex.updateStorage({ pools: [pool_id.toString()] });
  pool = dex.storage.storage.pools[pool_id.toString()];
  const updatedConfiguration = pool.strategy.configuration.get(
    pool_token_id.toString()
  );
  expect(updatedConfiguration).toMatchObject({ is_rebalance: isRebalance });
}
