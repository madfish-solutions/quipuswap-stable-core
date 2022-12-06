import BigNumber from "bignumber.js";
import { Contract, OpKind, TransactionOperation } from "@taquito/taquito";
import {
  OperationContentsAndResultTransaction,
  InternalOperationResult,
} from "@taquito/rpc";
import Dex from "../../API";
import { PairInfo } from "../../API/types";

async function autoRebalanceCheck(
  dex: Dex,
  yupana: Contract,
  strategy: Contract,
  pool_id: BigNumber,
  operation: TransactionOperation
) {
  await dex.updateStorage({ pools: [pool_id.toString()] });
  const pool: PairInfo = dex.storage.storage.pools[pool_id.toString()];
  const internals = (
    operation.results[0] as OperationContentsAndResultTransaction
  ).metadata.internal_operation_results;
  console.debug(internals);
  expect(
    internals.find(
      (x: InternalOperationResult) =>
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
    const delta = value.delta_rate_f.div("1e18");
    const real_rate = on_strat.div(full_res);
    if (value.is_rebalance) {
      expect(real_rate.toNumber()).toBeLessThanOrEqual(
        expected_rate.plus(delta).toNumber()
      );
      expect(real_rate.toNumber()).toBeGreaterThanOrEqual(
        expected_rate.minus(delta).toNumber()
      );
    }
    console.debug(
      `[STRATEGY] Auto Rebalance [${key.toString()}] - full: ${full_res}, on strategy: ${on_strat} (${on_strat
        .div(full_res)
        .multipliedBy(100)}%). Auto rebalance enabled: ${value.is_rebalance}`
    );
  });
}

export async function swapRebalanceSuccessCase(
  dex: Dex,
  yupana: Contract,
  strategy: Contract,
  pool_id: BigNumber,
  route: {
    i: BigNumber;
    j: BigNumber;
  }
) {
  await dex.updateStorage({ pools: [pool_id.toString()] });
  const pool: PairInfo = dex.storage.storage.pools[pool_id.toString()];
  expect(pool).toBeDefined();
  const strategyStore = pool.strategy;
  expect(strategyStore.strat_contract).toBeDefined();
  await dex.rebalance(pool_id, new Set([route.i, route.j]));

  const reserves_i = pool.tokens_info.get(route.i.toString()).reserves;
  const conf_i = strategyStore.configuration.get(route.i.toString());
  const amount_to_swap_to_slash = reserves_i
    .multipliedBy(conf_i.des_reserves_rate_f.plus(conf_i.delta_rate_f))
    .idiv("1e18")
    .plus(1_500_000);
  console.debug(`[STRATEGY] Auto Rebalance Swap`);
  const operation = await dex.swap(
    pool_id,
    route.i,
    route.j,
    amount_to_swap_to_slash,
    new BigNumber(1),
    new Date(Date.now() + 1000 * 60 * 60 * 24)
  );
  await autoRebalanceCheck(dex, yupana, strategy, pool_id, operation);
}

export async function investRebalanceSuccessCase(
  dex: Dex,
  yupana: Contract,
  strategy: Contract,
  pool_id: BigNumber,
  amounts: Map<string, BigNumber>
) {
  await dex.updateStorage({
    pools: [pool_id.toString()],
    tokens: [pool_id.toString()],
  });
  const pool: PairInfo = dex.storage.storage.pools[pool_id.toString()];
  expect(pool).toBeDefined();
  const strategyStore = pool.strategy;
  expect(strategyStore.strat_contract).toBeDefined();
  await dex.rebalance(
    pool_id,
    new Set(dex.storage.storage.tokens[pool_id.toString()].keys())
  );

  console.debug(`[STRATEGY] Auto Rebalance invest`);

  const operation = await dex.investLiquidity(
    pool_id,
    amounts,
    new BigNumber(1),
    new Date(Date.now() + 1000 * 60 * 60 * 24)
  );
  await autoRebalanceCheck(dex, yupana, strategy, pool_id, operation);
}

export async function divestRebalanceSuccessCase(
  dex: Dex,
  yupana: Contract,
  strategy: Contract,
  pool_id: BigNumber,
  min_amounts: Map<string, BigNumber>,
  shares: BigNumber
) {
  await dex.updateStorage({
    pools: [pool_id.toString()],
    tokens: [pool_id.toString()],
  });
  const pool: PairInfo = dex.storage.storage.pools[pool_id.toString()];
  expect(pool).toBeDefined();
  const strategyStore = pool.strategy;
  expect(strategyStore.strat_contract).toBeDefined();
  await dex.rebalance(
    pool_id,
    new Set(dex.storage.storage.tokens[pool_id.toString()].keys())
  );

  console.debug(`[STRATEGY] Auto Rebalance divest`);

  const operation = await dex.divestLiquidity(
    pool_id,
    min_amounts,
    shares,
    new Date(Date.now() + 1000 * 60 * 60 * 24)
  );
  await autoRebalanceCheck(dex, yupana, strategy, pool_id, operation);
}

export async function divestOneRebalanceSuccessCase(
  dex: Dex,
  yupana: Contract,
  strategy: Contract,
  pool_id: BigNumber,
  i: BigNumber,
  output: BigNumber,
  shares: BigNumber
) {
  await dex.updateStorage({ pools: [pool_id.toString()] });
  const pool: PairInfo = dex.storage.storage.pools[pool_id.toString()];
  expect(pool).toBeDefined();
  const strategyStore = pool.strategy;
  expect(strategyStore.strat_contract).toBeDefined();
  await dex.rebalance(pool_id, new Set([i]));
  console.debug(`[STRATEGY] Auto Rebalance divest one`);
  const operation = await dex.divestOneCoin(
    pool_id,
    shares,
    i,
    output,
    new Date(Date.now() + 1000 * 60 * 60 * 24)
  );
  await autoRebalanceCheck(dex, yupana, strategy, pool_id, operation);
}

export async function divestImbalanceRebalanceSuccessCase(
  dex: Dex,
  yupana: Contract,
  strategy: Contract,
  pool_id: BigNumber,
  outputs: Map<string, BigNumber>,
  shares: BigNumber
) {
  await dex.updateStorage({
    pools: [pool_id.toString()],
    tokens: [pool_id.toString()],
  });
  const pool: PairInfo = dex.storage.storage.pools[pool_id.toString()];
  expect(pool).toBeDefined();
  const strategyStore = pool.strategy;
  expect(strategyStore.strat_contract).toBeDefined();
  await dex.rebalance(
    pool_id,
    new Set(dex.storage.storage.tokens[pool_id.toString()].keys())
  );
  console.debug(`[STRATEGY] Auto Rebalance divest imb`);
  const operation = await dex.divestImbalanced(
    pool_id,
    outputs,
    shares,
    new Date(Date.now() + 1000 * 60 * 60 * 24)
  );
  await autoRebalanceCheck(dex, yupana, strategy, pool_id, operation);
}
