import BigNumber from "bignumber.js";
import { TezosToolkit } from "@taquito/taquito";
import { confirmOperation } from "../../helpers/confirmation";
import Dex from "../API";
import { prepareProviderOptions } from "../../helpers/utils";
import { decimals } from "../constants";
import { TokensMap } from "../types";
import { defaultTokenId } from "../../Token";

export async function getDeveloperRewardsSuccessCase(
  dex: Dex,
  tokens: TokensMap,
  pool_id: BigNumber,
  batchTimes: number,
  developer: string,
  lambdaContractAddress: string,
  Tezos: TezosToolkit
) {
  let config = await prepareProviderOptions("eve");
  Tezos.setProvider(config);
  const expectedRewardNormalized = new BigNumber(10)
    .pow(4)
    .multipliedBy(batchTimes)
    .multipliedBy(2) // swap in 2 ways
    .multipliedBy(5)
    .dividedBy(100000); // 0.005% of swap
  await dex.updateStorage({ pools: [pool_id.toString()] });
  const dev_stor = await dex.contract.storage().then((storage: any) => {
    return storage.storage.dev_rewards;
  });
  const initUSDtz = await tokens.USDtz.contract.views
    .getBalance(developer)
    .read(lambdaContractAddress);
  const initkUSD = await tokens.kUSD.contract.views
    .getBalance(developer)
    .read(lambdaContractAddress);
  const inituUSD = await tokens.uUSD.contract.views
    .balance_of([{ owner: developer, token_id: "0" }])
    .read(lambdaContractAddress);

  const USDtzRewards = await dev_stor.get({
    fa12: tokens.USDtz.contract.address,
  });
  console.debug(USDtzRewards.dividedBy(decimals.USDtz).toFormat());
  expect(USDtzRewards.dividedBy(decimals.USDtz).toNumber()).toBeCloseTo(
    expectedRewardNormalized.plus(26.6).toNumber(), // approx. from invests / divests and swaps before
    1
  );
  const kUSDRewards = await dev_stor.get({
    fa12: tokens.kUSD.contract.address,
  });
  console.debug(kUSDRewards.dividedBy(decimals.kUSD).toFormat());
  expect(kUSDRewards.dividedBy(decimals.kUSD).toNumber()).toBeCloseTo(
    expectedRewardNormalized
      .plus(13.35) // approx. from invests / divests and swaps before
      .toNumber(),
    1
  );
  const uUSDRewards = await dev_stor.get({
    fa2: {
      token_address: tokens.uUSD.contract.address,
      token_id: new BigNumber(defaultTokenId),
    },
  });
  console.debug(uUSDRewards.dividedBy(decimals.uUSD).toFormat());
  expect(uUSDRewards.dividedBy(decimals.uUSD).toNumber()).toBeCloseTo(
    expectedRewardNormalized
      .plus(13.35) // approx. from invests / divests and swaps before
      .toNumber(),
    1
  );
  const init_rewards = {
    USDtz: USDtzRewards,
    kUSD: kUSDRewards,
    uUSD: uUSDRewards,
  };
  let op = await dex.contract.methods
    .claim_developer("fa12", tokens.USDtz.contract.address, USDtzRewards)
    .send();
  await confirmOperation(Tezos, op.hash);
  console.debug("[CLAIM:DEVELOPER] USDtz");
  await dex.updateStorage({ pools: [pool_id.toString()] });
  let upd_dev_stor = await dex.contract.storage().then((storage: any) => {
    return storage.storage.dev_rewards;
  });
  const updUSDtzRewards = await upd_dev_stor.get({
    fa12: tokens.USDtz.contract.address,
  });
  expect(updUSDtzRewards.toNumber()).toEqual(0);
  op = await dex.contract.methods
    .claim_developer("fa12", tokens.kUSD.contract.address, kUSDRewards)
    .send();
  await confirmOperation(Tezos, op.hash);
  console.debug("[CLAIM:DEVELOPER] kUSD");
  await dex.updateStorage({ pools: [pool_id.toString()] });
  upd_dev_stor = await dex.contract.storage().then((storage: any) => {
    return storage.storage.dev_rewards;
  });
  const updkUSDRewards = await upd_dev_stor.get({
    fa12: tokens.kUSD.contract.address,
  });
  expect(updkUSDRewards.toNumber()).toEqual(0);
  op = await dex.contract.methods
    .claim_developer(
      "fa2",
      tokens.uUSD.contract.address,
      new BigNumber(defaultTokenId),
      uUSDRewards
    )
    .send();
  await confirmOperation(Tezos, op.hash);
  console.debug("[CLAIM:DEVELOPER] uUSD");
  upd_dev_stor = await dex.contract.storage().then((storage: any) => {
    return storage.storage.dev_rewards;
  });
  const upduUSDRewards = await upd_dev_stor.get({
    fa2: {
      token_address: tokens.uUSD.contract.address,
      token_id: new BigNumber(defaultTokenId),
    },
  });
  expect(upduUSDRewards.toNumber()).toEqual(0);
  const updUSDtz = await tokens.USDtz.contract.views
    .getBalance(developer)
    .read(lambdaContractAddress);
  const updkUSD = await tokens.kUSD.contract.views
    .getBalance(developer)
    .read(lambdaContractAddress);
  const upduUSD = await tokens.uUSD.contract.views
    .balance_of([{ owner: developer, token_id: "0" }])
    .read(lambdaContractAddress);
  expect(updUSDtz.minus(initUSDtz).toNumber()).toEqual(
    init_rewards.USDtz.toNumber()
  );
  expect(updkUSD.minus(initkUSD).toNumber()).toEqual(
    init_rewards.kUSD.toNumber()
  );
  expect(upduUSD[0].balance.minus(inituUSD[0].balance).toNumber()).toEqual(
    init_rewards.uUSD.toNumber()
  );
}
