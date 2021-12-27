import BigNumber from "bignumber.js";
import { confirmOperation } from "../../../helpers/confirmation";
import { Tezos } from "../../../helpers/utils";
import { Dex } from "../../API/dexAPI";
export const future_a_const: BigNumber = new BigNumber("100000");
export const future_a_time: BigNumber = new BigNumber("86400");

export async function rampASuccessCase(
  dex: Dex,
  pool_id: BigNumber,
  ft_a: BigNumber,
  ft_time: BigNumber
) {
  await new Promise((r) => setTimeout(r, 20000));
  await dex.updateStorage({ pools: [pool_id.toString()] });
  const init = dex.storage.storage.pools[pool_id.toString()];
  const { future_A: init_ft_A, future_A_time: init_ft_A_t } = init;
  const op = await dex.contract.methods.ramp_A(pool_id, ft_a, ft_time).send();
  await confirmOperation(Tezos, op.hash);
  const upd = dex.storage.storage.pools[pool_id.toString()];
  const { future_A: upd_ft_A, future_A_time: upd_ft_A_t } = upd;
  expect(init_ft_A.toNumber()).not.toStrictEqual(upd_ft_A.toNumber());
  expect(init_ft_A_t.toNumber()).not.toStrictEqual(upd_ft_A_t.toNumber());
}

export async function stopRampASuccessCase(dex: Dex, pool_id: BigNumber) {
  await dex.updateStorage({ pools: [pool_id.toString()] });
  const init = dex.storage.storage.pools[pool_id.toString()];
  const {
    future_A: init_ft_A,
    future_A_time: init_ft_A_t,
    initial_A: init_in_A,
    initial_A_time: init_in_A_t,
  } = init;
  const op = await dex.contract.methods.stop_ramp_A(pool_id).send();
  await confirmOperation(Tezos, op.hash);
  const upd = dex.storage.storage.pools[pool_id.toString()];
  const {
    future_A: upd_ft_A,
    future_A_time: upd_ft_A_t,
    initial_A: upd_in_A,
    initial_A_time: upd_in_A_t,
  } = upd;
  expect(init_ft_A.toNumber()).not.toStrictEqual(upd_ft_A.toNumber());
  expect(init_ft_A_t).not.toStrictEqual(upd_ft_A_t);
  expect(init_in_A.toNumber()).not.toStrictEqual(upd_in_A.toNumber());
  expect(init_in_A_t).not.toStrictEqual(upd_in_A_t);
  expect(upd_ft_A.toNumber()).not.toStrictEqual(upd_in_A.toNumber());
  expect(upd_ft_A_t).toStrictEqual(upd_in_A_t);
}
