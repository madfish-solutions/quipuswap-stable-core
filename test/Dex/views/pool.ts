import BigNumber from "bignumber.js";
import Dex from "../API";
import { accounts } from "../constants";
import {
  FA12TokenType,
  FA12,
  FA2,
  FA2TokenType,
  FeeType,
  IndexMap,
  TokensMap,
} from "../types";
import { MichelsonMap } from "@taquito/taquito";
import { TezosAddress } from "../../helpers/utils";

export async function getReservesSuccessCase(dex: Dex, pool_id: BigNumber) {
  await dex.updateStorage({ pools: [pool_id.toString()] });
  const exp_reserves =
    dex.storage.storage.pools[pool_id.toString()].tokens_info;
  const reserves = await dex.contract.contractViews
    .get_reserves(pool_id)
    .executeView({
      viewCaller: accounts["alice"].pkh,
    });
  reserves.forEach((v: BigNumber, k: string) => {
    expect(v.toNumber()).toStrictEqual(exp_reserves.get(k).reserves.toNumber());
  });
}

export async function getTokenMapSuccessCase(
  dex: Dex,
  pool_id: BigNumber,
  tokens_map: TokensMap,
  idx_map: IndexMap
) {
  const value = (await dex.contract.contractViews
    .get_token_map(pool_id)
    .executeView({ viewCaller: accounts["alice"].pkh })) as MichelsonMap<
    string,
    FA12TokenType | FA2TokenType
  >;
  console.debug(value);
  value.forEach((value, key) => {
    if (key == idx_map.USDtz) {
      expect(tokens_map.USDtz.contract.address).toStrictEqual(
        (value as FA12TokenType).fa12
      );
    } else if (key == idx_map.kUSD) {
      expect(tokens_map.kUSD.contract.address).toStrictEqual(
        (value as FA12TokenType).fa12
      );
    } else {
      expect(tokens_map.uUSD.contract.address).toStrictEqual(
        (value as FA2TokenType).fa2.token_address
      );
    }
  });
}

export async function getLPValueSuccessCase(dex: Dex, pool_id: BigNumber) {
  const value = (await dex.contract.contractViews
    .get_tok_per_share(pool_id)
    .executeView({ viewCaller: accounts["alice"].pkh })) as MichelsonMap<
    string,
    BigNumber
  >;
  const result = {};
  value.forEach((value, key) => (result[key] = value.toNumber()));
  console.debug(result);
}

export async function calcDivestOneSuccessCase(
  dex: Dex,
  params: {
    pair_id: BigNumber;
    token_amount: BigNumber;
    i: BigNumber;
  },
  map_tokens_idx: IndexMap
) {
  const value = await dex.contract.contractViews
    .calc_divest_one_coin(params)
    .executeView({ viewCaller: accounts["alice"].pkh });
  console.debug(value);
}

export async function getDySuccessCase(
  dex: Dex,
  pool_id: BigNumber,
  token_idxs: IndexMap
) {
  await dex.updateStorage({ pools: [pool_id.toString()] });
  const dx = new BigNumber(10).pow(12 + 3);
  const exp_dy = new BigNumber(10).pow(6 + 3);
  const i = token_idxs.uUSD;
  const j = token_idxs.USDtz;
  const params = {
    pair_id: pool_id,
    i: i,
    j: j,
    dx: dx,
  };
  console.debug(dex.contract.contractViews);
  const dy = await dex.contract.contractViews
    .get_dy(params)
    .executeView({ viewCaller: accounts["alice"].pkh });
  console.debug(dy.toString());
  console.debug(exp_dy.toString(), dy.toString());
  // expect(dy.toNumber()).toBeCloseTo(exp_dy.toNumber());
}

export async function getASuccessCase(dex: Dex, pool_id: BigNumber) {
  await dex.updateStorage({ pools: [pool_id.toString()] });
  const exp_A = dex.storage.storage.pools[pool_id.toString()].initial_A;
  console.debug(dex.contract.contractViews);
  const a = await dex.contract.contractViews.view_A(pool_id).executeView({
    viewCaller: accounts["alice"].pkh,
  });
  expect(a.toNumber()).toStrictEqual(exp_A.dividedBy(100).toNumber());
}

export async function getFeesSuccessCase(dex: Dex, pool_id: BigNumber) {
  await dex.updateStorage({ pools: [pool_id.toString()] });
  const exp_fees: FeeType = dex.storage.storage.pools[pool_id.toString()].fee;
  const fees = (await dex.contract.contractViews.get_fees(pool_id).executeView({
    viewCaller: accounts["alice"].pkh,
  })) as FeeType;
  expect(fees).toMatchObject(exp_fees);
}

export declare type StakerInfoRequest = {
  user: TezosAddress;
  pool_id: BigNumber;
};

export declare type StakerInfoResponse = {
  request: StakerInfoRequest;
  info: {
    balance: BigNumber;
    rewards: MichelsonMap<string, BigNumber>;
  };
};

export async function getStkrInfoSuccessCase(
  dex: Dex,
  requests: Array<StakerInfoRequest>
) {
  const value = (await dex.contract.contractViews
    .get_staker_info(requests)
    .executeView({
      viewCaller: accounts["alice"].pkh,
    })) as Array<StakerInfoResponse>;
  value.forEach((value) => {
    const rewards = {};
    value.info.rewards.forEach(
      (value, key) => (rewards[key] = value.toNumber())
    );
    console.debug({
      user: value.request.user,
      pool_id: value.request.pool_id,
      balance: value.info.balance,
      rewards: rewards,
    });
  });
}

export declare type ReferralRewardsRequest = {
  user: TezosAddress;
  token: FA2 | FA12;
};

export declare type ReferralRewardsResponse = {
  request: ReferralRewardsRequest;
  reward: BigNumber;
};

export async function getRefRewardsSuccessCase(
  dex: Dex,
  requests: Array<ReferralRewardsRequest>
) {
  const value = (await dex.contract.contractViews
    .get_referral_rewards(requests)
    .executeView({
      viewCaller: accounts["alice"].pkh,
    })) as Array<ReferralRewardsResponse>;
  console.debug(value.toString());
}
