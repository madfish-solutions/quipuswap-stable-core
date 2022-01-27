import { TezosToolkit } from "@taquito/taquito";
import {
  AccountsLiteral,
  prepareProviderOptions,
  TezosAddress,
} from "../../../utils/helpers";
import { DexFactoryAPI as DexFactory } from "../API";
export async function updateWhitelistSuccessCase(
  factory: DexFactory,
  sender: AccountsLiteral,
  candid: TezosAddress,
  add: boolean,
  Tezos: TezosToolkit
) {
  const config = await prepareProviderOptions(sender);
  Tezos.setProvider(config);

  await factory.updateStorage({});
  const initWL = factory.storage.storage.whitelist;
  // initManagers includes manager if want to remove and not includes if add
  expect(initWL.includes(candid)).not.toBe(add);

  await factory.addRemWhitelist(add, candid, Tezos);

  await factory.updateStorage({});
  const updatedWL = factory.storage.storage.whitelist;
  expect(updatedWL.includes(candid)).toBe(add);
}
