import { TezosToolkit } from "@taquito/taquito";
import BigNumber from "bignumber.js";
import { Dex } from "../../../helpers/dexFA2";
import { FeeType } from "../../../helpers/types";
import { AccountsLiteral, prepareProviderOptions } from "../../../helpers/utils";

export const fees: FeeType = {
  lp_fee: new BigNumber("2000000"),
  stakers_fee: new BigNumber("2000000"),
  ref_fee: new BigNumber("500000"),
  dev_fee: new BigNumber("500000"),
};
export async function setFeesSuccessCase(
  dex: Dex,
  sender: AccountsLiteral,
  pool_id: BigNumber,
  fees: FeeType,
  Tezos: TezosToolkit
) {
  let config = await prepareProviderOptions(sender);
  Tezos.setProvider(config);
  await dex.updateStorage({ pools: [pool_id.toString()] });
  expect(await Tezos.signer.publicKeyHash()).toEqual(dex.storage.storage.admin);
  const initFee = dex.storage.storage.pools[pool_id.toString()].fee as FeeType;
  for (const key in initFee) {
    expect(initFee[key].toNumber()).not.toEqual(fees[key].toNumber());
  }

  await dex.setFees(pool_id, fees);

  await dex.updateStorage({ pools: [pool_id.toString()] });
  const updStorage = (await dex.contract.storage()) as any;
  const updatedFees = (await updStorage.storage.pools.get(pool_id))
    .fee as FeeType;
  for (const key in updatedFees) {
    expect(updatedFees[key].toNumber()).toEqual(fees[key].toNumber());
  }
}
