import BigNumber from "bignumber.js";
import Dex from "../API";
import { accounts, decimals } from "../constants";
import {
  FA12TokenType,
  FA2TokenType,
  FeeType,
  IndexMap,
  TokensMap,
  PairInfo,
  DexStorage,
  RewardsType,
} from "../types";
import { MichelsonMap } from "@taquito/taquito";
import { TezosAddress } from "../../../scripts/helpers/utils";

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

export async function getLPValueSuccessCase(
  dex: Dex,
  pool_id: BigNumber,
  map_tokens_idx: IndexMap
) {
  const one_LP = new BigNumber(10).pow(18);
  dex.updateStorage({ pools: [pool_id.toString()] });
  const pool_info: PairInfo = dex.storage.storage.pools[pool_id.toString()];
  const tkns_info = pool_info.tokens_info;
  const view_result = (await dex.contract.contractViews
    .get_tok_per_share(pool_id)
    .executeView({ viewCaller: accounts["alice"].pkh })) as MichelsonMap<
    string,
    BigNumber
  >;
  const pp_tks = {
    USDtz: null,
    kUSD: null,
    uUSD: null,
  };
  view_result.forEach((value, key) => {
    const tkn_info = tkns_info.get(key);
    const expected = tkn_info.reserves
      .multipliedBy(one_LP)
      .dividedToIntegerBy(pool_info.total_supply);
    expect(value.toNumber()).toStrictEqual(expected.toNumber());
    if (key == map_tokens_idx.USDtz)
      pp_tks.USDtz = value.dividedBy(decimals.USDtz);
    else if (key == map_tokens_idx.kUSD)
      pp_tks.kUSD = value.dividedBy(decimals.kUSD);
    else if (key == map_tokens_idx.uUSD)
      pp_tks.uUSD = value.dividedBy(decimals.uUSD);
  });
  console.debug(
    `1.000000000000000000 of LP costs ${pp_tks.USDtz.toNumber()} USDtz + ${pp_tks.kUSD.toNumber()} kUSD + ${pp_tks.uUSD.toNumber()} uUSD`
  );
}

export async function calcDivestOneSuccessCase(
  dex: Dex,
  params: {
    pool_id: BigNumber;
    token_amount: BigNumber;
    i: BigNumber;
  },
  map_tokens_idx: IndexMap
) {
  const base = params.token_amount.dividedBy(new BigNumber(10).pow(18));
  const expected = base.minus(base.multipliedBy(5).dividedBy(10000)).toNumber(); // in case of unbalanced pool shoul be calculated based on reserves proportion.
  const value = (await dex.contract.contractViews
    .calc_divest_one_coin(params)
    .executeView({ viewCaller: accounts["alice"].pkh })) as BigNumber;
  let to_dec: BigNumber;
  if (map_tokens_idx.USDtz == params.i.toString()) {
    to_dec = decimals.USDtz;
  } else if (map_tokens_idx.kUSD == params.i.toString()) {
    to_dec = decimals.kUSD;
  } else if (map_tokens_idx.uUSD == params.i.toString()) {
    to_dec = decimals.uUSD;
  } else to_dec = new BigNumber(0);
  expect(value.dividedBy(to_dec).toNumber()).toBeCloseTo(expected, 1);
}

export async function getDySuccessCase(
  dex: Dex,
  pool_id: BigNumber,
  token_idxs: IndexMap
) {
  await dex.updateStorage({ pools: [pool_id.toString()] });
  const base = new BigNumber(10).pow(3);
  const dx = decimals.uUSD.multipliedBy(base);
  const exp_dy = base.minus(base.multipliedBy(5).dividedBy(10000));
  const i = token_idxs.uUSD;
  const j = token_idxs.USDtz;
  const params = {
    pool_id: pool_id,
    i: i,
    j: j,
    dx: dx,
  };
  const dy = await dex.contract.contractViews
    .get_dy(params)
    .executeView({ viewCaller: accounts["alice"].pkh });
  expect(dy.dividedBy(decimals.USDtz).toNumber()).toBeCloseTo(
    exp_dy.toNumber()
  );
}

export async function getASuccessCase(dex: Dex, pool_id: BigNumber) {
  await dex.updateStorage({ pools: [pool_id.toString()] });
  const exp_A = dex.storage.storage.pools[pool_id.toString()].initial_A;
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
  const responses = (await dex.contract.contractViews
    .get_staker_info(requests)
    .executeView({
      viewCaller: accounts["alice"].pkh,
    })) as Array<StakerInfoResponse>;
  for (const response of responses) {
    expect(requests).toContainEqual(response.request);
    const { user_stake, rewards } = await dex.contract
      .storage()
      .then((storage: DexStorage) => {
        return storage.storage.stakers_balance;
      })
      .then((balance) =>
        balance.get([
          response.request.user,
          response.request.pool_id.toString(),
        ])
      )
      .then((value) =>
        value
          ? { user_stake: value.balance, rewards: value.earnings }
          : {
              user_stake: new BigNumber(0),
              rewards: new MichelsonMap<string, RewardsType>(),
            }
      );
    expect(response.info.balance.toNumber()).toStrictEqual(
      user_stake.toNumber()
    );
    response.info.rewards.forEach((value, key) => {
      const rew_info = rewards.get(key);
      const expected = rew_info ? rew_info.reward : new BigNumber(0);
      expect(value.toNumber()).toBeGreaterThanOrEqual(expected.toNumber());
    });
  }
}

export declare type ReferralRewardsRequest = {
  user: TezosAddress;
  token: FA12TokenType | FA2TokenType;
};

export declare type ReferralRewardsResponse = {
  request: ReferralRewardsRequest;
  reward: BigNumber;
};

export async function getRefRewardsSuccessCase(
  dex: Dex,
  requests: Array<ReferralRewardsRequest>
) {
  const responses: Array<ReferralRewardsResponse> =
    await dex.contract.contractViews
      .get_referral_rewards(requests)
      .executeView({
        viewCaller: accounts["alice"].pkh,
      });
  for (const response of responses) {
    expect(requests).toContainEqual(response.request);
    const expected_reward = await dex.contract
      .storage()
      .then((storage: DexStorage) =>
        storage.storage.referral_rewards.get({
          0: response.request.user,
          1: response.request.token,
        })
      );
    expect(response.reward.toNumber()).toStrictEqual(
      expected_reward.toNumber()
    );
  }
}
