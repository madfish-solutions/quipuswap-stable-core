import { TezosToolkit } from "@taquito/taquito";
import BigNumber from "bignumber.js";
import { confirmOperation } from "../../helpers/confirmation";
import Dex from "../API";
import { DexStorage } from "../types";

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
  const init_user_stake: BigNumber = await dex.contract
    .storage()
    .then((storage: DexStorage) => {
      return storage.storage.stakers_balance;
    })
    .then((balance) => balance.get([staker, pool_id.toString()]))
    .then((value) => (value ? value.balance : new BigNumber(0)));
  const op = await dex.contract.methods.stake(pool_id, input).send();
  await confirmOperation(Tezos, op.hash);
  await dex.updateStorage({ pools: [pool_id.toString()] });
  const upd_total_stake =
    dex.storage.storage.pools[pool_id.toNumber()].staker_accumulator
      .total_staked;
  const upd_user_stake: BigNumber = await dex.contract
    .storage()
    .then((storage: DexStorage) => {
      return storage.storage.stakers_balance;
    })
    .then((balance) => balance.get([staker, pool_id.toString()]))
    .then((value) => value.balance);
  expect(init_user_stake.plus(input).toNumber()).toStrictEqual(
    upd_user_stake.toNumber()
  );
  expect(init_total_stake.plus(input).toNumber()).toStrictEqual(
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
  const init_user_stake: BigNumber = await dex.contract
    .storage()
    .then((storage: DexStorage) => storage.storage.stakers_balance)
    .then((balance) => balance.get([staker, pool_id.toString()]))
    .then((value) => (value ? value.balance : new BigNumber(0)));
  const op = await dex.contract.methods.unstake(pool_id, output).send();
  await confirmOperation(Tezos, op.hash);
  await dex.updateStorage({ pools: [pool_id.toString()] });
  const upd_total_stake =
    dex.storage.storage.pools[pool_id.toNumber()].staker_accumulator
      .total_staked;
  const upd_user_stake: BigNumber = await dex.contract
    .storage()
    .then((storage: DexStorage) => {
      return storage.storage.stakers_balance;
    })
    .then((balance) => balance.get([staker, pool_id.toString()]))
    .then((value) => value.balance);
  expect(init_user_stake.minus(output).toNumber()).toStrictEqual(
    upd_user_stake.toNumber()
  );
  expect(init_total_stake.minus(output).toNumber()).toStrictEqual(
    upd_total_stake.toNumber()
  );
}
