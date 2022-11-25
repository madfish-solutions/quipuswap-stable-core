import BigNumber from "bignumber.js";
import { TezosToolkit } from "@taquito/taquito";
import Dex from "../../../API";
import { PairInfo } from "../../../API/types";

export async function connectTokenStrategySuccessCase(
  dex: Dex,
  pool_id: BigNumber,
  pool_token_id: BigNumber,
  lending_market_id: BigNumber
) {
  await dex.updateStorage({ pools: [pool_id.toString()] });
  let pool: PairInfo = dex.storage.storage.pools[pool_id.toString()];
  expect(pool).toBeDefined();
  const beforeConfiguration = pool.strategy.configuration.get(
    pool_token_id.toString()
  );
  expect(beforeConfiguration).toBeDefined();
  expect(beforeConfiguration).toMatchObject({
    connected: false,
  });

  await dex.connectTokenStrategy(pool_id, pool_token_id, lending_market_id);

  await dex.updateStorage({ pools: [pool_id.toString()] });
  pool = dex.storage.storage.pools[pool_id.toString()];
  const updatedConfiguration = pool.strategy.configuration.get(
    pool_token_id.toString()
  );
  expect(updatedConfiguration).toMatchObject({
    connected: true,
  });
}

export async function connectTokenStrategyFailCaseAdded(
  dex: Dex,
  pool_id: BigNumber,
  pool_token_id: BigNumber,
  lending_market_id: BigNumber
) {
  await dex.updateStorage({ pools: [pool_id.toString()] });
  let pool: PairInfo = dex.storage.storage.pools[pool_id.toString()];
  expect(pool).toBeDefined();
  const beforeConfiguration = pool.strategy.configuration.get(
    pool_token_id.toString()
  );
  expect(beforeConfiguration).toBeDefined();
  expect(beforeConfiguration).toMatchObject({
    connected: true,
  });

  await expect(
    dex.connectTokenStrategy(pool_id, pool_token_id, lending_market_id)
  ).rejects.toMatchObject({
    message: "token-strategy-connected",
  });
  await dex.updateStorage({ pools: [pool_id.toString()] });
  pool = dex.storage.storage.pools[pool_id.toString()];
  const updatedConfiguration = pool.strategy.configuration.get(
    pool_token_id.toString()
  );
  expect(updatedConfiguration).toMatchObject({
    connected: true,
  });
}

export async function connectTokenStrategyFailCaseNoStrategy(
  dex: Dex,
  pool_id: BigNumber,
  pool_token_id: BigNumber,
  lending_market_id: BigNumber
) {
  await dex.updateStorage({ pools: [pool_id.toString()] });
  let pool: PairInfo = dex.storage.storage.pools[pool_id.toString()];
  expect(pool).toBeDefined();
  expect(pool.strategy.strat_contract).toBeNull();
  const beforeConfiguration = pool.strategy.configuration.get(
    pool_token_id.toString()
  );
  expect(beforeConfiguration).toBeDefined();
  expect(beforeConfiguration).toMatchObject({
    connected: false,
  });

  await expect(
    dex.connectTokenStrategy(pool_id, pool_token_id, lending_market_id)
  ).rejects.toMatchObject({
    message: "no-connected-strategy",
  });
  await dex.updateStorage({ pools: [pool_id.toString()] });
  pool = dex.storage.storage.pools[pool_id.toString()];
  const updatedConfiguration = pool.strategy.configuration.get(
    pool_token_id.toString()
  );
  expect(updatedConfiguration).toMatchObject({
    connected: false,
  });
}