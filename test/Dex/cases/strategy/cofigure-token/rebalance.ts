import BigNumber from "bignumber.js";
import { TezosToolkit, Contract } from "@taquito/taquito";
import Dex from "../../../API";
import { PairInfo } from "../../../API/types";

export async function manualRebalanceSuccessCase(
  dex: Dex,
  yupana: Contract,
  strategy: Contract,
  pool_id: BigNumber,
  pool_token_ids: Set<BigNumber>
) {
  await dex.updateStorage({ pools: [pool_id.toString()] });
  let pool: PairInfo = dex.storage.storage.pools[pool_id.toString()];
  expect(pool).toBeDefined();
  const strategyStore = pool.strategy;
  expect(strategyStore.strat_contract).toBeDefined();

  await dex.rebalance(pool_id, pool_token_ids);

  await dex.updateStorage({ pools: [pool_id.toString()] });
  pool = dex.storage.storage.pools[pool_id.toString()];
  pool.strategy.configuration.forEach((value, key) => {
    const on_strat = value.strategy_reserves;
    const full_res = pool.tokens_info.get(key).reserves;
    console.debug(
      `[${key.toString()}] - full: ${full_res}, on strategy: ${on_strat} (${on_strat
        .div(full_res)
        .multipliedBy(100)}%)`
    );
  });
}
