import { TezosToolkit } from "@taquito/taquito";
import BigNumber from "bignumber.js";
import {
  AccountsLiteral,
  prepareProviderOptions,
} from "../../../../scripts/helpers/utils";
import Dex from "../../API";
import { DexStorage, FeeType } from "../../types";

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
  const config = await prepareProviderOptions(sender);
  Tezos.setProvider(config);
  await dex.updateStorage({ pools: [pool_id.toString()] });
  await expect(Tezos.signer.publicKeyHash()).resolves.toStrictEqual(
    dex.storage.storage.admin
  );
  const initFee = dex.storage.storage.pools[pool_id.toString()].fee as FeeType;
  for (const key in initFee) {
    expect(initFee[key].toNumber()).not.toStrictEqual(fees[key].toNumber());
  }

  await dex.setFees(pool_id, fees);

  await dex.updateStorage({ pools: [pool_id.toString()] });
  const updStorage = (await dex.contract.storage()) as DexStorage;
  const updatedFees = (await updStorage.storage.pools.get(pool_id.toString()))
    .fee as FeeType;
  for (const key in updatedFees) {
    expect(updatedFees[key].toNumber()).toStrictEqual(fees[key].toNumber());
  }
}
