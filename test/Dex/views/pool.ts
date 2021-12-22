import BigNumber from "bignumber.js";
import Dex from "../API";
import { FeeType, IndexMap, TokenInfo } from "../types";

export async function getASuccessCase(
  dex: Dex,
  pool_id: BigNumber,
  lambdaContractAddress: string
) {
  await dex.updateStorage({ pools: [pool_id.toString()] });
  const exp_A = dex.storage.storage.pools[pool_id.toString()].initial_A;
  const a = await dex.contract.views.get_A(pool_id).read(lambdaContractAddress);
  expect(a.toNumber()).toEqual(exp_A.dividedBy(100).toNumber());
}

export async function getFeesSuccessCase(
  dex: Dex,
  pool_id: BigNumber,
  lambdaContractAddress: string
) {
  await dex.updateStorage({ pools: [pool_id.toString()] });
  const exp_fees: FeeType = dex.storage.storage.pools[pool_id.toString()].fee;
  const fees = (await dex.contract.views
    .get_fees(pool_id)
    .read(lambdaContractAddress)) as FeeType;
  expect(fees).toMatchObject(exp_fees);
}

export async function getTokensInfoSuccessCase(
  dex: Dex,
  pool_id: BigNumber,
  lambdaContractAddress: string
) {
  await dex.updateStorage({ pools: [pool_id.toString()] });
  const exp_reserves = dex.storage.storage.pools[pool_id.toString()]
    .tokens_info as any as Map<string, TokenInfo>;
  const reserves = await dex.contract.views
    .get_tokens_info(pool_id)
    .read(lambdaContractAddress);
  reserves.forEach((v: TokenInfo, k: string) => {
    expect(v.reserves.toNumber()).toEqual(
      exp_reserves.get(k).reserves.toNumber()
    );
    expect(v.rate.toNumber()).toEqual(exp_reserves.get(k).rate.toNumber());
    expect(v.precision_multiplier.toNumber()).toEqual(
      exp_reserves.get(k).precision_multiplier.toNumber()
    );
  });
}

export async function getDySuccessCase(
  dex: Dex,
  pool_id: BigNumber,
  token_idxs: IndexMap,
  lambdaContractAddress: string
) {
  await dex.updateStorage({ pools: [pool_id.toString()] });
  const dx = new BigNumber(10).pow(12 + 3);
  const exp_dy = new BigNumber(10).pow(6 + 3);
  const i = token_idxs.uUSD;
  const j = token_idxs.USDtz;
  console.debug(pool_id, new BigNumber(i), new BigNumber(j), dx);
  const params = {
    pool_id: pool_id,
    i: i,
    j: j,
    dx: dx,
  };
  const getdy = dex.contract.views.get_dy(
    pool_id,
    new BigNumber(i),
    new BigNumber(j),
    dx
  );
  console.debug(getdy);
  const dy = await getdy.read();
  console.debug(dy.toString());
  console.debug(exp_dy.toString(), dy.toString());
  // expect(dy.toNumber()).toBeCloseTo(exp_dy.toNumber());
}