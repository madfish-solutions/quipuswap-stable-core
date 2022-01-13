import BigNumber from "bignumber.js";
import { confirmOperation } from "../../../../scripts/helpers/confirmation";
import { Tezos } from "../../../../scripts/helpers/utils";
import { Dex } from "../../API/dexAPI";
import { PairInfo } from "../../types";
export const future_a_const: BigNumber = new BigNumber("10000") //A const *
  .multipliedBy(new BigNumber(3).pow(3 - 1));                  // n^(n-1)
export const future_a_time: BigNumber = new BigNumber("20");

export async function rampASuccessCase(
  dex: Dex,
  pool_id: BigNumber,
  ft_a: BigNumber,
  ft_time: BigNumber
) {
  await new Promise((r) => setTimeout(r, 10000));
  await dex.updateStorage({ pools: [pool_id.toString()] });
  const init: PairInfo = dex.storage.storage.pools[pool_id.toString()];
  const {
    future_A: init_ft_A,
    future_A_time: init_ft_A_t,
    initial_A: init_in_A,
    initial_A_time: init_in_A_t,
  } = init;
  ft_time = new BigNumber(Date.now())
    .plus(ft_time.multipliedBy(1000))
    .dividedToIntegerBy(1000);
  console.log(ft_time.toNumber());
  const op = await dex.contract.methods.ramp_A(pool_id, ft_a, ft_time).send();
  await confirmOperation(Tezos, op.hash);
  await dex.updateStorage({ pools: [pool_id.toString()] });
  const upd: PairInfo = dex.storage.storage.pools[pool_id.toString()];
  const {
    future_A: upd_ft_A,
    future_A_time: upd_ft_A_t,
    initial_A: upd_in_A,
    initial_A_time: upd_in_A_t,
  } = upd;
  console.log(init_in_A_t, upd_in_A_t);
  console.log(init_ft_A_t, upd_ft_A_t);
  console.log(init_in_A.toNumber(), upd_in_A.toNumber());
  console.log(init_ft_A.toNumber(), upd_ft_A.toNumber());
  expect(init_ft_A.toNumber()).not.toStrictEqual(upd_ft_A.toNumber());
  expect(init_ft_A_t).not.toStrictEqual(upd_ft_A_t);
}

export async function stopRampASuccessCase(dex: Dex, pool_id: BigNumber) {
  await new Promise((r) =>
    setTimeout(r, future_a_time.multipliedBy(1000).div(2).toNumber())
  );
  await dex.updateStorage({ pools: [pool_id.toString()] });
  const init: PairInfo = dex.storage.storage.pools[pool_id.toString()];
  const {
    future_A: init_ft_A,
    future_A_time: init_ft_A_t,
    initial_A: init_in_A,
    initial_A_time: init_in_A_t,
  } = init;
  const op = await dex.contract.methods.stop_ramp_A(pool_id).send();
  await confirmOperation(Tezos, op.hash);
  await dex.updateStorage({ pools: [pool_id.toString()] });
  const upd: PairInfo = dex.storage.storage.pools[pool_id.toString()];
  const {
    future_A: upd_ft_A,
    future_A_time: upd_ft_A_t,
    initial_A: upd_in_A,
    initial_A_time: upd_in_A_t,
  } = upd;
  expect(upd_ft_A.toNumber()).toStrictEqual(upd_in_A.toNumber());
  expect(upd_ft_A_t).toStrictEqual(upd_in_A_t);
  console.log(init_in_A_t, upd_in_A_t);
  console.log(init_ft_A_t, upd_ft_A_t);
  console.log(init_in_A.toNumber(), upd_in_A.toNumber());
  console.log(init_ft_A.toNumber(), upd_ft_A.toNumber());
  expect(init_ft_A_t).not.toStrictEqual(upd_ft_A_t);
  expect(init_ft_A.toNumber()).not.toStrictEqual(upd_ft_A.toNumber());
  expect(init_in_A_t).not.toStrictEqual(upd_in_A_t);
  expect(init_in_A.toNumber()).not.toStrictEqual(upd_in_A.toNumber());
}
