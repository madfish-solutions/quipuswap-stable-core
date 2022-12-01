import BigNumber from "bignumber.js";
import { TezosToolkit, Contract, TransactionOperation } from "@taquito/taquito";
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
  const pool = dex.storage.storage.pools[pool_id.toString()];
  const internals = (
    operation.results[0] as OperationContentsAndResultTransaction
  ).metadata.internal_operation_results;
  expect(
    internals.find(
      (x) =>
        x.parameters.entrypoint === "prepare" &&
        x.destination == strategy.address &&
        x.source === dex.contract.address
    )
  ).toMatchObject({ result: { status: "applied" } });
  expect(
    internals.find(
      (x) =>
        x.parameters.entrypoint === "update_token_state" &&
        x.destination == strategy.address &&
        x.source === dex.contract.address
    )
  ).toMatchObject({ result: { status: "applied" } });
  internals
    .filter(
      (x) =>
        (x.parameters.entrypoint === "redeem" ||
          x.parameters.entrypoint === "mint") &&
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
      `[STRATEGY] Auto Rebalance [${key.toString()}] - full: ${full_res}, on strategy: ${on_strat} (${on_strat
        .div(full_res)
        .multipliedBy(100)}%)`
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
    console.debug(
      `[STRATEGY] Auto Rebalance Swap [${route.i.toNumber()} - ${route.j.toNumber()}] - amt: ${amount_to_swap_to_slash.toNumber()}`
    );
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
  pool_id: BigNumber
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

  let in_amounts = new Map<string, BigNumber>();
  console.debug(`[STRATEGY] Auto Rebalance invest`)

  strategyStore.configuration.forEach((v, k) => {
    const reserves = pool.tokens_info.get(k).reserves;
    const amount_to_slash = reserves
      .multipliedBy(v.des_reserves_rate_f.plus(v.delta_rate_f))
      .idiv("1e18")
      .plus(1_500_000);
    in_amounts = in_amounts.set(k, amount_to_slash);
    console.debug(`[${k.toString()}] ${amount_to_slash.toString()}`)
  });

  const operation = await dex.investLiquidity(
    pool_id,
    in_amounts,
    new BigNumber(1),
    new Date(Date.now() + 1000 * 60 * 60 * 24)
  );
  await autoRebalanceCheck(dex, yupana, strategy, pool_id, operation);
}

export async function divestRebalanceSuccessCase(
  dex: Dex,
  yupana: Contract,
  strategy: Contract,
  pool_id: BigNumber
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

  let min_amounts = new Map<string, BigNumber>();
  console.debug(`[STRATEGY] Auto Rebalance divest`)

  strategyStore.configuration.forEach((v, k) => {
    const reserves = pool.tokens_info.get(k).reserves;
    const amount_to_slash = reserves
      .multipliedBy(v.des_reserves_rate_f.minus(v.delta_rate_f))
      .idiv("1e18")
      .minus(1_500_000);
    min_amounts = min_amounts.set(k, amount_to_slash);
    console.debug(`[${k.toString()}] ${amount_to_slash.toString()}`)

  });

  const operation = await dex.divestLiquidity(
    pool_id,
    min_amounts,
    new BigNumber(1_000_000_000),
    new Date(Date.now() + 1000 * 60 * 60 * 24)
  );
  await autoRebalanceCheck(dex, yupana, strategy, pool_id, operation);
}

export async function divestOneRebalanceSuccessCase(
  dex: Dex,
  yupana: Contract,
  strategy: Contract,
  pool_id: BigNumber,
  i: BigNumber
) {
  await dex.updateStorage({ pools: [pool_id.toString()] });
  const pool: PairInfo = dex.storage.storage.pools[pool_id.toString()];
  expect(pool).toBeDefined();
  const strategyStore = pool.strategy;
  expect(strategyStore.strat_contract).toBeDefined();
  await dex.rebalance(pool_id, new Set([i]));
  console.debug(`[STRATEGY] Auto Rebalance divest one`)
  let min_amounts = new Map<string, BigNumber>();
  strategyStore.configuration.forEach((v, k) => {
    const reserves = pool.tokens_info.get(k).reserves;
    const amount_to_slash = reserves
      .multipliedBy(v.des_reserves_rate_f.minus(v.delta_rate_f))
      .idiv("1e18")
      .minus(1_500_000);
    min_amounts = min_amounts.set(k, amount_to_slash);
    console.debug(`[${k.toString()}] ${amount_to_slash.toString()}`)
  });

  const operation = await dex.divestOneCoin(
    pool_id,
    new BigNumber(100_000_000),
    i,
    new BigNumber(1),
    new Date(Date.now() + 1000 * 60 * 60 * 24)
  );
  await autoRebalanceCheck(dex, yupana, strategy, pool_id, operation);
}

export async function divestImbalanceRebalanceSuccessCase(
  dex: Dex,
  yupana: Contract,
  strategy: Contract,
  pool_id: BigNumber
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
  console.debug(`[STRATEGY] Auto Rebalance divest imb`)
  let min_amounts = new Map<string, BigNumber>();
  strategyStore.configuration.forEach((v, k) => {
    const reserves = pool.tokens_info.get(k).reserves;
    const amount_to_slash = reserves
      .multipliedBy(v.des_reserves_rate_f.minus(v.delta_rate_f))
      .idiv("1e18")
      .minus(1_500_000);
    min_amounts = min_amounts.set(k, amount_to_slash);
    console.debug(`[${k.toString()}] ${amount_to_slash.toString()}`)
  });

  const operation = await dex.divestImbalanced(
    pool_id,
    new Map().set("0", 1_000_000).set("1", 1_000_000).set("2", 1_000_000),
    new BigNumber(100_000_000),
    new Date(Date.now() + 1000 * 60 * 60 * 24)
  );
  await autoRebalanceCheck(dex, yupana, strategy, pool_id, operation);
}
