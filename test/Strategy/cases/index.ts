import { TezosAddress } from "../../../utils/helpers";
import { StrategyFactorySetter } from "../API/strategyFactoryMethod";

export async function addStrategyFactorySuccessCase(
  contract: StrategyFactorySetter,
  strategy_factory: TezosAddress
) {
  await contract.updateStorage({});
  const factories: Set<TezosAddress> =
    contract.storage.storage.strategy_factory;
  expect(factories).not.toContain(strategy_factory);
  await contract.addStrategyFactory(strategy_factory);

  await contract.updateStorage({});
  const new_factories: Set<TezosAddress> =
    contract.storage.storage.strategy_factory;
  expect(new_factories).toContain(strategy_factory);
}

export async function removeStrategyFactorySuccessCase(
  contract: StrategyFactorySetter,
  strategy_factory: TezosAddress
) {
  await contract.updateStorage({});
  const factories: Set<TezosAddress> =
    contract.storage.storage.strategy_factory;
  expect(factories).toContain(strategy_factory);
  await contract.removeStrategyFactory(strategy_factory);

  await contract.updateStorage({});
  const new_factories: Set<TezosAddress> =
    contract.storage.storage.strategy_factory;
  expect(new_factories).not.toContain(strategy_factory);
}
