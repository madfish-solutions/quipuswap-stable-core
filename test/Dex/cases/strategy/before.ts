import { TezosToolkit, Contract, MichelsonMap } from "@taquito/taquito";
import {
  OperationContentsAndResultTransaction,
  OperationResultOrigination,
} from "@taquito/rpc";
import { BigNumber } from "bignumber.js";

import { IndexMap, TokensMap } from "../../../utils/types";
import { getMichelsonCode } from "../../../utils/mocks/getMichelsonCode";
import { Dex } from "../../API/dexAPI";

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
  yupana: Contract,
  price_feed: Contract,
  Tezos: TezosToolkit
): Promise<{
  strategy_factory: Contract;
  strategy: Contract;
}> {
  const dev_address = await Tezos.signer.publicKeyHash();
  const strategy_factory_origination = await Tezos.contract.originate({
    code: getMichelsonCode("strategy_factory"),
    storage: {
      dev: {
        dev_address: dev_address,
        temp_dev_address: null,
      },
      deployed_strategies: new MichelsonMap(),
      connected_pools: new MichelsonMap(),
    },
  });
  await strategy_factory_origination.confirmation(1);
  const strategy_factory = await strategy_factory_origination.contract();
  console.debug("[STRATEGY] Strategy Factory: ", strategy_factory.address);
  const poolInfo = {
    pool_contract: dex.contract.address,
    pool_id: pool_id,
  };
  const deploy_strategy_request = await strategy_factory.methodsObject
    .deploy_strategy({
      pool_info: poolInfo,
      lending_data: {
        lending_contract: yupana.address,
        price_feed_contract: price_feed.address,
      },
    })
    .send();
  await deploy_strategy_request.confirmation(2);
  const deployed_strategy = (
    (
      deploy_strategy_request
        .results[0] as OperationContentsAndResultTransaction
    ).metadata.internal_operation_results[0]
      .result as OperationResultOrigination
  ).originated_contracts[0];
  const strategy = await Tezos.contract.at(deployed_strategy);
  console.debug(
    "[STRATEGY] Deployed Strategy for ",
    poolInfo.pool_contract + `[${poolInfo.pool_id.toString()}]`,
    " is ",
    strategy.address
  );
  return { strategy_factory, strategy };
}
