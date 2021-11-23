import BigNumber from "bignumber.js";
import { TezosToolkit } from "@taquito/taquito";
import { AccountsLiteral, prepareProviderOptions, printFormattedOutput } from "../../helpers/utils";
import { Dex } from "../../helpers/dexFA2";
import { accounts, decimals } from "../constants";
import { TokensMap } from "../types";
import { defaultTokenId } from "../../helpers/token";
import { confirmOperation } from "../../helpers/confirmation";

export async function getReferralRewardsSuccessCase(
  dex: Dex,
  tokens: TokensMap,
  pool_id: BigNumber,
  batchSwapTimes: number,
  referral: AccountsLiteral,
  lambdaContractAddress: string,
  Tezos: TezosToolkit
) {
  {
    let config = await prepareProviderOptions(referral);
    Tezos.setProvider(config);
    const expectedRewardNormalized = new BigNumber(10)
      .pow(4)
      .multipliedBy(batchSwapTimes)
      .multipliedBy(2) // swap in 2 ways
      .multipliedBy(5).dividedBy(100000); // 0.005% of swap
    await dex.updateStorage({ pools: [pool_id.toString()] });
    const ref_address = accounts[referral].pkh;
    const ref_stor = await dex.contract.storage().then((storage: any) => {
      return storage.storage.referral_rewards;
    });
    const initUSDtz = await tokens.USDtz.contract.views
      .getBalance(ref_address)
      .read(lambdaContractAddress);
    const initkUSD = await tokens.kUSD.contract.views
      .getBalance(ref_address)
      .read(lambdaContractAddress);
    const inituUSD = await tokens.uUSD.contract.views
      .balance_of([{ owner: ref_address, token_id: "0" }])
      .read(lambdaContractAddress);

    const USDtzRewards = await ref_stor.get({
      0: ref_address,
      1: { fa12: tokens.USDtz.contract.address },
    });
    expect(USDtzRewards.dividedBy(decimals.USDtz).toNumber()).toBeCloseTo(
      expectedRewardNormalized.toNumber(),1
    );
    printFormattedOutput(global.startTime, USDtzRewards.toFormat());
    const kUSDRewards = await ref_stor.get({
      0: ref_address,
      1: { fa12: tokens.kUSD.contract.address },
    });
    printFormattedOutput(global.startTime, kUSDRewards.toFormat());
    expect(kUSDRewards.dividedBy(decimals.kUSD).toNumber()).toBeCloseTo(
      expectedRewardNormalized.toNumber(),1
    );
    const uUSDRewards = await ref_stor.get({
      0: ref_address,
      1: {
        fa2: {
          token_address: tokens.uUSD.contract.address,
          token_id: new BigNumber(defaultTokenId),
        },
      },
    });
    printFormattedOutput(global.startTime,uUSDRewards.toFormat());
    expect(uUSDRewards.dividedBy(decimals.uUSD).toNumber()).toBeCloseTo(
      expectedRewardNormalized.toNumber(),1
    );
    const init_rewards = {
      USDtz: USDtzRewards,
      kUSD: kUSDRewards,
      uUSD: uUSDRewards,
    };
    let op = await dex.contract.methods
      .claimReferral("fa12", tokens.USDtz.contract.address, USDtzRewards)
      .send();
    await confirmOperation(Tezos, op.hash);
    printFormattedOutput(global.startTime, "Claimed referral USDtz");
    await dex.updateStorage({ pools: [pool_id.toString()] });
    let upd_ref_stor = await dex.contract.storage().then((storage: any) => {
      return storage.storage.referral_rewards;
    });
    const updUSDtzRewards = await upd_ref_stor.get({
      0: ref_address,
      1: { fa12: tokens.USDtz.contract.address },
    });
    expect(updUSDtzRewards.toNumber()).toEqual(0);
    printFormattedOutput(global.startTime, updUSDtzRewards.toFormat());
    op = await dex.contract.methods
      .claimReferral("fa12", tokens.kUSD.contract.address, kUSDRewards)
      .send();
    await confirmOperation(Tezos, op.hash);
    printFormattedOutput(global.startTime, "Claimed referral kUSD");
    await dex.updateStorage({ pools: [pool_id.toString()] });
    upd_ref_stor = await dex.contract.storage().then((storage: any) => {
      return storage.storage.referral_rewards;
    });
    const updkUSDRewards = await upd_ref_stor.get({
      0: ref_address,
      1: { fa12: tokens.kUSD.contract.address },
    });
    printFormattedOutput(global.startTime, updkUSDRewards.toFormat());
    expect(updkUSDRewards.toNumber()).toEqual(0);
    op = await dex.contract.methods
      .claimReferral(
        "fa2",
        tokens.uUSD.contract.address,
        new BigNumber(defaultTokenId),
        uUSDRewards
      )
      .send();
    await confirmOperation(Tezos, op.hash);
    printFormattedOutput(global.startTime, "Claimed referral uUSD");
    upd_ref_stor = await dex.contract.storage().then((storage: any) => {
      return storage.storage.referral_rewards;
    });
    const upduUSDRewards = await upd_ref_stor.get({
      0: ref_address,
      1: {
        fa2: {
          token_address: tokens.uUSD.contract.address,
          token_id: new BigNumber(defaultTokenId),
        },
      },
    });
    printFormattedOutput(global.startTime, upduUSDRewards.toFormat());
    expect(upduUSDRewards.toNumber()).toEqual(0);
    const updUSDtz = await tokens.USDtz.contract.views
      .getBalance(ref_address)
      .read(lambdaContractAddress);
    const updkUSD = await tokens.kUSD.contract.views
      .getBalance(ref_address)
      .read(lambdaContractAddress);
    const upduUSD = await tokens.uUSD.contract.views
      .balance_of([{ owner: ref_address, token_id: "0" }])
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
}
