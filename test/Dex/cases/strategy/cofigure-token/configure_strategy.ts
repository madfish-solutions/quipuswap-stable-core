import BigNumber from "bignumber.js";
import { TezosToolkit } from "@taquito/taquito";
import Dex from "../../../API";
import { PairInfo } from "../../../API/types";

export async function setStrategyParamsSuccessCase(
  dex: Dex,
  pool_id: BigNumber,
  pool_token_id: BigNumber,
  des_reserves_rate_f: BigNumber,
  delta_rate_f: BigNumber,
  min_invest: BigNumber
) {
  await dex.updateStorage({ pools: [pool_id.toString()] });
  let pool: PairInfo = dex.storage.storage.pools[pool_id.toString()];
  expect(pool).toBeDefined();

  await dex.setTokenStrategy(
    pool_id,
    pool_token_id,
    des_reserves_rate_f,
    delta_rate_f,
    min_invest
  );

  await dex.updateStorage({ pools: [pool_id.toString()] });
  pool = dex.storage.storage.pools[pool_id.toString()];
  const updatedConfiguration = pool.strategy.configuration.get(
    pool_token_id.toString()
  );
  expect(updatedConfiguration).toMatchObject({
    des_reserves_rate_f: des_reserves_rate_f,
    delta_rate_f: delta_rate_f,
    min_invest: min_invest,
  });
}

export async function setStrategyParamsToZeroSuccessCase(
  dex: Dex,
  pool_id: BigNumber,
  pool_token_id: BigNumber
) {
  await dex.updateStorage({ pools: [pool_id.toString()] });
  let pool: PairInfo = dex.storage.storage.pools[pool_id.toString()];
  expect(pool).toBeDefined();

  await dex.setTokenStrategy(
    pool_id,
    pool_token_id,
    new BigNumber(0),
    new BigNumber(0),
    new BigNumber(0)
  );

  await dex.updateStorage({ pools: [pool_id.toString()] });
  pool = dex.storage.storage.pools[pool_id.toString()];
  const updatedConfiguration = pool.strategy.configuration.get(
    pool_token_id.toString()
  );
  expect(updatedConfiguration).toMatchObject({
    des_reserves_rate_f: new BigNumber(0),
    delta_rate_f: new BigNumber(0),
    min_invest: new BigNumber(0),
  });

  // TODO: Remove liquidity from old Strategy checks
}
