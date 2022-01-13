import BigNumber from "bignumber.js";
import { TezosToolkit } from "@taquito/taquito";
import {
  AccountsLiteral,
  prepareProviderOptions,
} from "../../../scripts/helpers/utils";
import Dex from "../API";
import { accounts, decimals } from "../constants";
import { DexStorage, TokensMap } from "../types";
import { confirmOperation } from "../../../scripts/helpers/confirmation";
import { defaultTokenId } from "../../Token";

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
    const config = await prepareProviderOptions(referral);
    Tezos.setProvider(config);
    const expectedRewardNormalized = new BigNumber(10)
      .pow(4)
      .multipliedBy(batchSwapTimes)
      .multipliedBy(2) // swap in 2 ways
      .multipliedBy(5)
      .dividedBy(100000) // 0.005% of swap
      .plus(0.01);
    await dex.updateStorage({ pools: [pool_id.toString()] });
    const ref_address = accounts[referral].pkh;
    const ref_stor = await dex.contract
      .storage()
      .then((storage: DexStorage) => {
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
      expectedRewardNormalized.toNumber(),
      1
    );
    console.debug(USDtzRewards.dividedBy(decimals.USDtz).toFormat());
    const kUSDRewards = await ref_stor.get({
      0: ref_address,
      1: { fa12: tokens.kUSD.contract.address },
    });
    console.debug(kUSDRewards.dividedBy(decimals.kUSD).toFormat());
    expect(kUSDRewards.dividedBy(decimals.kUSD).toNumber()).toBeCloseTo(
      expectedRewardNormalized.toNumber(),
      1
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
    console.debug(uUSDRewards.dividedBy(decimals.uUSD).toFormat());
    expect(uUSDRewards.dividedBy(decimals.uUSD).toNumber()).toBeCloseTo(
      expectedRewardNormalized.toNumber(),
      1
    );
    const init_rewards = {
      USDtz: USDtzRewards,
      kUSD: kUSDRewards,
      uUSD: uUSDRewards,
    };
    let op = await dex.contract.methods
      .claim_referral("fa12", tokens.USDtz.contract.address, USDtzRewards)
      .send();
    await confirmOperation(Tezos, op.hash);
    console.debug("[CLAIM:REFERRAL] USDtz");
    await dex.updateStorage({ pools: [pool_id.toString()] });
    let upd_ref_stor = await dex.contract
      .storage()
      .then((storage: DexStorage) => {
        return storage.storage.referral_rewards;
      });
    const updUSDtzRewards = await upd_ref_stor.get({
      0: ref_address,
      1: { fa12: tokens.USDtz.contract.address },
    });
    expect(updUSDtzRewards.toNumber()).toBe(0);
    op = await dex.contract.methods
      .claim_referral("fa12", tokens.kUSD.contract.address, kUSDRewards)
      .send();
    await confirmOperation(Tezos, op.hash);
    console.debug("[CLAIM:REFERRAL] kUSD");
    await dex.updateStorage({ pools: [pool_id.toString()] });
    upd_ref_stor = await dex.contract.storage().then((storage: DexStorage) => {
      return storage.storage.referral_rewards;
    });
    const updkUSDRewards = await upd_ref_stor.get({
      0: ref_address,
      1: { fa12: tokens.kUSD.contract.address },
    });
    expect(updkUSDRewards.toNumber()).toBe(0);
    op = await dex.contract.methods
      .claim_referral(
        "fa2",
        tokens.uUSD.contract.address,
        new BigNumber(defaultTokenId),
        uUSDRewards
      )
      .send();
    await confirmOperation(Tezos, op.hash);
    console.debug("[CLAIM:REFERRAL] uUSD");
    upd_ref_stor = await dex.contract.storage().then((storage: DexStorage) => {
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
    expect(upduUSDRewards.toNumber()).toBe(0);
    const updUSDtz = await tokens.USDtz.contract.views
      .getBalance(ref_address)
      .read(lambdaContractAddress);
    const updkUSD = await tokens.kUSD.contract.views
      .getBalance(ref_address)
      .read(lambdaContractAddress);
    const upduUSD = await tokens.uUSD.contract.views
      .balance_of([{ owner: ref_address, token_id: "0" }])
      .read(lambdaContractAddress);
    expect(updUSDtz.minus(initUSDtz).toNumber()).toStrictEqual(
      init_rewards.USDtz.toNumber()
    );
    expect(updkUSD.minus(initkUSD).toNumber()).toStrictEqual(
      init_rewards.kUSD.toNumber()
    );
    expect(
      upduUSD[0].balance.minus(inituUSD[0].balance).toNumber()
    ).toStrictEqual(init_rewards.uUSD.toNumber());
  }
}
