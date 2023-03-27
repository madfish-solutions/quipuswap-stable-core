import BigNumber from "bignumber.js";
import {
  BatchOperation,
  Contract,
  OpKind,
  TransactionOperation,
} from "@taquito/taquito";
import {
  OperationContentsAndResultTransaction,
  InternalOperationResult,
} from "@taquito/rpc";
import Dex from "../../API";
import { PairInfo } from "../../API/types";
import {
  Storage as StrategyStorage,
  StrategyContractType,
} from "../../../Strategy/API/strategy.types";
import { tas } from "../../../Strategy/API/type-aliases";
import { MichelsonMap } from '@taquito/taquito';

async function autoRebalanceCheck(
  dex: Dex,
  yupana: Contract,
  strategy: Contract,
  pool_id: BigNumber,
  operation: BatchOperation
) {
  await dex.updateStorage({ pools: [pool_id.toString()] });
  const pool: PairInfo = dex.storage.storage.pools[pool_id.toString()];
  const strategyStorage = (await strategy.storage()) as StrategyStorage;
  const internals = (
    operation.results[operation.results.length -1] as OperationContentsAndResultTransaction
  ).metadata.internal_operation_results;
  // expect(
  //   internals.find(
  //     (x: InternalOperationResult) =>
  //       x.kind === OpKind.TRANSACTION &&
  //       x.parameters?.entrypoint === "prepare" &&
  //       x.destination == strategy.address &&
  //       x.source === dex.contract.address
  //   )
  // ).toMatchObject({ result: { status: "applied" } });
  expect(
    internals.find(
      (x) =>
        x.kind === OpKind.TRANSACTION &&
        x.parameters?.entrypoint === "update_state" &&
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
  strategyStorage.token_map.forEach((value, key) => {
    const on_strat = value.invested_tokens;
    const full_res = pool.tokens_info.get(key.toString()).reserves;
    const expected_rate = value.desired_reserves_rate_f.div("1e18");
    const delta = value.delta_rate_f.div("1e18");
    const real_rate = on_strat.div(full_res);
    if (value.enabled) {
      expect(real_rate.toNumber()).toBeLessThanOrEqual(
        value.min_invest.lte(on_strat) ?expected_rate.plus(delta).toNumber() : 0
      );
      expect(real_rate.toNumber()).toBeGreaterThanOrEqual(
        value.min_invest.lte(on_strat) ?
        expected_rate.minus(delta).toNumber() : 0
      );
    }
    console.debug(
      `[STRATEGY] Auto Rebalance [${key.toString()}] - full: ${full_res}, on strategy: ${on_strat} (${on_strat
        .div(full_res)
        .multipliedBy(100)}%). Auto rebalance enabled: ${value.enabled}`
    );
  });
}

export async function swapRebalanceSuccessCase(
  dex: Dex,
  yupana: Contract,
  strategy: StrategyContractType,
  pool_id: BigNumber,
  route: {
    i: BigNumber;
    j: BigNumber;
  }
) {
  await dex.updateStorage({ pools: [pool_id.toString()] });
  const pool: PairInfo = dex.storage.storage.pools[pool_id.toString()];
  expect(pool).toBeDefined();
  const strategy_addr = pool.strategy;
  expect(strategy_addr).toBeDefined();
  // await dex.rebalance(pool_id, new Set([route.i, route.j]));
  const reserves_i = pool.tokens_info.get(route.i.toString()).reserves;
  const stratStore = (await strategy.storage()) as StrategyStorage;
  const conf_i = stratStore.token_map.get(tas.nat(route.i));
  const amount_to_swap_to_slash = reserves_i
    .multipliedBy(conf_i.desired_reserves_rate_f.plus(conf_i.delta_rate_f))
    .idiv("1e18")
    .plus(1_500_000);
  console.debug(`[STRATEGY] Auto Rebalance Swap`);
  let operation = await dex.Tezos.contract.batch();
  const stratTokenConf = await (await strategy.storage()).token_map;
  for (const id of [route.i, route.j]) {
    const lid = stratTokenConf.get(tas.nat(id))?.lending_market_id;
    if (lid)
      operation = operation.withContractCall(
        yupana.methods.updateInterest(lid)
      );
  }
  operation = operation.withContractCall(
    dex.contract.methodsObject.swap({
      pool_id,
      idx_from: route.i,
      idx_to: route.j,
      amount: amount_to_swap_to_slash,
      min_amount_out: 1,
      deadline: tas.timestamp(new Date(Date.now() + 1000 * 60 * 60 * 24)),
      receiver: null,
      referral: null,
    })
  );
  const sent = await operation.send();
  await sent.confirmation();
  await autoRebalanceCheck(dex, yupana, strategy, pool_id, sent);
}

export async function investRebalanceSuccessCase(
  dex: Dex,
  yupana: Contract,
  strategy: StrategyContractType,
  pool_id: BigNumber,
  amounts: Map<string, BigNumber>
) {
  await dex.updateStorage({
    pools: [pool_id.toString()],
    tokens: [pool_id.toString()],
  });
  const pool: PairInfo = dex.storage.storage.pools[pool_id.toString()];
  expect(pool).toBeDefined();
  const strategy_addr = pool.strategy;
  expect(strategy_addr).toBeDefined();
  // await dex.rebalance(
  //   pool_id,
  //   new Set(dex.storage.storage.tokens[pool_id.toString()].keys())
  // );

  console.debug(`[STRATEGY] Auto Rebalance invest`);
  let operation = await dex.Tezos.contract.batch();
  const stratTokenConf = await (await strategy.storage()).token_map;
  const inp = new MichelsonMap()
  for (const [id, value] of amounts.entries()) {
    const lid = stratTokenConf.get(tas.nat(id))?.lending_market_id;
    inp.set(id, value);
    if (lid)
      operation = operation.withContractCall(
        yupana.methods.updateInterest(lid)
      );
  }
  operation = operation.withContractCall(
    dex.contract.methodsObject.invest({
      pool_id,
      shares: 1,
      in_amounts: inp,
      deadline: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
      receiver: null,
      referral: null,
    })
  );
  const sent = await operation.send();
  await sent.confirmation();
  await autoRebalanceCheck(dex, yupana, strategy, pool_id, sent);
}

export async function divestRebalanceSuccessCase(
  dex: Dex,
  yupana: Contract,
  strategy: StrategyContractType,
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
  const strategy_addr = pool.strategy;
  expect(strategy_addr).toBeDefined();
  // await dex.rebalance(
  //   pool_id,
  //   new Set(dex.storage.storage.tokens[pool_id.toString()].keys())
  // );

  console.debug(`[STRATEGY] Auto Rebalance divest`);
  let operation = await dex.Tezos.contract.batch();
  const stratTokenConf = await (await strategy.storage()).token_map;
  const map = new MichelsonMap();
  for (const [id, value] of min_amounts.entries()) {
    const lid = stratTokenConf.get(tas.nat(id))?.lending_market_id;
    map.set(id, value);
    if (lid)
      operation = operation.withContractCall(
        yupana.methods.updateInterest(lid)
      );
  }
  operation = operation.withContractCall(
    dex.contract.methodsObject.divest({
      pool_id,
      min_amounts_out: map,
      shares,
      deadline: tas.timestamp(new Date(Date.now() + 1000 * 60 * 60 * 24)),
    })
  );
  const sent = await operation.send();
  await sent.confirmation();
  await autoRebalanceCheck(dex, yupana, strategy, pool_id, sent);
}

export async function divestOneRebalanceSuccessCase(
  dex: Dex,
  yupana: Contract,
  strategy: StrategyContractType,
  pool_id: BigNumber,
  i: BigNumber,
  output: BigNumber,
  shares: BigNumber
) {
  await dex.updateStorage({ pools: [pool_id.toString()] });
  const pool: PairInfo = dex.storage.storage.pools[pool_id.toString()];
  expect(pool).toBeDefined();
  const strategy_addr = pool.strategy;
  expect(strategy_addr).toBeDefined();
  // await dex.rebalance(pool_id, new Set([i]));
  console.debug(`[STRATEGY] Auto Rebalance divest one`);
  let operation = await dex.Tezos.contract.batch();
  const stratTokenConf = await (await strategy.storage()).token_map;
  for (const id of [i]) {
    const lid = stratTokenConf.get(tas.nat(id))?.lending_market_id;
    if (lid)
      operation = operation.withContractCall(
        yupana.methods.updateInterest(lid)
      );
  }
  operation = operation.withContractCall(
    dex.contract.methodsObject.divest_one_coin({
      pool_id,
      shares,
      token_index: i,
      deadline: tas.timestamp(new Date(Date.now() + 1000 * 60 * 60 * 24)),
      min_amount_out: output,
      receiver: null,
      referral: null,
    })
  );
  const sent = await operation.send();
  await sent.confirmation();
  await autoRebalanceCheck(dex, yupana, strategy, pool_id, sent);
}

export async function divestImbalanceRebalanceSuccessCase(
  dex: Dex,
  yupana: Contract,
  strategy: StrategyContractType,
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
  const strategy_addr = pool.strategy;
  expect(strategy_addr).toBeDefined();
  // await dex.rebalance(
  //   pool_id,
  //   new Set(dex.storage.storage.tokens[pool_id.toString()].keys())
  // );
  console.debug(`[STRATEGY] Auto Rebalance divest imb`);
  let operation = await dex.Tezos.contract.batch();
  const stratTokenConf = await (await strategy.storage()).token_map;
  const map = new MichelsonMap();
  for (const [id, value] of outputs.entries()) {
    const lid = stratTokenConf.get(tas.nat(id))?.lending_market_id;
    map.set(id, value)
    if (lid)
      operation = operation.withContractCall(
        yupana.methods.updateInterest(lid)
      );
  }
  operation = operation.withContractCall(
    dex.contract.methodsObject.divest_imbalanced({
      pool_id,
      amounts_out: map,
      max_shares: shares,
      deadline: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
    })
  );
  const sent = await operation.send();
  await sent.confirmation();
  await autoRebalanceCheck(dex, yupana, strategy, pool_id, sent);
}
