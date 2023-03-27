import { TezosToolkit, Contract, MichelsonMap } from "@taquito/taquito";
import {
  OperationContentsAndResultTransaction,
  OperationResultOrigination,
} from "@taquito/rpc";
import { BigNumber } from "bignumber.js";

import { IndexMap, TokensMap } from "../../../utils/types";
import { getMichelsonCode } from "../../../utils/mocks/getMichelsonCode";
import { Dex } from "../../API/dexAPI";
import { DexStorage } from "../../API/types";
import { StrategyContractType } from "../../../Strategy/API/strategy.types";
import { tas, TokenType } from "../../../Strategy/API/type-aliases";
import { decimals } from "../../../../utils/constants";
import { StrategyFactoryContractType } from "../../../Strategy/API/strategy_factory.types";

export async function setupYupanaMocks(
  tokens: TokensMap,
  Tezos: TezosToolkit
): Promise<{
  yupana: Contract;
  ordering: IndexMap;
  price_feed: Contract;
}> {
  const yupanaStorage = {
    ledger: new MichelsonMap(),
    tokens: MichelsonMap.fromLiteral({
      0: {
        mainToken: { fa12: tokens.USDtz.contract.address },
        interestUpdateTime: "0",
        priceUpdateTime: "0",
        exchangeRateF: new BigNumber("1e18"),
        totalSupplyF: 0,
        totalLiquidityF: 0,
        lastPrice: 0,
      },
      1: {
        mainToken: { fa12: tokens.kUSD.contract.address },
        interestUpdateTime: "0",
        priceUpdateTime: "0",
        exchangeRateF: new BigNumber("1e18"),
        totalSupplyF: 0,
        totalLiquidityF: 0,
        lastPrice: 0,
      },
      2: {
        mainToken: {
          fa2: {
            token_address: tokens.uUSD.contract.address,
            token_id: 0,
          },
        },
        interestUpdateTime: "0",
        priceUpdateTime: "0",
        exchangeRateF: new BigNumber("1e18"),
        totalSupplyF: 0,
        totalLiquidityF: 0,
        lastPrice: 0,
      },
    }),
    priceFeedProxy: "tz1ZZZZZZZZZZZZZZZZZZZZZZZZZZZZNkiRg",
  };
  const ordering = {
    USDtz: "0",
    kUSD: "1",
    uUSD: "2",
  };
  const mockYupanaContractOrigination = await Tezos.contract.originate({
    code: getMichelsonCode("yupana"),
    storage: yupanaStorage,
  });
  await mockYupanaContractOrigination.confirmation(1);
  const yupana = await mockYupanaContractOrigination.contract();
  console.debug("[MOCKS] Yupana: ", yupana.address);
  const priceFeedStorage = {
    yToken: yupana.address,
    prices: MichelsonMap.fromLiteral({
      0: 10_000_000,
      1: 11_000_000,
      2: 12_000_000,
    }),
  };
  const pfContractOrigination = await Tezos.contract.originate({
    code: getMichelsonCode("pf"),
    storage: priceFeedStorage,
  });
  await pfContractOrigination.confirmation(1);
  const price_feed = await pfContractOrigination.contract();
  console.debug("[MOCKS] Price Feed: ", price_feed.address);
  await (
    await yupana.methods.setPriceFeed(price_feed.address).send()
  ).confirmation(1);
  console.debug("[MOCKS] Price Feed Connected");

  const mint = await Tezos.contract
    .batch()
    .withContractCall(
      tokens.kUSD.contract.methods.approve(yupana.address, 1_000_000)
    )
    .withContractCall(
      tokens.uUSD.contract.methodsObject.update_operators([
        {
          add_operator: {
            owner: await Tezos.signer.publicKeyHash(),
            operator: yupana.address,
            token_id: 0,
          },
        },
      ])
    )
    .withContractCall(
      price_feed.methodsObject.getPrice([ordering.kUSD, ordering.uUSD])
    )
    .withContractCall(yupana.methodsObject.updateInterest(ordering.kUSD))
    .withContractCall(yupana.methodsObject.updateInterest(ordering.uUSD))
    .withContractCall(
      yupana.methodsObject.mint({
        tokenId: ordering.kUSD,
        amount: 1_000_000,
        minReceived: 1,
      })
    )
    .withContractCall(
      yupana.methodsObject.mint({
        tokenId: ordering.uUSD,
        amount: 1_000_000,
        minReceived: 1,
      })
    )
    .send();
  await mint.confirmation(1);
  console.debug("[MOCKS] Yupana markets minted");

  return { yupana, ordering, price_feed };
}

export async function originateStrategy(
  dex: Dex,
  pool_id: BigNumber,
  pool_ordering: IndexMap,
  yupana: Contract,
  yupana_ordering: IndexMap,
  Tezos: TezosToolkit
): Promise<{
  strategy_factory: StrategyFactoryContractType;
  strategy: StrategyContractType;
}> {
  const dev_address = await Tezos.signer.publicKeyHash();
  const strategy_factory_origination =
    await Tezos.contract.originate<StrategyFactoryContractType>({
      code: getMichelsonCode("strategy_factory"),
      storage: {
        dev: {
          dev_address: tas.address(dev_address),
          temp_dev_address: null,
        },
        deployed_strategies: tas.bigMap([]),
        connected_pools: tas.bigMap([]),
        lending_contract: tas.address(yupana.address),
      },
    });
  await strategy_factory_origination.confirmation(1);
  const strategy_factory = await strategy_factory_origination.contract();
  const dexStore = (await dex.contract.storage()) as DexStorage;
  const token_map = await dexStore.storage.tokens.get(pool_id.toString());
  console.debug("[STRATEGY] Strategy Factory: ", strategy_factory.address);
  const poolInfo = {
    pool_contract: tas.address(dex.contract.address),
    pool_id: tas.nat(pool_id),
    token_map: tas.map(
      [...token_map.entries()].map(([key, value]) => ({
        key: tas.nat(key),
        value: value as TokenType,
      }))
    ),
  };
  const deploy_strategy_request = await strategy_factory.methodsObject
    .deploy_strategy(poolInfo)
    .send();
  await deploy_strategy_request.confirmation(2);
  const deployed_strategy = (
    (
      deploy_strategy_request
        .results[0] as OperationContentsAndResultTransaction
    ).metadata.internal_operation_results[0]
      .result as OperationResultOrigination
  ).originated_contracts[0];
  const strategy = await Tezos.contract.at<StrategyContractType>(
    deployed_strategy
  );
  console.debug(
    "[STRATEGY] Deployed Strategy for ",
    poolInfo.pool_contract + `[${poolInfo.pool_id.toString()}]`,
    " is ",
    strategy.address
  );
  await (
    await Tezos.contract
      .batch()
      .withContractCall(
        strategy.methodsObject.connect_token_to_lending({
          pool_token_id: tas.nat(pool_ordering.uUSD),
          lending_market_id: tas.nat(yupana_ordering.uUSD),
        })
      )
      .withContractCall(
        strategy.methodsObject.connect_token_to_lending({
          pool_token_id: tas.nat(pool_ordering.kUSD),
          lending_market_id: tas.nat(yupana_ordering.kUSD),
        })
      )
      .withContractCall(
        strategy.methodsObject.update_token_config({
          pool_token_id: tas.nat(pool_ordering.kUSD),
          desired_reserves_rate_f: tas.nat(tas.nat("0.3").multipliedBy("1e18")),
          delta_rate_f: tas.nat(tas.nat("0.005").multipliedBy("1e18")),
          min_invest: tas.nat(tas.nat("300").multipliedBy(decimals.kUSD)),
          enabled: true,
        })
      )
      .withContractCall(
        strategy.methodsObject.update_token_config({
          pool_token_id: tas.nat(pool_ordering.uUSD),
          desired_reserves_rate_f: tas.nat(
            tas.nat("0.15").multipliedBy("1e18")
          ),
          delta_rate_f: tas.nat(tas.nat("0.003").multipliedBy("1e18")),
          min_invest: tas.nat(tas.nat("500").multipliedBy(decimals.uUSD)),
          enabled: true,
        })
      )
      .send()
  ).confirmation();
  console.debug("[STRATEGY] Config set, approved, connected.");
  return { strategy_factory, strategy };
}
