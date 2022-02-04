import { TezosToolkit } from "@taquito/taquito";
import {
  AccountsLiteral,
  prepareProviderOptions,
} from "../../../utils/helpers";
import { DevEnabledContract } from "../API/devAPI";
import { DevStorage } from "../API/storage";
import BigNumber from "bignumber.js";
import { dev_fee } from "../../../utils/constants";

export async function setDevAddrSuccessCase(
  DEC: DevEnabledContract,
  sender: AccountsLiteral,
  dev: string,
  tezos: TezosToolkit
) {
  const config = await prepareProviderOptions(sender);
  tezos.setProvider(config);
  await DEC.updateStorage({});
  let store: DevStorage = DEC.storage.storage.dev_store;
  const initDev = store.dev_address;
  await expect(tezos.signer.publicKeyHash()).resolves.toStrictEqual(initDev);
  expect(dev).not.toStrictEqual(initDev);

  await DEC.setDevAddress(dev, tezos);

  await DEC.updateStorage({});
  store = DEC.storage.storage.dev_store;
  const updatedDev = store.dev_address;
  expect(dev).toStrictEqual(updatedDev);
}

export async function setDevFeeSuccessCase(
  DEC: DevEnabledContract,
  sender: AccountsLiteral,
  fee: BigNumber = dev_fee,
  tezos: TezosToolkit
) {
  const config = await prepareProviderOptions(sender);
  tezos.setProvider(config);
  await DEC.updateStorage({});
  let store: DevStorage = DEC.storage.storage.dev_store;
  await expect(tezos.signer.publicKeyHash()).resolves.toStrictEqual(
    store.dev_address
  );
  const initFee = store.dev_fee as BigNumber;
  expect(initFee.toNumber()).not.toStrictEqual(fee.toNumber());

  await DEC.setDevFee(fee, tezos);

  await DEC.updateStorage({});
  store = DEC.storage.storage.dev_store;
  const updatedFee: BigNumber = store.dev_fee;
  expect(updatedFee.toNumber()).toStrictEqual(fee.toNumber());
}
