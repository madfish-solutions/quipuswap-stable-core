import { MichelsonMap, TezosToolkit } from "@taquito/taquito";
import BigNumber from "bignumber.js";
import { confirmOperation } from "../../helpers/confirmation";
import { Dex } from "../../helpers/dexFA2";

export async function stakeToPoolSuccessCase(
  dex: Dex,
  staker: string,
  pool_id: BigNumber,
  input: BigNumber,
  Tezos: TezosToolkit
) {
  await dex.updateStorage({ pools: [pool_id.toString()] });
  const init_total_stake =
    dex.storage.storage.pools[pool_id.toNumber()].staker_accumulator
      .total_staked;
  // const init_user_acc = await (
  //   dex.storage.storage.stakers_balance as any as MichelsonMap<
  //     [string, string],
  //     any
  //   >
  // ).get([staker, pool_id.toString()]);
  const init_user_stake = dex.storage.storage.stakers_balance;
  console.log(init_user_stake);
  const op = await dex.contract.methods.stake(pool_id, input).send();
  await confirmOperation(Tezos, op.hash);
  await dex.updateStorage({ pools: [pool_id.toString()] });
  const upd_total_stake =
    dex.storage.storage.pools[pool_id.toNumber()].staker_accumulator
      .total_staked;
  // const upd_user_stake = await (
  //   dex.storage.storage.stakers_balance as any as MichelsonMap<
  //     [string, string],
  //     any
  //   >
  // ).get([staker, pool_id.toString()]).balance;
  // if (init_user_acc)
  //   expect(init_user_acc.balance.plus(input).toNumber()).toEqual(
  //     upd_user_stake.toNumber()
  //   );
  // else expect(input.toNumber()).toEqual(upd_user_stake.toNumber());
  const upd_user_stake = dex.storage.storage.stakers_balance;
  console.log(upd_user_stake);
  expect(init_total_stake.plus(input).toNumber()).toEqual(
    upd_total_stake.toNumber()
  );
}
export async function unstakeFromPoolSuccessCase(
  dex: Dex,
  staker: string,
  pool_id: BigNumber,
  output: BigNumber,
  Tezos: TezosToolkit
) {
  await dex.updateStorage({ pools: [pool_id.toString()] });
  const init_total_stake =
    dex.storage.storage.pools[pool_id.toNumber()].staker_accumulator
      .total_staked;
  const init_user_stake = dex.storage.storage.stakers_balance;
  console.log(init_user_stake);
  // const init_user_acc = await (
  //   dex.storage.storage.stakers_balance as any as MichelsonMap<
  //     [string, string],
  //     any
  //   >
  // ).get([staker, pool_id.toString()]);
  const op = await dex.contract.methods.unstake(pool_id, output).send();
  await confirmOperation(Tezos, op.hash);
  await dex.updateStorage({ pools: [pool_id.toString()] });
  const upd_total_stake =
    dex.storage.storage.pools[pool_id.toNumber()].staker_accumulator
      .total_staked;
  // const upd_user_stake = await (
  //   dex.storage.storage.stakers_balance as any as MichelsonMap<
  //     [string, string],
  //     any
  //   >
  // ).get([staker, pool_id.toString()]).balance;
  const upd_user_stake = dex.storage.storage.stakers_balance;
  console.log(upd_user_stake);
  // expect(init_user_acc.balance.minus(output).toNumber()).toEqual(
  //     upd_user_stake.toNumber()
  //   );
  expect(init_total_stake.minus(output).toNumber()).toEqual(
    upd_total_stake.toNumber()
  );
}