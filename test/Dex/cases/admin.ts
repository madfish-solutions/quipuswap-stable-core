import { TezosToolkit } from "@taquito/taquito";
import { DexAPI as Dex } from "../API";
import {
  AccountsLiteral,
  prepareProviderOptions,
} from "../../../utils/helpers";
export {
  setDevAddrSuccessCase,
  setDevFeeSuccessCase,
} from "../../Developer/cases";
export {
  addStrategyFactorySuccessCase,
  removeStrategyFactorySuccessCase,
} from "../../Strategy/cases";

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
