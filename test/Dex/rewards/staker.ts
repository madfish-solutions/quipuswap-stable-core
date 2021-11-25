import { MichelsonMap, TezosToolkit } from "@taquito/taquito";
import BigNumber from "bignumber.js";
import { confirmOperation } from "../../helpers/confirmation";
import { Dex } from "../../helpers/dexFA2";

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
  const init_user_stake = dex.storage.storage.stakers_balance;
  console.log(init_user_stake)
  // init_user_stake.forEach((reward, key) => {
  //   expect(reward.toNumber()).toBeGreaterThanOrEqual(new BigNumber(0).toNumber());
  // });
  const op = await dex.contract.methods.unstake(pool_id, new BigNumber(0)).send();
  await confirmOperation(Tezos, op.hash);
  const upd_user_stake = dex.storage.storage.stakers_balance
  console.log(upd_user_stake);
  // upd_user_stake.forEach((reward, key) => {
  //   expect(reward.toNumber()).toEqual(new BigNumber(0).toNumber());
  // })
}
