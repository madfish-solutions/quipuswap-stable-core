import BigNumber from "bignumber.js";
import { TezosToolkit, Contract, OpKind } from "@taquito/taquito";
import {
  OperationContentsAndResultTransaction,
  InternalOperationResult,
} from "@taquito/rpc";
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

  const operation = await dex.rebalance(pool_id, pool_token_ids);
  await dex.updateStorage({ pools: [pool_id.toString()] });
  pool = dex.storage.storage.pools[pool_id.toString()];
  const internals = (
    operation.results[0] as OperationContentsAndResultTransaction
  ).metadata.internal_operation_results;
  expect(
    internals.find(
      (x) =>
        x.kind === OpKind.TRANSACTION &&
        x.parameters?.entrypoint === "prepare" &&
        x.destination == strategy.address &&
        x.source === dex.contract.address
    )
  ).toMatchObject({ result: { status: "applied" } });
  expect(
    internals.find(
      (x) =>
        x.kind === OpKind.TRANSACTION &&
        x.parameters?.entrypoint === "update_token_state" &&
        x.destination == strategy.address &&
        x.source === dex.contract.address
    )
  ).toMatchObject({ result: { status: "applied" } });
  internals
    .filter(
      (x) =>
        x.kind === OpKind.TRANSACTION &&
        (x.parameters?.entrypoint === "redeem" ||
          x.parameters?.entrypoint === "mint") &&
        x.destination === yupana.address &&
        x.source === strategy.address
    )
    .forEach((y) => expect(y).toMatchObject({ result: { status: "applied" } }));
  pool.strategy.configuration.forEach((value, key) => {
    const on_strat = value.strategy_reserves;
    const full_res = pool.tokens_info.get(key).reserves;
    const expected_rate = value.des_reserves_rate_f.div("1e18");
    const real_rate = on_strat.div(full_res);
    expect(real_rate.toNumber()).toBeCloseTo(expected_rate.toNumber(), 9);
    console.debug(
      `[STRATEGY] Rebalance [${key.toString()}] - full: ${full_res}, on strategy: ${on_strat} (${on_strat
        .div(full_res)
        .multipliedBy(100)}%)`
    );
  });
}
