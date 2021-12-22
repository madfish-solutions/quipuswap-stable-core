import { MichelsonMap, TezosToolkit } from "@taquito/taquito";
import BigNumber from "bignumber.js";
import { confirmOperation } from "../../helpers/confirmation";
import Dex from "../API";
import { DexStorage } from "../types";

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
  const init_user_rew: MichelsonMap<string, {
    reward: BigNumber;
    former: BigNumber;
  }> = await dex.contract
    .storage()
    .then((storage: DexStorage) => {
      return storage.storage.stakers_balance;
    })
    .then((balance: any) => balance.get([staker, pool_id.toString()]))
    .then((value) => value?.earnings);
  init_user_rew.forEach((earning, key) => {
    expect(earning.reward.toNumber()).toBeGreaterThanOrEqual(
      new BigNumber(0).toNumber()
    );
  });
  const op = await dex.contract.methods
    .unstake(pool_id, new BigNumber(0))
    .send();
  await confirmOperation(Tezos, op.hash);
  const upd_user_rew: MichelsonMap<
    string,
    {
      reward: BigNumber;
      former: BigNumber;
    }
  > = await dex.contract
    .storage()
    .then((storage: DexStorage) => {
      return storage.storage.stakers_balance;
    })
    .then((balance: any) => balance.get([staker, pool_id.toString()]))
    .then((value) => value?.earnings);
  upd_user_rew.forEach((earning, key) => {
    expect(earning.reward.toNumber()).toEqual(new BigNumber(0).toNumber());
  });
}
