import { TezosToolkit } from "@taquito/taquito";
import { DexAPI as Dex } from "../API";
import {
  AccountsLiteral,
  prepareProviderOptions,
} from "../../../utils/helpers";
import BigNumber from "bignumber.js";
import { DexStorage } from "../API/types";
import { dev_fee } from "../../../utils/constants";

export async function setAdminSuccessCase(
  dex: Dex,
  sender: AccountsLiteral,
  admin: string,
  Tezos: TezosToolkit
) {
  const config = await prepareProviderOptions(sender);
  Tezos.setProvider(config);
  const sender_address = await Tezos.signer.publicKeyHash();

  await dex.updateStorage({});
  const initAdmin = dex.storage.storage.admin;
  expect(admin).not.toStrictEqual(initAdmin);

  expect(sender_address).toStrictEqual(initAdmin);
  await dex.setAdmin(admin);

  await dex.updateStorage({});
  const updatedAdmin = dex.storage.storage.admin;
  expect(admin).toStrictEqual(updatedAdmin);
}

export async function updateManagersSuccessCase(
  dex: Dex,
  sender: AccountsLiteral,
  manager: string,
  add: boolean,
  Tezos: TezosToolkit
) {
  const config = await prepareProviderOptions(sender);
  Tezos.setProvider(config);

  await dex.updateStorage({});
  const initManagers = dex.storage.storage.managers;
  // initManagers includes manager if want to remove and not includes if add
  expect(initManagers.includes(manager)).not.toBe(add);

  await dex.addRemManager(add, manager);

  await dex.updateStorage({});
  const updatedManagers = dex.storage.storage.managers;
  expect(updatedManagers.includes(manager)).toBe(add);
}

export async function setDevAddrSuccessCase(
  dex: Dex,
  sender: AccountsLiteral,
  dev: string,
  Tezos: TezosToolkit
) {
  const config = await prepareProviderOptions(sender);
  Tezos.setProvider(config);

  await dex.updateStorage({});
  const initDev = dex.storage.storage.dev_store.dev_address;
  expect(dev).not.toStrictEqual(initDev);

  await dex.setDevAddress(dev);

  await dex.updateStorage({});
  const updatedDev = dex.storage.storage.dev_store.dev_address;
  expect(dev).toStrictEqual(updatedDev);
}

export async function setDevFeesSuccessCase(
  dex: Dex,
  sender: AccountsLiteral,
  fee: BigNumber = dev_fee,
  Tezos: TezosToolkit
) {
  const config = await prepareProviderOptions(sender);
  Tezos.setProvider(config);
  await expect(Tezos.signer.publicKeyHash()).resolves.toStrictEqual(
    dex.storage.storage.dev_store.dev_address
  );
  const initFee = dex.storage.storage.dev_store.dev_fee as BigNumber;
  for (const key in initFee) {
    expect(initFee.toNumber()).not.toStrictEqual(fee.toNumber());
  }

  await dex.setDevFee(fee);

  const updStorage: DexStorage = await dex.contract.storage();
  const updatedFees: BigNumber = await updStorage.storage.dev_store.dev_fee;
  console.log(updatedFees);
  for (const key in updatedFees) {
    expect(updatedFees.toNumber()).toStrictEqual(fee.toNumber());
  }
}

export async function setDefaultRefSuccessCase(
  dex: Dex,
  sender: AccountsLiteral,
  ref: string,
  Tezos: TezosToolkit
) {
  const config = await prepareProviderOptions(sender);
  Tezos.setProvider(config);

  await dex.updateStorage({});
  const initRef = dex.storage.storage.default_referral;
  expect(ref).not.toStrictEqual(initRef);

  await dex.setDefaultReferral(ref);

  await dex.updateStorage({});
  const updatedDev = dex.storage.storage.default_referral;
  expect(ref).toStrictEqual(updatedDev);
}
