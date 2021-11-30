import { TezosToolkit } from "@taquito/taquito";
import failCase from "../fail-test";
import { Dex } from "../helpers/dexFA2";
import { AccountsLiteral, prepareProviderOptions } from "../helpers/utils";
import BigNumber from 'bignumber.js';

export async function setAdminSuccessCase(
  dex: Dex,
  sender: AccountsLiteral,
  admin: string,
  Tezos: TezosToolkit
) {
  let config = await prepareProviderOptions(sender);
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
  let config = await prepareProviderOptions(sender);
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
  let config = await prepareProviderOptions(sender);
  Tezos.setProvider(config);

  await dex.updateStorage({});
  const initDev = dex.storage.storage.dev_address;
  expect(dev).not.toEqual(initDev);

  await dex.setDevAddress(dev);

  await dex.updateStorage({});
  const updatedDev = dex.storage.storage.dev_address;
  expect(dev).toEqual(updatedDev);
}

export async function setDefaultRefSuccessCase(
  dex: Dex,
  sender: AccountsLiteral,
  ref: string,
  Tezos: TezosToolkit
) {
  let config = await prepareProviderOptions(sender);
  Tezos.setProvider(config);

  await dex.updateStorage({});
  const initRef = dex.storage.storage.default_referral;
  expect(ref).not.toEqual(initRef);

  await dex.setDefaultReferral(ref);

  await dex.updateStorage({});
  const updatedDev = dex.storage.storage.default_referral;
  expect(ref).toEqual(updatedDev);
}

export async function setAdminRateSuccessCase(
  dex: Dex,
  sender: AccountsLiteral,
  rate: BigNumber,
  Tezos: TezosToolkit
) {
  let config = await prepareProviderOptions(sender);
  Tezos.setProvider(config);

  await dex.updateStorage({});
  const initRate = dex.storage.storage.reward_rate;
  expect(rate).not.toEqual(initRate);

  await dex.setAdminRate(rate);

  await dex.updateStorage({});
  const updatedRate = dex.storage.storage.reward_rate;
  expect(rate).toEqual(updatedRate);
}