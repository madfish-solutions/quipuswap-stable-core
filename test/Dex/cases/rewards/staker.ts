import { MichelsonMap, TezosToolkit } from "@taquito/taquito";
import BigNumber from "bignumber.js";
import { confirmOperation } from "../../../../utils/confirmation";
import Dex from "../../API";
import { DexStorage } from "../../API/types";

export async function harvestFromPoolSuccessCase(
  dex: Dex,
  staker: string,
  pool_id: BigNumber,
  Tezos: TezosToolkit
) {
  await dex.updateStorage({ pools: [pool_id.toString()] });
  const init_total_stake =
    dex.storage.storage.pools[pool_id.toNumber()].staker_accumulator
      .total_staked;
  const init_user_rew: MichelsonMap<
    string,
    {
      reward_f: BigNumber;
      former_f: BigNumber;
    }
  > = await dex.contract
    .storage()
    .then((storage: DexStorage) => {
      return storage.storage.stakers_balance;
    })
    .then((balance) => balance.get([staker, pool_id.toString()]))
    .then((value) => value?.earnings);
  init_user_rew.forEach((earning) => {
    expect(earning.reward_f.toNumber()).toBeGreaterThanOrEqual(
      new BigNumber(0).toNumber()
    );
  });
  const op = await dex.contract.methods
    .stake("remove", pool_id, new BigNumber(0))
    .send();
  await confirmOperation(Tezos, op.hash);
  await dex.updateStorage({ pools: [pool_id.toString()] });
  const upd_total_stake =
    dex.storage.storage.pools[pool_id.toNumber()].staker_accumulator
      .total_staked;
  const upd_user_rew: MichelsonMap<
    string,
    {
      reward_f: BigNumber;
      former_f: BigNumber;
    }
  > = await dex.contract
    .storage()
    .then((storage: DexStorage) => {
      return storage.storage.stakers_balance;
    })
    .then((balance) => balance.get([staker, pool_id.toString()]))
    .then((value) => value?.earnings);
  upd_user_rew.forEach((earning) => {
    expect(earning.reward_f.toNumber()).toBeLessThanOrEqual(
      new BigNumber("10000000000").toNumber() // denominator of accumulator value less than denominator is amount less than 1 token.
    );
  });
  expect(init_total_stake.toNumber()).toStrictEqual(upd_total_stake.toNumber());
}
