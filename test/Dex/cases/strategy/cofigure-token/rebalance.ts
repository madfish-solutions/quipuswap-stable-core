import BigNumber from "bignumber.js";
import { TezosToolkit, Contract, OpKind } from "@taquito/taquito";
import {
  OperationContentsAndResultTransaction,
  InternalOperationResult,
} from "@taquito/rpc";
import Dex from "../../../API";
import { PairInfo } from "../../../API/types";
import {
  Storage as StrategyStorage,
  StrategyContractType,
} from "../../../../Strategy/API/strategy.types";
import { tas } from "../../../../Strategy/API/type-aliases";

export async function manualRebalanceSuccessCase(
  dex: Dex,
  yupana: Contract,
  strategy: StrategyContractType,
  pool_id: BigNumber,
  pool_token_ids: Set<BigNumber>
) {
  await dex.updateStorage({ pools: [pool_id.toString()] });
  let pool: PairInfo = dex.storage.storage.pools[pool_id.toString()];
  expect(pool).toBeDefined();
  const strategy_addr = pool.strategy;
  expect(strategy_addr).toBeDefined();
  let operation = await dex.Tezos.contract.batch();
  const stratTokenConf = await (await strategy.storage()).token_map;
  for (const id of pool_token_ids) {
    const lid = stratTokenConf.get(tas.nat(id))?.lending_market_id;
    if (lid)
      operation = operation.withContractCall(
        yupana.methods.updateInterest(lid)
      );
  }
  operation = operation.withContractCall(
    dex.contract.methods.rebalance(
      pool_id.toString(),
      Array.from(pool_token_ids).map((x) => x.toNumber())
    )
  );
  const sent = await operation.send();
  await sent.confirmation();
  await dex.updateStorage({ pools: [pool_id.toString()] });
  const strategyStorage = (await strategy.storage()) as StrategyStorage;

  pool = dex.storage.storage.pools[pool_id.toString()];
  const internals = (sent.results[2] as OperationContentsAndResultTransaction)
    .metadata.internal_operation_results;
  // expect(
  //   internals.find(
  //     (x) =>
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
    expect(real_rate.toNumber()).toBeLessThanOrEqual(
      value.min_invest.lte(on_strat) ?
      expected_rate.plus(delta).toNumber() : 0
    );
    expect(real_rate.toNumber()).toBeGreaterThanOrEqual(
      value.min_invest.lte(on_strat) ?
      expected_rate.minus(delta).toNumber() : 0
    );
    console.debug(
      `[STRATEGY] Rebalance [${key.toString()}] - full: ${full_res}, on strategy: ${on_strat} (${on_strat
        .div(full_res)
        .multipliedBy(100)}%)`
    );
  });
}
